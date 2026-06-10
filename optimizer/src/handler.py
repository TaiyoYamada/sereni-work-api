"""最適化 Lambda のエントリポイント。

役割は docs/architecture.md のとおり: 問題定義の受け取り → QUBO 生成 → ソルバー実行 →
解のデコード → 制約違反検証 → スコア計算 → 候補結果返却。DB へはアクセスしない。
"""

import logging

from models import ProblemValidationError, feasible_variables, parse_problem
from solution import build_candidate
from solvers import SolverError, solve

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    run_id = event.get("runId") if isinstance(event, dict) else None
    try:
        problem = parse_problem(event)
    except (ProblemValidationError, TypeError, KeyError, ValueError) as error:
        logger.warning("problem validation failed: %s", error)
        return _failed(run_id, f"問題定義が不正です: {error}")

    try:
        outcome = solve(problem)
    except SolverError as error:
        logger.warning("solver failed: run=%s error=%s", problem.run_id, error)
        return _failed(problem.run_id, str(error))

    variables = feasible_variables(problem)
    candidates = [
        build_candidate(sample, variables, problem, energy)
        for sample, energy in zip(outcome.samples, outcome.energies, strict=True)
    ]
    # 制約違反のない候補を優先し、スコアの高い順に並べる
    candidates.sort(key=lambda c: (len(c.violations) > 0, -c.score))

    logger.info(
        "run=%s solver=%s vars=%d candidates=%d time=%dms",
        problem.run_id,
        problem.solver,
        outcome.variable_count,
        len(candidates),
        outcome.execution_time_ms,
    )

    return {
        "runId": problem.run_id,
        "status": "SUCCEEDED",
        "solver": problem.solver,
        "variableCount": outcome.variable_count,
        "constraintCount": outcome.constraint_count,
        "executionTimeMs": outcome.execution_time_ms,
        "energy": outcome.energies[0] if outcome.energies else None,
        "solverMetrics": outcome.metrics,
        "candidates": [
            {
                "assignments": [
                    {
                        "participantId": a.participant_id,
                        "companyId": a.company_id,
                        "periodId": a.period_id,
                    }
                    for a in c.assignments
                ],
                "score": c.score,
                "scoreBreakdown": c.score_breakdown,
                "violations": c.violations,
                "reasons": c.reasons,
                "energy": c.energy,
            }
            for c in candidates
        ],
    }


def _failed(run_id, message: str) -> dict:
    return {
        "runId": run_id,
        "status": "FAILED",
        "errorMessage": message,
        "candidates": [],
    }
