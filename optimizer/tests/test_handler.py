"""最適化 Lambda のテスト。

設計書のテスト方針: QUBO 生成 / 制約違反 / 全探索（ExactSolver）との比較 /
 再現性（seed 固定） / 解のデコード / スコア再計算。
実機（dwave）は接続せずエラーパスのみ検証する。
"""

import pytest

from handler import lambda_handler
from models import (
    ProblemValidationError,
    feasible_variables,
    parse_problem,
)
from qubo import build_bqm
from solution import objective_value


def make_payload(**overrides) -> dict:
    """3人 × 2社 × 1期間の小規模問題（全探索可能なサイズ）"""
    payload = {
        "runId": "run-test",
        "solver": "sa",
        "seed": 42,
        "numReads": 200,
        "maxCandidates": 3,
        "periods": ["t0"],
        "participants": [
            {
                "id": "p0",
                "desireMatch": {"c0": 1.0, "c1": 0.2},
                "skillMatch": {"c0": 0.8, "c1": 0.3},
                "accommodationOk": {"c0": True, "c1": True},
                "pastAssignmentCount": 0,
                "pastCompanyIds": [],
            },
            {
                "id": "p1",
                "desireMatch": {"c0": 0.9, "c1": 0.9},
                "skillMatch": {"c0": 0.5, "c1": 0.9},
                "accommodationOk": {"c0": True, "c1": True},
                "pastAssignmentCount": 2,
                "pastCompanyIds": ["c0"],
            },
            {
                "id": "p2",
                "desireMatch": {"c0": 0.1, "c1": 0.7},
                "skillMatch": {"c1": 0.6},
                "accommodationOk": {"c0": False, "c1": True},  # c0 は配慮対応不可
                "pastAssignmentCount": 1,
                "pastCompanyIds": [],
            },
        ],
        "companies": [
            {"id": "c0", "capacity": {"t0": 1}},
            {"id": "c1", "capacity": {"t0": 2}},
        ],
        "weights": {"desire": 1.0, "skill": 0.8, "fairness": 0.5, "rotation": 0.3},
    }
    payload.update(overrides)
    return payload


class TestParseProblem:
    def test_正常な問題定義をパースできる(self):
        problem = parse_problem(make_payload())
        assert problem.run_id == "run-test"
        assert len(problem.participants) == 3

    def test_必須項目の欠落はエラー(self):
        with pytest.raises(ProblemValidationError):
            parse_problem({"runId": "x", "periods": [], "participants": [], "companies": []})

    def test_未対応ソルバーはエラー(self):
        with pytest.raises(ProblemValidationError):
            parse_problem(make_payload(solver="quantum-magic"))


class TestFeasibleVariables:
    def test_対応不可の配慮の組み合わせは変数を生成しない(self):
        problem = parse_problem(make_payload())
        names = {v.name for v in feasible_variables(problem)}
        assert "x|p2|c0|t0" not in names  # accommodationOk: False
        assert "x|p2|c1|t0" in names

    def test_参加不可期間は変数を生成しない(self):
        payload = make_payload()
        payload["participants"][0]["unavailablePeriods"] = ["t0"]
        problem = parse_problem(payload)
        names = {v.name for v in feasible_variables(problem)}
        assert not any(name.startswith("x|p0|") for name in names)


class TestQubo:
    def test_QUBO_が生成され制約数が数えられる(self):
        problem = parse_problem(make_payload())
        bqm, variables, constraint_count = build_bqm(problem)
        assert len(variables) == 5  # p2-c0 が除外されるため 3*2 - 1
        # 各利用者の二重割当 + c1 の定員制約（c0 は変数1個のため定員制約は不要）
        assert constraint_count >= 3


class TestSolvers:
    def test_SA_は制約を満たす候補を返し全探索の最適値に到達する(self):
        sa = lambda_handler(make_payload(solver="sa"), None)
        exact = lambda_handler(make_payload(solver="exact"), None)
        assert sa["status"] == "SUCCEEDED"

        problem = parse_problem(make_payload())
        best_sa = sa["candidates"][0]
        assert best_sa["violations"] == []
        # この規模なら SA は最適解に到達できる
        assert _objective_of(best_sa, problem) == pytest.approx(
            _objective_of(exact["candidates"][0], problem), abs=1e-6
        )

    def test_SA_は_seed_固定で再現する(self):
        first = lambda_handler(make_payload(solver="sa"), None)
        second = lambda_handler(make_payload(solver="sa"), None)
        assert first["candidates"][0]["assignments"] == second["candidates"][0]["assignments"]

    def test_定員は超過しない(self):
        result = lambda_handler(make_payload(solver="sa"), None)
        c0_count = sum(1 for a in result["candidates"][0]["assignments"] if a["companyId"] == "c0")
        assert c0_count <= 1

    def test_実機は未設定ならエラーを返す(self, monkeypatch):
        monkeypatch.delenv("DWAVE_API_TOKEN", raising=False)
        result = lambda_handler(make_payload(solver="dwave"), None)
        assert result["status"] == "FAILED"
        assert "実機" in result["errorMessage"]


class TestHandlerResponse:
    def test_提案理由コードとスコア内訳が含まれる(self):
        result = lambda_handler(make_payload(solver="sa"), None)
        candidate = result["candidates"][0]
        assert set(candidate["scoreBreakdown"].keys()) == {
            "desire",
            "skill",
            "fairness",
            "rotation",
        }
        assert all("codes" in reason for reason in candidate["reasons"])
        assert all("ACCOMMODATION_OK" in reason["codes"] for reason in candidate["reasons"])

    def test_不正な入力は_FAILED_を返す(self):
        result = lambda_handler({"runId": "x"}, None)
        assert result["status"] == "FAILED"
        assert "問題定義" in result["errorMessage"]


def _objective_of(candidate: dict, problem) -> float:
    from models import Assignment

    assignments = [
        Assignment(a["participantId"], a["companyId"], a["periodId"])
        for a in candidate["assignments"]
    ]
    return objective_value(assignments, problem)
