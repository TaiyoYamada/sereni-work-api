import { supabaseAuthAdmin, type SupabaseAuthAdmin } from "../../lib/clients/supabase-auth-admin";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import type { Staff } from "../../lib/types";
import { staffRepository, type StaffRepository } from "./staff.repository";
import type { CreateStaffInput, ListStaffQuery, UpdateStaffInput } from "./staff.schema";

export async function listStaff(
  query: ListStaffQuery,
  repo: StaffRepository = staffRepository,
): Promise<{ rows: Staff[]; total: number }> {
  return repo.list(query);
}

export async function getStaff(
  id: string,
  repo: StaffRepository = staffRepository,
): Promise<Staff> {
  const member = await repo.findById(id);
  if (!member) throw new NotFoundError("職員が見つかりません");
  return member;
}

/**
 * 職員アカウントの作成。
 * ログインに必要な Supabase Auth ユーザーの発行は inviteStaff（招待メール）で別途行う。
 */
export async function createStaff(
  input: CreateStaffInput,
  repo: StaffRepository = staffRepository,
): Promise<Staff> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new ConflictError("このメールアドレスは既に登録されています");
  return repo.create(input);
}

/**
 * 招待メールを送信して Supabase Auth ユーザーを発行・紐付けする（docs/account-provisioning.md）。
 * 未ログインの職員への再実行は招待メールの再送として動作する（既ログインなら認証側が CONFLICT を返す）。
 */
export async function inviteStaff(
  id: string,
  repo: StaffRepository = staffRepository,
  authAdmin: SupabaseAuthAdmin = supabaseAuthAdmin,
): Promise<Staff> {
  const member = await repo.findById(id);
  if (!member) throw new NotFoundError("職員が見つかりません");
  if (!member.isActive) {
    throw new ConflictError("停止中の職員にアカウントは発行できません");
  }

  const { id: authUserId } = await authAdmin.inviteUserByEmail(member.email);
  const after = await repo.update(id, { authUserId });
  if (!after) throw new NotFoundError("職員が見つかりません");
  return after;
}

export async function updateStaff(
  actor: Staff,
  id: string,
  input: UpdateStaffInput,
  repo: StaffRepository = staffRepository,
): Promise<{ before: Staff; after: Staff }> {
  const before = await repo.findById(id);
  if (!before) throw new NotFoundError("職員が見つかりません");

  // ロックアウト防止: 自分自身のロール変更・停止は不可
  if (actor.id === id) {
    const changesRole = input.role !== undefined && input.role !== before.role;
    const deactivatesSelf = input.isActive === false;
    if (changesRole || deactivatesSelf) {
      throw new AppError("FORBIDDEN", 403, "自分自身のロール変更・アカウント停止はできません");
    }
  }

  const after = await repo.update(id, input);
  if (!after) throw new NotFoundError("職員が見つかりません");
  return { before, after };
}
