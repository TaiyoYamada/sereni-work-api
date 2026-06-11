"""SQA（量子アニーリングのシミュレーション）のテスト。

設計書のテスト方針に従う: 全探索（ExactSolver）との比較 / 再現性（seed 固定） /
制約充足 / ソルバー差し替え。
"""

from models import parse_problem
from solvers import SOLVERS, solve_exact, solve_sqa
from test_handler import make_payload


def make_sqa_problem(**overrides):
    return parse_problem(make_payload(solver="sqa", **overrides))


class TestSqa:
    def test_レジストリに登録されている(self):
        assert SOLVERS["sqa"] is solve_sqa

    def test_全探索の最適値に到達する(self):
        problem = make_sqa_problem()
        exact = solve_exact(parse_problem(make_payload(solver="exact")))
        outcome = solve_sqa(problem)
        assert outcome.energies[0] is not None
        assert abs(outcome.energies[0] - exact.energies[0]) < 1e-9

    def test_seed_固定で再現する(self):
        first = solve_sqa(make_sqa_problem(seed=7))
        second = solve_sqa(make_sqa_problem(seed=7))
        assert first.samples == second.samples
        assert first.energies == second.energies

    def test_seed_が違えば探索過程が変わりうるが解は有効(self):
        outcome = solve_sqa(make_sqa_problem(seed=123))
        assert len(outcome.samples) >= 1
        # 全サンプルが 0/1 のみで構成される
        for sample in outcome.samples:
            assert set(sample.values()) <= {0, 1}

    def test_メトリクスに手法とパラメータが入る(self):
        outcome = solve_sqa(make_sqa_problem())
        assert outcome.metrics["method"] == "path-integral-monte-carlo"
        assert outcome.metrics["trotterSlices"] >= 2
        assert outcome.metrics["numReads"] <= outcome.metrics["requestedNumReads"]

    def test_配慮対応不可の組み合わせは候補に現れない(self):
        # p2 は c0 の配慮に対応不可（make_payload 参照）→ 変数生成段階で除外される
        outcome = solve_sqa(make_sqa_problem())
        for sample in outcome.samples:
            assert all(
                not (name.startswith("p2|c0|") and value == 1) for name, value in sample.items()
            )
