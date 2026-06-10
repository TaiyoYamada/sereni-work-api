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
 * Supabase Auth ユーザーの発行（招待メール）は別途管理画面のフローで行い、
 * 発行後に authUserId が紐付く（auth.users との同期は招待実装時に追加する）。
 */
export async function createStaff(
  input: CreateStaffInput,
  repo: StaffRepository = staffRepository,
): Promise<Staff> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new ConflictError("このメールアドレスは既に登録されています");
  return repo.create(input);
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
