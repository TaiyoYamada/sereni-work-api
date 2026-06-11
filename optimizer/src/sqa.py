"""量子アニーリングのシミュレーション（SQA: 経路積分モンテカルロ法）。

横磁場イジング模型を Suzuki-Trotter 分解で P 個のスライス（レプリカ）に展開し、
横磁場 Γ を徐々に弱めながらメトロポリス更新する。実機（量子アニーラ）の
振る舞いを古典計算機上で模擬する標準的な手法。

外部依存は numpy のみ（dimod の同梱依存。requirements に追加しない）。
"""

import math

import numpy as np

# 既定パラメータ。対象の割当問題（数十〜数百変数）で全探索の最適解に到達する設定
TROTTER_SLICES = 8
BETA = 5.0
GAMMA_START = 3.0
GAMMA_END = 0.05
SWEEPS = 200

# 1 read のコストが SA より高い（スライス数倍）ため read 数は抑える。
# 各 read が P 個のスライス（候補）を返すのでサンプル多様性は確保できる
MAX_READS = 10

# 経路積分の内側ループは Python のため、大規模問題は SA を案内する
MAX_VARIABLES = 500


def effective_reads(num_reads: int) -> int:
    """実際に実行する read 数（上限 MAX_READS）"""
    return max(1, min(num_reads, MAX_READS))


def _interslice_coupling(gamma: float) -> float:
    """スライス間の強磁性結合 J⊥ = -(1/2β) ln tanh(βΓ/P)"""
    return -0.5 / BETA * math.log(math.tanh(BETA * gamma / TROTTER_SLICES))


def run_sqa(
    h: np.ndarray,
    j: np.ndarray,
    *,
    num_reads: int,
    seed: int,
) -> list[np.ndarray]:
    """SQA を実行し、全 read の最終スライス（±1 スピン配列）をすべて返す。

    h: 局所磁場 (N,) / j: 対称結合行列 (N, N)（対角 0）。
    エネルギーは E(s) = h·s + (1/2) s·(J s) と定義する。
    """
    variable_count = h.shape[0]
    rng = np.random.default_rng(seed)
    reads = effective_reads(num_reads)
    results: list[np.ndarray] = []

    for _ in range(reads):
        spins = rng.choice(np.array([-1, 1], dtype=np.int8), size=(TROTTER_SLICES, variable_count))
        for sweep in range(SWEEPS):
            progress = sweep / max(SWEEPS - 1, 1)
            gamma = GAMMA_START + (GAMMA_END - GAMMA_START) * progress
            j_perp = _interslice_coupling(gamma)
            for m in range(TROTTER_SLICES):
                slice_spins = spins[m]
                prev_slice = spins[(m - 1) % TROTTER_SLICES]
                next_slice = spins[(m + 1) % TROTTER_SLICES]
                # 局所場 f_i = h_i + Σ_k J_ik s_k。フリップ時は差分更新する
                local_fields = h + j @ slice_spins
                for i in rng.permutation(variable_count):
                    delta_classical = -2.0 * slice_spins[i] * local_fields[i] / TROTTER_SLICES
                    delta_quantum = 2.0 * j_perp * slice_spins[i] * (prev_slice[i] + next_slice[i])
                    delta = delta_classical + delta_quantum
                    if delta <= 0 or rng.random() < math.exp(-BETA * delta):
                        slice_spins[i] = -slice_spins[i]
                        local_fields += 2.0 * slice_spins[i] * j[:, i]
        # 最終状態の全スライスを候補として返す（呼び出し側が古典エネルギーで選別する）
        results.extend(spins[m].copy() for m in range(TROTTER_SLICES))

    return results
