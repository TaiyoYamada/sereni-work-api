"""解のデコード・制約違反検証・スコア計算・提案理由。

提案理由はコードで返し、日本語への変換は Hono 側で行う
（このプロセスは個人情報も業務文言も持たない）。
"""

from models import Assignment, Candidate, Problem, Variable, benefit


def decode(sample: dict[str, int], variables: list[Variable]) -> list[Assignment]:
    """ソルバーのサンプル（変数名 -> 0/1）を割当リストへ変換する。スラック変数は無視する"""
    by_name = {v.name: v for v in variables}
    assignments = [
        Assignment(var.participant_id, var.company_id, var.period_id)
        for name, value in sample.items()
        if value == 1 and (var := by_name.get(name)) is not None
    ]
    return sorted(assignments, key=lambda a: (a.participant_id, a.period_id, a.company_id))


def validate(assignments: list[Assignment], problem: Problem) -> list[dict]:
    """ソルバーの結果をそのまま信用せず、必ず独立に検証する（docs/optimization.md）"""
    violations: list[dict] = []

    # 同一利用者の同一期間の二重割当
    seen: dict[tuple[str, str], int] = {}
    for a in assignments:
        seen[(a.participant_id, a.period_id)] = seen.get((a.participant_id, a.period_id), 0) + 1
    for (participant_id, period_id), count in seen.items():
        if count > 1:
            violations.append(
                {
                    "code": "DUPLICATE_ASSIGNMENT",
                    "participantId": participant_id,
                    "periodId": period_id,
                }
            )

    # 定員超過
    occupancy: dict[tuple[str, str], int] = {}
    for a in assignments:
        occupancy[(a.company_id, a.period_id)] = occupancy.get((a.company_id, a.period_id), 0) + 1
    for (company_id, period_id), count in occupancy.items():
        cap = problem.company(company_id).capacity.get(period_id, 0)
        if count > cap:
            violations.append(
                {
                    "code": "CAPACITY_EXCEEDED",
                    "companyId": company_id,
                    "periodId": period_id,
                    "count": count,
                    "capacity": cap,
                }
            )

    # 禁止組み合わせ（対応不可の配慮・参加不可日）
    for a in assignments:
        participant = problem.participant(a.participant_id)
        if not participant.accommodation_ok.get(a.company_id, False):
            violations.append(
                {
                    "code": "ACCOMMODATION_NOT_SUPPORTED",
                    "participantId": a.participant_id,
                    "companyId": a.company_id,
                }
            )
        if a.period_id in participant.unavailable_periods:
            violations.append(
                {
                    "code": "PARTICIPANT_UNAVAILABLE",
                    "participantId": a.participant_id,
                    "periodId": a.period_id,
                }
            )

    return violations


DESIRE_THRESHOLD = 0.5
SKILL_THRESHOLD = 0.5


def score(assignments: list[Assignment], problem: Problem) -> tuple[float, dict, list[dict]]:
    """業務スコア（エネルギーではなく支援員が理解できる内訳）と提案理由コードを計算する"""
    w = problem.weights
    breakdown = {"desire": 0.0, "skill": 0.0, "fairness": 0.0, "rotation": 0.0}
    reasons: list[dict] = []

    for a in assignments:
        participant = problem.participant(a.participant_id)
        desire = participant.desire_match.get(a.company_id, 0.0)
        skill = participant.skill_match.get(a.company_id, 0.0)
        fairness = 1.0 / (1.0 + participant.past_assignment_count)
        rotation = 0.0 if a.company_id in participant.past_company_ids else 1.0

        breakdown["desire"] += w.desire * desire
        breakdown["skill"] += w.skill * skill
        breakdown["fairness"] += w.fairness * fairness
        breakdown["rotation"] += w.rotation * rotation

        codes: list[str] = ["ACCOMMODATION_OK"]  # 変数生成時点で配慮対応可は保証されている
        if desire >= DESIRE_THRESHOLD:
            codes.append("DESIRE_MATCH")
        if skill >= SKILL_THRESHOLD:
            codes.append("SKILL_MATCH")
        if rotation > 0:
            codes.append("NEW_EXPERIENCE")
        if participant.past_assignment_count == 0:
            codes.append("FAIRNESS_FIRST_TIMER")
        reasons.append(
            {"participantId": a.participant_id, "companyId": a.company_id, "codes": codes}
        )

    total = sum(breakdown.values())
    return total, breakdown, reasons


def build_candidate(
    sample: dict[str, int],
    variables: list[Variable],
    problem: Problem,
    energy: float | None = None,
) -> Candidate:
    assignments = decode(sample, variables)
    violations = validate(assignments, problem)
    total, breakdown, reasons = score(assignments, problem)
    return Candidate(
        assignments=assignments,
        score=round(total, 4),
        score_breakdown={k: round(v, 4) for k, v in breakdown.items()},
        violations=violations,
        reasons=reasons,
        energy=energy,
    )


def objective_value(assignments: list[Assignment], problem: Problem) -> float:
    """テスト用: 割当の効用合計（厳密解との比較に使う）"""
    return sum(
        benefit(problem, problem.participant(a.participant_id), problem.company(a.company_id))
        for a in assignments
    )
