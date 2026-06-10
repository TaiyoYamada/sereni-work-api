"""ソルバー共通インターフェース。

呼び出し側（handler）は solve() だけを知り、具体的なソルバーへ依存しない。
新しいソルバーは SOLVERS への登録だけで追加できる（OCP）。
"""

import os
import time
from dataclasses import dataclass, field

import dimod
from dwave.samplers import SimulatedAnnealingSampler

from models import Problem
from qubo import build_bqm


class SolverError(Exception):
    """ソルバー実行に失敗した場合に送出する"""


@dataclass
class SolveOutcome:
    """全ソルバー共通の戻り値。samples は「変数名 -> 0/1」のリスト（良い順）"""

    samples: list[dict[str, int]]
    energies: list[float | None]
    variable_count: int
    constraint_count: int
    execution_time_ms: int
    metrics: dict = field(default_factory=dict)


def _distinct_lowest(sampleset: dimod.SampleSet, limit: int) -> tuple[list[dict], list[float]]:
    """SampleSet から重複を除いてエネルギーの低い順に limit 件取り出す"""
    samples: list[dict] = []
    energies: list[float] = []
    seen: set[frozenset] = set()
    for record in sampleset.aggregate().data(["sample", "energy"], sorted_by="energy"):
        key = frozenset(k for k, v in record.sample.items() if v == 1)
        if key in seen:
            continue
        seen.add(key)
        samples.append({k: int(v) for k, v in record.sample.items()})
        energies.append(float(record.energy))
        if len(samples) >= limit:
            break
    return samples, energies


def solve_exact(problem: Problem) -> SolveOutcome:
    """全探索（テストの正解基準。変数 ~20 個まで）"""
    bqm, variables, constraint_count = build_bqm(problem)
    if len(bqm.variables) > 22:
        raise SolverError("exact ソルバーは変数 22 個までです（全探索のため）")
    started = time.perf_counter()
    sampleset = dimod.ExactSolver().sample(bqm)
    samples, energies = _distinct_lowest(sampleset, problem.max_candidates)
    return SolveOutcome(
        samples=samples,
        energies=list(energies),
        variable_count=len(variables),
        constraint_count=constraint_count,
        execution_time_ms=int((time.perf_counter() - started) * 1000),
    )


def solve_sa(problem: Problem) -> SolveOutcome:
    """シミュレーテッドアニーリング（QUBO 経路の標準。seed 固定で再現可能）"""
    bqm, variables, constraint_count = build_bqm(problem)
    started = time.perf_counter()
    sampleset = SimulatedAnnealingSampler().sample(
        bqm, num_reads=problem.num_reads, seed=problem.seed
    )
    samples, energies = _distinct_lowest(sampleset, problem.max_candidates)
    return SolveOutcome(
        samples=samples,
        energies=list(energies),
        variable_count=len(variables),
        constraint_count=constraint_count,
        execution_time_ms=int((time.perf_counter() - started) * 1000),
        metrics={"numReads": problem.num_reads, "seed": problem.seed},
    )


def solve_dwave(problem: Problem) -> SolveOutcome:
    """量子アニーリング実機（管理者のみ。DWAVE_API_TOKEN が必要）。

    実機固有のメトリクス（embedding、Chain Break 等）を metrics に保存する。
    接続はテストでモックする。
    """
    if not os.environ.get("DWAVE_API_TOKEN"):
        raise SolverError("実機が設定されていません（DWAVE_API_TOKEN 未設定）")

    # 重い依存のため実機利用時のみ import する
    from dwave.system import DWaveSampler, EmbeddingComposite

    bqm, variables, constraint_count = build_bqm(problem)
    started = time.perf_counter()
    sampler = EmbeddingComposite(DWaveSampler())
    sampleset = sampler.sample(bqm, num_reads=problem.num_reads, return_embedding=True)
    samples, energies = _distinct_lowest(sampleset, problem.max_candidates)

    embedding_info = sampleset.info.get("embedding_context", {})
    timing = sampleset.info.get("timing", {})
    return SolveOutcome(
        samples=samples,
        energies=list(energies),
        variable_count=len(variables),
        constraint_count=constraint_count,
        execution_time_ms=int((time.perf_counter() - started) * 1000),
        metrics={
            "service": "dwave",
            "numReads": problem.num_reads,
            "logicalVariables": len(bqm.variables),
            "physicalQubits": sum(
                len(chain) for chain in embedding_info.get("embedding", {}).values()
            ),
            "chainStrength": embedding_info.get("chain_strength"),
            "chainBreakFraction": float(sampleset.record.chain_break_fraction.mean())
            if "chain_break_fraction" in sampleset.record.dtype.names
            else None,
            "qpuTiming": timing,
        },
    )


SOLVERS = {
    "exact": solve_exact,
    "sa": solve_sa,
    "dwave": solve_dwave,
}


def solve(problem: Problem) -> SolveOutcome:
    return SOLVERS[problem.solver](problem)
