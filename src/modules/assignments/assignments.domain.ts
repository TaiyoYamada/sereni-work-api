import { ConflictError } from "../../lib/errors";
import type { assignments } from "../../db/schema";

export type Assignment = typeof assignments.$inferSelect;
export type AssignmentStatus = Assignment["status"];

/**
 * 実習割当の状態遷移マシン。
 * DRAFT → PROPOSED → CONFIRMED → IN_PROGRESS → COMPLETED
 * （CANCELLED へは COMPLETED 以外から遷移可能）
 * Web から任意の状態へ直接変更することはできない。遷移は必ずこの表を通す。
 */
const ALLOWED_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  DRAFT: ["PROPOSED", "CONFIRMED", "CANCELLED"],
  PROPOSED: ["CONFIRMED", "DRAFT", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  DRAFT: "下書き",
  PROPOSED: "提案中",
  CONFIRMED: "確定済み",
  IN_PROGRESS: "実習中",
  COMPLETED: "完了",
  CANCELLED: "中止",
};

export function assertTransition(from: AssignmentStatus, to: AssignmentStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(
      `「${STATUS_LABELS[from]}」から「${STATUS_LABELS[to]}」へは変更できません`,
    );
  }
}

/** 内容（期間・実習先など）を編集できる状態か。確定済み以降の直接上書きは禁止 */
export function isEditable(status: AssignmentStatus): boolean {
  return status === "DRAFT" || status === "PROPOSED";
}

/** 期間の重複判定（[start1, end1] と [start2, end2] が1日でも重なるか。date は YYYY-MM-DD 文字列） */
export function periodsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 <= end2 && start2 <= end1;
}
