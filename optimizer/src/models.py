"""問題定義の受け取りと検証。

個人情報は受け取らない。利用者・企業は匿名 ID（p0, c0, ...）と数値化された特徴のみ。
"""

from dataclasses import dataclass


class ProblemValidationError(Exception):
    """問題定義が不正な場合に送出する"""


SUPPORTED_SOLVERS = ("sa", "exact", "dwave")

MAX_VARIABLES = 5000
MAX_NUM_READS = 2000


@dataclass(frozen=True)
class Participant:
    id: str
    desire_match: dict[str, float]  # companyId -> 0..1（希望職種との一致度）
    skill_match: dict[str, float]  # companyId -> 0..1（スキル一致度）
    accommodation_ok: dict[str, bool]  # companyId -> 必要な配慮に対応可能か
    unavailable_periods: frozenset[str]  # 参加できない期間 ID
    past_assignment_count: int  # 公平性の重み付けに使う
    past_company_ids: frozenset[str]  # ローテーション価値（未経験職場へのボーナス）


@dataclass(frozen=True)
class Company:
    id: str
    capacity: dict[str, int]  # periodId -> 受け入れ可能人数


@dataclass(frozen=True)
class Weights:
    desire: float = 1.0
    skill: float = 0.8
    fairness: float = 0.5
    rotation: float = 0.3

    def total(self) -> float:
        return self.desire + self.skill + self.fairness + self.rotation


@dataclass(frozen=True)
class Problem:
    run_id: str
    solver: str
    periods: tuple[str, ...]
    participants: tuple[Participant, ...]
    companies: tuple[Company, ...]
    weights: Weights
    seed: int = 42
    num_reads: int = 100
    max_candidates: int = 3
    time_limit_ms: int = 10_000

    def participant(self, participant_id: str) -> Participant:
        return next(p for p in self.participants if p.id == participant_id)

    def company(self, company_id: str) -> Company:
        return next(c for c in self.companies if c.id == company_id)


@dataclass(frozen=True)
class Variable:
    """割当変数 x(i,j,t)。実現可能な組み合わせにのみ生成する"""

    participant_id: str
    company_id: str
    period_id: str

    @property
    def name(self) -> str:
        return f"x|{self.participant_id}|{self.company_id}|{self.period_id}"


@dataclass(frozen=True)
class Assignment:
    participant_id: str
    company_id: str
    period_id: str


@dataclass
class Candidate:
    assignments: list[Assignment]
    score: float
    score_breakdown: dict[str, float]
    violations: list[dict]
    reasons: list[dict]  # {participantId, companyId, codes: [...]}
    energy: float | None = None


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ProblemValidationError(message)


def parse_problem(payload: dict) -> Problem:
    _require(isinstance(payload, dict), "問題定義が不正です")
    _require(bool(payload.get("runId")), "runId は必須です")

    solver = payload.get("solver", "sa")
    _require(solver in SUPPORTED_SOLVERS, f"未対応のソルバーです: {solver}")

    periods = tuple(payload.get("periods", []))
    _require(len(periods) >= 1, "periods は1つ以上必要です")
    _require(len(set(periods)) == len(periods), "periods が重複しています")

    raw_participants = payload.get("participants", [])
    raw_companies = payload.get("companies", [])
    _require(len(raw_participants) >= 1, "participants は1人以上必要です")
    _require(len(raw_companies) >= 1, "companies は1社以上必要です")

    participants = tuple(
        Participant(
            id=p["id"],
            desire_match={k: float(v) for k, v in p.get("desireMatch", {}).items()},
            skill_match={k: float(v) for k, v in p.get("skillMatch", {}).items()},
            accommodation_ok=dict(p.get("accommodationOk", {})),
            unavailable_periods=frozenset(p.get("unavailablePeriods", [])),
            past_assignment_count=int(p.get("pastAssignmentCount", 0)),
            past_company_ids=frozenset(p.get("pastCompanyIds", [])),
        )
        for p in raw_participants
    )
    companies = tuple(
        Company(id=c["id"], capacity={k: int(v) for k, v in c.get("capacity", {}).items()})
        for c in raw_companies
    )

    _require(
        len({p.id for p in participants}) == len(participants),
        "participants の ID が重複しています",
    )
    _require(len({c.id for c in companies}) == len(companies), "companies の ID が重複しています")
    for company in companies:
        for period_id, cap in company.capacity.items():
            _require(period_id in periods, f"不明な期間です: {period_id}")
            _require(cap >= 0, "capacity は 0 以上が必要です")

    raw_weights = payload.get("weights", {})
    weights = Weights(
        desire=float(raw_weights.get("desire", 1.0)),
        skill=float(raw_weights.get("skill", 0.8)),
        fairness=float(raw_weights.get("fairness", 0.5)),
        rotation=float(raw_weights.get("rotation", 0.3)),
    )
    _require(weights.total() > 0, "重みの合計は 0 より大きい必要があります")

    num_reads = int(payload.get("numReads", 100))
    _require(1 <= num_reads <= MAX_NUM_READS, f"numReads は 1〜{MAX_NUM_READS} です")

    problem = Problem(
        run_id=str(payload["runId"]),
        solver=solver,
        periods=periods,
        participants=participants,
        companies=companies,
        weights=weights,
        seed=int(payload.get("seed", 42)),
        num_reads=num_reads,
        max_candidates=max(1, min(int(payload.get("maxCandidates", 3)), 10)),
        time_limit_ms=max(100, min(int(payload.get("timeLimitMs", 10_000)), 60_000)),
    )

    _require(
        len(feasible_variables(problem)) <= MAX_VARIABLES,
        f"変数数が上限（{MAX_VARIABLES}）を超えています",
    )
    return problem


def feasible_variables(problem: Problem) -> list[Variable]:
    """実現可能な組み合わせのみ変数化する（対応不可の配慮・参加不可日は最初から生成しない）"""
    variables: list[Variable] = []
    for participant in problem.participants:
        for company in problem.companies:
            if not participant.accommodation_ok.get(company.id, False):
                continue
            for period_id in problem.periods:
                if period_id in participant.unavailable_periods:
                    continue
                if company.capacity.get(period_id, 0) <= 0:
                    continue
                variables.append(Variable(participant.id, company.id, period_id))
    return variables


def benefit(problem: Problem, participant: Participant, company: Company) -> float:
    """割当 1 件の効用（目的関数の係数）。重みは業務用語に対応する"""
    w = problem.weights
    fairness_bonus = 1.0 / (1.0 + participant.past_assignment_count)
    rotation_bonus = 0.0 if company.id in participant.past_company_ids else 1.0
    return (
        w.desire * participant.desire_match.get(company.id, 0.0)
        + w.skill * participant.skill_match.get(company.id, 0.0)
        + w.fairness * fairness_bonus
        + w.rotation * rotation_bonus
    )
