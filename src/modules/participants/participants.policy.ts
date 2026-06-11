import { AppError } from "../../lib/errors";
import type { Participant, Staff } from "../../lib/types";

/**
 * 利用者情報を編集できるか。
 * admin は全利用者、staff は担当利用者のみ。viewer は編集不可（ルート側で拒否済みの前提だがここでも守る）。
 */
export function assertCanEditParticipant(actor: Staff, participant: Participant): void {
  if (actor.role === "admin") return;
  if (actor.role === "staff" && participant.assignedStaffId === actor.id) return;
  throw new AppError("FORBIDDEN", 403, "担当外の利用者は編集できません");
}

/**
 * 利用者のアカウント発行・パスワード再発行ができるか。
 * 編集権限と同じ範囲（admin は全利用者 / staff は担当利用者のみ）。
 */
export function assertCanManageParticipantAccount(actor: Staff, participant: Participant): void {
  if (actor.role === "admin") return;
  if (actor.role === "staff" && participant.assignedStaffId === actor.id) return;
  throw new AppError("FORBIDDEN", 403, "担当外の利用者のアカウントは操作できません");
}
