import { generateInitialPassword, generateLoginId } from "../../lib/account-credentials";
import { supabaseAuthAdmin, type SupabaseAuthAdmin } from "../../lib/clients/supabase-auth-admin";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import type { Participant, Staff } from "../../lib/types";
import { assertCanEditParticipant, assertCanManageParticipantAccount } from "./participants.policy";
import { participantsRepository, type ParticipantsRepository } from "./participants.repository";
import type {
  CreateParticipantInput,
  ListParticipantsQuery,
  UpdateParticipantInput,
} from "./participants.schema";

type AccountDeps = {
  repo?: ParticipantsRepository;
  authAdmin?: SupabaseAuthAdmin;
};

export async function listParticipants(
  query: ListParticipantsQuery,
  repo: ParticipantsRepository = participantsRepository,
): Promise<{ rows: Participant[]; total: number }> {
  return repo.list(query);
}

export async function getParticipant(
  id: string,
  repo: ParticipantsRepository = participantsRepository,
): Promise<Participant> {
  const participant = await repo.findById(id);
  if (!participant) throw new NotFoundError("利用者が見つかりません");
  return participant;
}

export async function getParticipantsByIds(
  ids: string[],
  repo: ParticipantsRepository = participantsRepository,
): Promise<Participant[]> {
  return repo.findByIds(ids);
}

export async function createParticipant(
  input: CreateParticipantInput,
  repo: ParticipantsRepository = participantsRepository,
): Promise<Participant> {
  return repo.create(input);
}

export async function updateParticipant(
  actor: Staff,
  id: string,
  input: UpdateParticipantInput,
  repo: ParticipantsRepository = participantsRepository,
): Promise<{ before: Participant; after: Participant }> {
  const before = await repo.findById(id);
  if (!before) throw new NotFoundError("利用者が見つかりません");

  assertCanEditParticipant(actor, before);

  const after = await repo.update(id, input);
  if (!after) throw new NotFoundError("利用者が見つかりません");
  return { before, after };
}

/**
 * 利用者の認証アカウントを発行する（docs/account-provisioning.md）。
 * 初期パスワードは戻り値で一度だけ返し、以後どこからも取得できない。
 */
export async function issueParticipantAccount(
  actor: Staff,
  id: string,
  deps: AccountDeps = {},
): Promise<{ loginId: string; initialPassword: string }> {
  const { repo = participantsRepository, authAdmin = supabaseAuthAdmin } = deps;

  const participant = await repo.findById(id);
  if (!participant) throw new NotFoundError("利用者が見つかりません");
  assertCanManageParticipantAccount(actor, participant);
  if (participant.authUserId) throw new ConflictError("既にアカウントが発行されています");

  const loginId = participant.email ?? generateLoginId();
  const initialPassword = generateInitialPassword();
  const { id: authUserId } = await authAdmin.createUser({
    email: loginId,
    password: initialPassword,
  });

  const after = await repo.update(id, { authUserId, loginId });
  if (!after) throw new NotFoundError("利用者が見つかりません");

  return { loginId, initialPassword };
}

/**
 * 利用者の初期パスワードを再発行する。新しいパスワードは戻り値で一度だけ返す。
 */
export async function resetParticipantAccountPassword(
  actor: Staff,
  id: string,
  deps: AccountDeps = {},
): Promise<{ loginId: string; initialPassword: string }> {
  const { repo = participantsRepository, authAdmin = supabaseAuthAdmin } = deps;

  const participant = await repo.findById(id);
  if (!participant) throw new NotFoundError("利用者が見つかりません");
  assertCanManageParticipantAccount(actor, participant);
  if (!participant.authUserId) throw new ConflictError("アカウントが発行されていません");

  const loginId = participant.loginId ?? participant.email;
  if (!loginId) {
    // 発行フローを通っていれば必ず loginId がある。欠損はデータ異常として早期に検知する
    throw new AppError("INTERNAL_ERROR", 500, "ログインIDが見つかりません");
  }

  const initialPassword = generateInitialPassword();
  await authAdmin.updateUserPassword(participant.authUserId, initialPassword);

  return { loginId, initialPassword };
}
