import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import {
  invokeOptimizer,
  type OptimizerCandidate,
  type OptimizerInvoker,
  type OptimizerRequest,
} from "../../lib/clients/optimizer";
import type { Participant, Staff } from "../../lib/types";
import {
  getCompanyOccupiedCount,
  hasOccupyingAssignment,
  proposeAssignments,
} from "../assignments/assignments.service";
import { getCompaniesByIds, type Company } from "../companies/companies.service";
import { getParticipantsByIds } from "../participants/participants.service";
import { optimizationRepository, type OptimizationRepository } from "./optimization.repository";
import type { CreateRunInput, OptimizationRun, StoredCandidate } from "./optimization.schema";

export type OptimizationDeps = {
  repo: OptimizationRepository;
  invoker: OptimizerInvoker;
  getParticipants: typeof getParticipantsByIds;
  getCompanies: typeof getCompaniesByIds;
  getOccupiedCount: typeof getCompanyOccupiedCount;
  isParticipantBusy: typeof hasOccupyingAssignment;
  propose: typeof proposeAssignments;
};

const defaultDeps: OptimizationDeps = {
  repo: optimizationRepository,
  invoker: invokeOptimizer,
  getParticipants: getParticipantsByIds,
  getCompanies: getCompaniesByIds,
  getOccupiedCount: getCompanyOccupiedCount,
  isParticipantBusy: hasOccupyingAssignment,
  propose: proposeAssignments,
};

/** 提案理由コード → 業務用語（個人情報を持たない optimizer はコードのみ返す） */
const REASON_LABELS: Record<string, string> = {
  ACCOMMODATION_OK: "必要な配慮に対応可能",
  DESIRE_MATCH: "希望職種と一致",
  SKILL_MATCH: "必要スキルを満たす",
  NEW_EXPERIENCE: "未経験の実習先を体験できる",
  FAIRNESS_FIRST_TIMER: "実習機会の公平性（初めての実習）",
};

const PERIOD_ID = "t0";

/** 希望職種との一致度（項目確定までの暫定ロジック。部分一致を許容する） */
export function desireMatchScore(participant: Participant, company: Company): number {
  if (participant.desiredOccupations.length === 0) return 0.3; // 希望未登録は中立より弱い
  const industry = company.industry ?? "";
  const description = company.internshipDescription ?? "";
  for (const occupation of participant.desiredOccupations) {
    if (industry !== "" && (industry.includes(occupation) || occupation.includes(industry))) {
      return 1.0;
    }
    if (description.includes(occupation)) return 0.7;
  }
  return 0.0;
}

/** スキル一致度（必要スキルが未設定の企業は中立 0.5） */
export function skillMatchScore(participant: Participant, company: Company): number {
  if (company.requiredSkills.length === 0) return 0.5;
  const matched = company.requiredSkills.filter((skill) =>
    participant.skills.includes(skill),
  ).length;
  return matched / company.requiredSkills.length;
}

/** 必要な配慮にすべて対応できるか（ハード制約） */
export function accommodationsSupported(participant: Participant, company: Company): boolean {
  return participant.accommodations.every((item) => company.supportedAccommodations.includes(item));
}

/**
 * 最適化の実行。
 * 1. 対象データを取得し匿名 ID + 数値特徴へ変換（個人情報は optimizer へ渡さない）
 * 2. optimizer を呼び出す
 * 3. 結果を実 ID へ復元し、サーバー側で独立に再検証する（未検証のまま保存しない）
 * 4. 実行履歴として保存する
 */
export async function runOptimization(
  actor: Staff,
  input: CreateRunInput,
  deps: OptimizationDeps = defaultDeps,
): Promise<OptimizationRun> {
  // 実機は管理者のみ（docs/optimization.md）
  if (input.solver === "dwave" && actor.role !== "admin") {
    throw new AppError("FORBIDDEN", 403, "量子アニーリング実機は管理者のみ利用できます");
  }

  const [participants, companies] = await Promise.all([
    deps.getParticipants(input.participantIds),
    deps.getCompanies(input.companyIds),
  ]);
  if (participants.length !== input.participantIds.length) {
    throw new NotFoundError("存在しない利用者が含まれています");
  }
  if (companies.length !== input.companyIds.length) {
    throw new NotFoundError("存在しない企業が含まれています");
  }
  const activeParticipants = participants.filter((p) => p.isActive);
  const activeCompanies = companies.filter((c) => c.isActive);
  if (activeParticipants.length === 0 || activeCompanies.length === 0) {
    throw new ConflictError("対象にできる利用者・企業がありません（退所・停止中を除く）");
  }

  const weights = {
    desire: input.weights?.desire ?? 1.0,
    skill: input.weights?.skill ?? 0.8,
    fairness: input.weights?.fairness ?? 0.5,
    rotation: input.weights?.rotation ?? 0.3,
  };

  const run = await deps.repo.create({
    executedByStaffId: actor.id,
    status: "PENDING",
    periodStart: new Date(`${input.periodStart}T00:00:00+09:00`),
    periodEnd: new Date(`${input.periodEnd}T00:00:00+09:00`),
    participantIds: activeParticipants.map((p) => p.id),
    companyIds: activeCompanies.map((c) => c.id),
    solver: input.solver,
    problemVersion: "v1",
    quboVersion: "v1",
    weights,
    randomSeed: input.seed ?? null,
    numReads: input.numReads ?? null,
  });

  try {
    const request = await buildRequest(
      run.id,
      input,
      weights,
      activeParticipants,
      activeCompanies,
      deps,
    );
    await deps.repo.update(run.id, { status: "RUNNING" });
    const response = await deps.invoker(request.payload);

    if (response.status === "FAILED") {
      const failed = await deps.repo.update(run.id, {
        status: "FAILED",
        errorMessage: response.errorMessage,
      });
      return failed!;
    }

    // 実 ID へ復元 + サーバー側の独立再検証
    const stored = response.candidates.map((candidate) =>
      toStoredCandidate(candidate, input, request.maps, activeParticipants, activeCompanies),
    );
    const bestViolations = stored[0]?.violations.length ?? 0;

    const succeeded = await deps.repo.update(run.id, {
      status: "SUCCEEDED",
      variableCount: response.variableCount,
      constraintCount: response.constraintCount,
      executionTimeMs: response.executionTimeMs,
      energy: response.energy,
      violationCount: bestViolations,
      solverMetrics: response.solverMetrics ?? {},
      candidates: stored,
    });
    return succeeded!;
  } catch (error) {
    const message =
      error instanceof AppError ? error.message : "最適化の実行中にエラーが発生しました";
    await deps.repo.update(run.id, { status: "FAILED", errorMessage: message });
    if (error instanceof AppError) throw error;
    throw new AppError("OPTIMIZATION_FAILED", 502, message);
  }
}

type IdMaps = {
  participantByAnon: Map<string, Participant>;
  companyByAnon: Map<string, Company>;
};

async function buildRequest(
  runId: string,
  input: CreateRunInput,
  weights: OptimizerRequest["weights"],
  participants: Participant[],
  companies: Company[],
  deps: OptimizationDeps,
): Promise<{ payload: OptimizerRequest; maps: IdMaps }> {
  const participantAnonIds = new Map(participants.map((p, index) => [p.id, `p${index}`]));
  const companyAnonIds = new Map(companies.map((c, index) => [c.id, `c${index}`]));

  const history = await deps.repo.getParticipantHistory(participants.map((p) => p.id));
  const pastCounts = new Map<string, number>();
  const pastCompanies = new Map<string, Set<string>>();
  for (const record of history) {
    pastCounts.set(record.participantId, (pastCounts.get(record.participantId) ?? 0) + 1);
    const companySet = pastCompanies.get(record.participantId) ?? new Set<string>();
    companySet.add(record.companyId);
    pastCompanies.set(record.participantId, companySet);
  }

  // 有効定員 = 登録定員 - 期間内の確定済み・実習中の件数
  const capacities = new Map<string, number>();
  for (const company of companies) {
    const occupied = await deps.getOccupiedCount(company.id, input.periodStart, input.periodEnd);
    capacities.set(company.id, Math.max(0, company.capacity - occupied));
  }

  const payloadParticipants = [];
  for (const participant of participants) {
    const anonId = participantAnonIds.get(participant.id)!;
    // 確定済み割当と競合する利用者は期間ごと対象外（unavailable）にする
    const busy = await deps.isParticipantBusy(participant.id, input.periodStart, input.periodEnd);
    payloadParticipants.push({
      id: anonId,
      desireMatch: Object.fromEntries(
        companies.map((c) => [companyAnonIds.get(c.id)!, desireMatchScore(participant, c)]),
      ),
      skillMatch: Object.fromEntries(
        companies.map((c) => [companyAnonIds.get(c.id)!, skillMatchScore(participant, c)]),
      ),
      accommodationOk: Object.fromEntries(
        companies.map((c) => [companyAnonIds.get(c.id)!, accommodationsSupported(participant, c)]),
      ),
      unavailablePeriods: busy ? [PERIOD_ID] : [],
      pastAssignmentCount: pastCounts.get(participant.id) ?? 0,
      pastCompanyIds: [...(pastCompanies.get(participant.id) ?? [])].map(
        (companyId) => companyAnonIds.get(companyId) ?? "external",
      ),
    });
  }

  const payload: OptimizerRequest = {
    runId,
    solver: input.solver,
    seed: input.seed,
    numReads: input.numReads,
    maxCandidates: input.maxCandidates,
    periods: [PERIOD_ID],
    participants: payloadParticipants,
    companies: companies.map((c) => ({
      id: companyAnonIds.get(c.id)!,
      capacity: { [PERIOD_ID]: capacities.get(c.id) ?? 0 },
    })),
    weights,
  };

  return {
    payload,
    maps: {
      participantByAnon: new Map(participants.map((p) => [participantAnonIds.get(p.id)!, p])),
      companyByAnon: new Map(companies.map((c) => [companyAnonIds.get(c.id)!, c])),
    },
  };
}

/** optimizer の候補を実 ID へ復元し、サーバー側でも制約を再検証する */
function toStoredCandidate(
  candidate: OptimizerCandidate,
  input: CreateRunInput,
  maps: IdMaps,
  participants: Participant[],
  companies: Company[],
): StoredCandidate {
  const violations: string[] = candidate.violations.map((v) => JSON.stringify(v));

  const reasonsByPair = new Map(
    candidate.reasons.map((reason) => [
      `${reason.participantId}|${reason.companyId}`,
      reason.codes.map((code) => REASON_LABELS[code] ?? code),
    ]),
  );

  const assignments = candidate.assignments.map((assignment) => {
    const participant = maps.participantByAnon.get(assignment.participantId);
    const company = maps.companyByAnon.get(assignment.companyId);
    if (!participant || !company) {
      violations.push(`UNKNOWN_ID:${assignment.participantId}/${assignment.companyId}`);
    }
    return {
      participantId: participant?.id ?? assignment.participantId,
      participantName: participant?.name ?? "不明",
      companyId: company?.id ?? assignment.companyId,
      companyName: company?.name ?? "不明",
      startDate: input.periodStart,
      endDate: input.periodEnd,
      reasons: reasonsByPair.get(`${assignment.participantId}|${assignment.companyId}`) ?? [],
    };
  });

  // 独立再検証: 二重割当 / 配慮対応 / 定員（optimizer を信用しない）
  const byParticipant = new Map<string, number>();
  const byCompany = new Map<string, number>();
  for (const assignment of assignments) {
    byParticipant.set(
      assignment.participantId,
      (byParticipant.get(assignment.participantId) ?? 0) + 1,
    );
    byCompany.set(assignment.companyId, (byCompany.get(assignment.companyId) ?? 0) + 1);

    const participant = participants.find((p) => p.id === assignment.participantId);
    const company = companies.find((c) => c.id === assignment.companyId);
    if (participant && company && !accommodationsSupported(participant, company)) {
      violations.push(`SERVER_ACCOMMODATION_NG:${assignment.participantName}`);
    }
  }
  for (const [participantId, assignedCount] of byParticipant) {
    if (assignedCount > 1) violations.push(`SERVER_DUPLICATE:${participantId}`);
  }
  for (const [companyId, assignedCount] of byCompany) {
    const company = companies.find((c) => c.id === companyId);
    if (company && assignedCount > company.capacity) {
      violations.push(`SERVER_CAPACITY:${company.name}`);
    }
  }

  return {
    assignments,
    score: candidate.score,
    scoreBreakdown: candidate.scoreBreakdown,
    violations,
    energy: candidate.energy,
  };
}

export async function getRun(
  id: string,
  deps: OptimizationDeps = defaultDeps,
): Promise<OptimizationRun> {
  const run = await deps.repo.findById(id);
  if (!run) throw new NotFoundError("最適化実行が見つかりません");
  return run;
}

export async function listRuns(
  query: { page: number; perPage: number },
  deps: OptimizationDeps = defaultDeps,
): Promise<{ rows: OptimizationRun[]; total: number }> {
  return deps.repo.list(query);
}

/** 候補の採用: 割当を PROPOSED として作成する。制約違反のある候補は採用できない */
export async function adoptCandidate(
  runId: string,
  candidateIndex: number,
  deps: OptimizationDeps = defaultDeps,
): Promise<OptimizationRun> {
  const run = await getRun(runId, deps);
  if (run.status !== "SUCCEEDED") {
    throw new ConflictError("成功した最適化実行の候補のみ採用できます");
  }
  const candidates = (run.candidates as StoredCandidate[] | null) ?? [];
  const candidate = candidates[candidateIndex];
  if (!candidate) throw new NotFoundError("指定された候補が見つかりません");
  if (candidate.violations.length > 0) {
    throw new ConflictError("制約違反のある候補は採用できません");
  }
  if (run.selectedCandidate) {
    throw new ConflictError("この実行の候補はすでに採用されています");
  }

  await deps.propose(
    candidate.assignments.map((assignment) => ({
      participantId: assignment.participantId,
      companyId: assignment.companyId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      proposalReason: assignment.reasons.join("、"),
    })),
    run.id,
  );

  const updated = await deps.repo.update(run.id, { selectedCandidate: candidate });
  return updated!;
}
