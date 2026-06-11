import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import type { Staff } from "../../lib/types";
import { getCompany } from "../companies/companies.service";
import { getParticipant } from "../participants/participants.service";
import type { Assignment } from "./assignments.domain";
import { assertTransition, isEditable } from "./assignments.domain";
import { assignmentsRepository, type AssignmentsRepository } from "./assignments.repository";
import type {
  AssignmentWithNames,
  CreateAssignmentInput,
  ListAssignmentsQuery,
  UpdateAssignmentInput,
} from "./assignments.schema";

export type AssignmentsDeps = {
  repo: AssignmentsRepository;
  getCompanyById: typeof getCompany;
  getParticipantById: typeof getParticipant;
};

const defaultDeps: AssignmentsDeps = {
  repo: assignmentsRepository,
  getCompanyById: getCompany,
  getParticipantById: getParticipant,
};

export async function listAssignments(
  query: ListAssignmentsQuery,
  deps: AssignmentsDeps = defaultDeps,
): Promise<{ rows: AssignmentWithNames[]; total: number }> {
  return deps.repo.list(query);
}

export async function getAssignment(
  id: string,
  deps: AssignmentsDeps = defaultDeps,
): Promise<AssignmentWithNames> {
  const assignment = await deps.repo.findById(id);
  if (!assignment) throw new NotFoundError("実習割当が見つかりません");
  return assignment;
}

export async function createAssignment(
  input: CreateAssignmentInput,
  deps: AssignmentsDeps = defaultDeps,
): Promise<AssignmentWithNames> {
  const [participant, company] = await Promise.all([
    deps.getParticipantById(input.participantId),
    deps.getCompanyById(input.companyId),
  ]);
  if (!participant.isActive) throw new ConflictError("退所済みの利用者には割当できません");
  if (!company.isActive) throw new ConflictError("受け入れ停止中の企業には割当できません");

  const created = await deps.repo.create({ ...input, status: "DRAFT" });
  return getAssignment(created.id, deps);
}

export async function updateAssignment(
  id: string,
  input: UpdateAssignmentInput,
  deps: AssignmentsDeps = defaultDeps,
): Promise<{ before: AssignmentWithNames; after: AssignmentWithNames }> {
  const before = await getAssignment(id, deps);

  if (!isEditable(before.status)) {
    throw new ConflictError("確定済み以降の割当は直接編集できません（中止・完了の操作を使う）");
  }

  const startDate = input.startDate ?? before.startDate;
  const endDate = input.endDate ?? before.endDate;
  if (endDate < startDate) {
    throw new AppError("VALIDATION_ERROR", 422, "終了日は開始日以降にしてください");
  }

  if (input.participantId && input.participantId !== before.participantId) {
    const participant = await deps.getParticipantById(input.participantId);
    if (!participant.isActive) throw new ConflictError("退所済みの利用者には割当できません");
  }
  if (input.companyId && input.companyId !== before.companyId) {
    const company = await deps.getCompanyById(input.companyId);
    if (!company.isActive) throw new ConflictError("受け入れ停止中の企業には割当できません");
  }

  await deps.repo.update(id, input);
  const after = await getAssignment(id, deps);
  return { before, after };
}

/**
 * 割当確定。
 * 確定前に必ず検証する: 企業の受け入れ定員 / 同一利用者の期間重複。
 * （docs/optimization.md の再検証と同じルールを API 側でも守る）
 */
export async function confirmAssignment(
  actor: Staff,
  id: string,
  deps: AssignmentsDeps = defaultDeps,
): Promise<{ before: AssignmentWithNames; after: AssignmentWithNames }> {
  const before = await getAssignment(id, deps);
  assertTransition(before.status, "CONFIRMED");

  const company = await deps.getCompanyById(before.companyId);
  const occupied = await deps.repo.countOccupyingForCompany(
    before.companyId,
    before.startDate,
    before.endDate,
    id,
  );
  if (occupied >= company.capacity) {
    throw new AppError(
      "ASSIGNMENT_CAPACITY_EXCEEDED",
      409,
      `この期間の受け入れ人数（${company.capacity}名）に達しています`,
    );
  }

  const overlapping = await deps.repo.findOccupyingForParticipant(
    before.participantId,
    before.startDate,
    before.endDate,
    id,
  );
  if (overlapping.length > 0) {
    throw new ConflictError("同一期間に確定済みの実習があるため確定できません");
  }

  await deps.repo.update(id, {
    status: "CONFIRMED",
    confirmedByStaffId: actor.id,
    confirmedAt: new Date(),
  });
  const after = await getAssignment(id, deps);
  return { before, after };
}

async function transition(
  id: string,
  to: Assignment["status"],
  extra: Partial<Parameters<AssignmentsRepository["update"]>[1]>,
  deps: AssignmentsDeps,
): Promise<{ before: AssignmentWithNames; after: AssignmentWithNames }> {
  const before = await getAssignment(id, deps);
  assertTransition(before.status, to);
  await deps.repo.update(id, { status: to, ...extra });
  const after = await getAssignment(id, deps);
  return { before, after };
}

export async function startAssignment(id: string, deps: AssignmentsDeps = defaultDeps) {
  return transition(id, "IN_PROGRESS", {}, deps);
}

/** 企業×期間の占有数（最適化の有効定員計算用。他モジュールから Service 経由で使う） */
export async function getCompanyOccupiedCount(
  companyId: string,
  startDate: string,
  endDate: string,
  deps: AssignmentsDeps = defaultDeps,
): Promise<number> {
  return deps.repo.countOccupyingForCompany(companyId, startDate, endDate);
}

/** 利用者が期間内に確定済み・実習中の割当を持つか（最適化の対象外判定用） */
export async function hasOccupyingAssignment(
  participantId: string,
  startDate: string,
  endDate: string,
  deps: AssignmentsDeps = defaultDeps,
): Promise<boolean> {
  const overlapping = await deps.repo.findOccupyingForParticipant(
    participantId,
    startDate,
    endDate,
  );
  return overlapping.length > 0;
}

export type ProposalItem = {
  participantId: string;
  companyId: string;
  startDate: string;
  endDate: string;
  proposalReason: string;
};

/** 最適化候補の採用: 割当を PROPOSED として一括作成する（確定は通常の confirm フロー） */
export async function proposeAssignments(
  items: ProposalItem[],
  optimizationRunId: string,
  deps: AssignmentsDeps = defaultDeps,
): Promise<AssignmentWithNames[]> {
  const created: AssignmentWithNames[] = [];
  for (const item of items) {
    const row = await deps.repo.create({
      participantId: item.participantId,
      companyId: item.companyId,
      startDate: item.startDate,
      endDate: item.endDate,
      status: "PROPOSED",
      optimizationRunId,
      proposalReason: item.proposalReason,
    });
    created.push(await getAssignment(row.id, deps));
  }
  return created;
}

/** 利用者本人の今日の実習（本人スコープ。実習がない日は null） */
export async function getMyToday(
  participantId: string,
  date: string,
  deps: AssignmentsDeps = defaultDeps,
) {
  const row = await deps.repo.findTodayForParticipant(participantId, date);
  return row ?? null;
}

/** 利用者本人の実習一覧（本人スコープ） */
export async function listMyAssignments(
  participantId: string,
  query: { page: number; perPage: number },
  deps: AssignmentsDeps = defaultDeps,
): Promise<{ rows: AssignmentWithNames[]; total: number }> {
  return deps.repo.list({ ...query, participantId, sort: "startDate", order: "desc" });
}

export async function completeAssignment(id: string, deps: AssignmentsDeps = defaultDeps) {
  return transition(id, "COMPLETED", {}, deps);
}

export async function cancelAssignment(
  id: string,
  reason: string,
  deps: AssignmentsDeps = defaultDeps,
) {
  return transition(id, "CANCELLED", { cancelledReason: reason }, deps);
}
