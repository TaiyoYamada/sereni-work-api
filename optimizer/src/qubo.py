"""QUBO 生成（docs/optimization.md の定式化）。

H = -Σ benefit(i,j) x(i,j,t)                         … 目的（効用の最大化）
  + A Σ_{i,t} Σ_{j<j'} x(i,j,t) x(i,j',t)            … 同一利用者の同一期間の二重割当ペナルティ
  + A Σ_{j,t} (Σ_i x(i,j,t) - slack)²                … 定員ペナルティ（スラック変数で ≤ を表現）

ペナルティ係数 A は「1変数が得られる最大効用」を必ず上回る値にする。
"""

from dimod import BinaryQuadraticModel

from models import Problem, Variable, benefit, feasible_variables


def penalty_strength(problem: Problem) -> float:
    """制約違反 1 件のペナルティ。最大効用（= 重み合計）の 2 倍 + 1 で必ず違反が損になる"""
    return 2.0 * problem.weights.total() + 1.0


def build_bqm(problem: Problem) -> tuple[BinaryQuadraticModel, list[Variable], int]:
    """BQM・変数リスト・制約数を返す"""
    variables = feasible_variables(problem)
    bqm = BinaryQuadraticModel("BINARY")
    strength = penalty_strength(problem)
    constraint_count = 0

    # 目的関数: 効用の最大化（最小化問題なので符号反転）
    for var in variables:
        participant = problem.participant(var.participant_id)
        company = problem.company(var.company_id)
        bqm.add_variable(var.name, -benefit(problem, participant, company))

    # ハード制約①: 同一利用者を同一期間に複数企業へ割り当てない（ペア項ペナルティ）
    for participant in problem.participants:
        for period_id in problem.periods:
            group = [
                v
                for v in variables
                if v.participant_id == participant.id and v.period_id == period_id
            ]
            if len(group) >= 2:
                constraint_count += 1
                for index, u in enumerate(group):
                    for v in group[index + 1 :]:
                        bqm.add_interaction(u.name, v.name, strength)

    # ハード制約②: 企業×期間の受け入れ定員（スラック変数つき不等式）
    for company in problem.companies:
        for period_id in problem.periods:
            group = [
                v for v in variables if v.company_id == company.id and v.period_id == period_id
            ]
            cap = company.capacity.get(period_id, 0)
            if len(group) > cap:
                constraint_count += 1
                terms = [(v.name, 1) for v in group]
                bqm.add_linear_inequality_constraint(
                    terms,
                    lagrange_multiplier=strength,
                    label=f"cap|{company.id}|{period_id}",
                    lb=0,
                    ub=cap,
                )

    return bqm, variables, constraint_count
