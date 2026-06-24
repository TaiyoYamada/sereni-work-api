import { AppError, NotFoundError } from "../../lib/errors";
import type { Staff } from "../../lib/types";
import { getParticipant } from "../participants/participants.service";
import { reflectionsRepository, type ReflectionsRepository } from "./reflections.repository";
import type {
  CreateReflectionInput,
  Reflection,
  ReflectionWithName,
  UpdateReflectionInput,
} from "./reflections.schema";

/** 記録者本人または管理者のみ編集・削除できる */
function assertCanModify(actor: Staff, reflection: Reflection): void {
  if (actor.role !== "admin" && actor.id !== reflection.staffId) {
    throw new AppError("FORBIDDEN", 403, "この振り返り記録を変更する権限がありません");
  }
}

export type ReflectionsDeps = {
  repo: ReflectionsRepository;
  getParticipantById: typeof getParticipant;
};

const defaultDeps: ReflectionsDeps = {
  repo: reflectionsRepository,
  getParticipantById: getParticipant,
};

/** 利用者の振り返り記録一覧。存在しない利用者は NOT_FOUND */
export async function listReflections(
  participantId: string,
  deps: ReflectionsDeps = defaultDeps,
): Promise<ReflectionWithName[]> {
  await deps.getParticipantById(participantId);
  return deps.repo.listByParticipant(participantId);
}

/** 振り返り記録を作成する。記録者は actor。存在しない利用者は NOT_FOUND */
export async function createReflection(
  actor: Staff,
  input: CreateReflectionInput,
  deps: ReflectionsDeps = defaultDeps,
): Promise<Reflection> {
  await deps.getParticipantById(input.participantId);
  return deps.repo.create({ ...input, staffId: actor.id });
}

/** 振り返り記録を更新する。記録者本人または管理者のみ。存在しなければ NOT_FOUND */
export async function updateReflection(
  actor: Staff,
  id: string,
  input: UpdateReflectionInput,
  deps: ReflectionsDeps = defaultDeps,
): Promise<ReflectionWithName> {
  const existing = await deps.repo.findById(id);
  if (!existing) throw new NotFoundError("振り返り記録が見つかりません");
  assertCanModify(actor, existing);
  await deps.repo.update(id, input);
  const updated = await deps.repo.findByIdWithName(id);
  if (!updated) throw new NotFoundError("振り返り記録が見つかりません");
  return updated;
}

/** 振り返り記録を削除する。記録者本人または管理者のみ。存在しなければ NOT_FOUND */
export async function deleteReflection(
  actor: Staff,
  id: string,
  deps: ReflectionsDeps = defaultDeps,
): Promise<void> {
  const existing = await deps.repo.findById(id);
  if (!existing) throw new NotFoundError("振り返り記録が見つかりません");
  assertCanModify(actor, existing);
  await deps.repo.remove(id);
}
