import { ConflictError } from "../../lib/errors";
import type { Staff } from "../../lib/types";
import { getAssignment } from "../assignments/assignments.service";
import { getParticipant } from "../participants/participants.service";
import { evaluationsRepository, type EvaluationsRepository } from "./evaluations.repository";
import type {
  Evaluation,
  EvaluationWithName,
  ParticipantGrowthPoint,
  UpsertEvaluationInput,
} from "./evaluations.schema";

export type EvaluationsDeps = {
  repo: EvaluationsRepository;
  getAssignmentById: typeof getAssignment;
  getParticipantById: typeof getParticipant;
};

const defaultDeps: EvaluationsDeps = {
  repo: evaluationsRepository,
  getAssignmentById: getAssignment,
  getParticipantById: getParticipant,
};

export async function listEvaluations(
  assignmentId: string,
  deps: EvaluationsDeps = defaultDeps,
): Promise<EvaluationWithName[]> {
  // 割当の存在確認（存在しなければ NOT_FOUND）
  await deps.getAssignmentById(assignmentId);
  return deps.repo.listByAssignment(assignmentId);
}

/** 利用者の成長（実習ごとの評価の時系列）。存在しない利用者は NOT_FOUND */
export async function getParticipantGrowth(
  participantId: string,
  deps: EvaluationsDeps = defaultDeps,
): Promise<ParticipantGrowthPoint[]> {
  await deps.getParticipantById(participantId);
  return deps.repo.listParticipantGrowth(participantId);
}

/** 自分の評価を登録・更新する（評価できるのは実習中・完了した割当のみ） */
export async function upsertMyEvaluation(
  actor: Staff,
  input: UpsertEvaluationInput,
  deps: EvaluationsDeps = defaultDeps,
): Promise<Evaluation> {
  const assignment = await deps.getAssignmentById(input.assignmentId);
  if (assignment.status !== "IN_PROGRESS" && assignment.status !== "COMPLETED") {
    throw new ConflictError("実習中または完了した実習のみ評価できます");
  }
  return deps.repo.upsert({ ...input, staffId: actor.id });
}
