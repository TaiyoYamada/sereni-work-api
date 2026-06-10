import { ConflictError } from "../../lib/errors";
import type { Staff } from "../../lib/types";
import { getAssignment } from "../assignments/assignments.service";
import { evaluationsRepository, type EvaluationsRepository } from "./evaluations.repository";
import type { Evaluation, EvaluationWithName, UpsertEvaluationInput } from "./evaluations.schema";

export type EvaluationsDeps = {
  repo: EvaluationsRepository;
  getAssignmentById: typeof getAssignment;
};

const defaultDeps: EvaluationsDeps = {
  repo: evaluationsRepository,
  getAssignmentById: getAssignment,
};

export async function listEvaluations(
  assignmentId: string,
  deps: EvaluationsDeps = defaultDeps,
): Promise<EvaluationWithName[]> {
  // 割当の存在確認（存在しなければ NOT_FOUND）
  await deps.getAssignmentById(assignmentId);
  return deps.repo.listByAssignment(assignmentId);
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
