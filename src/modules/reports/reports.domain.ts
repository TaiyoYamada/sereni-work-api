import { ConflictError } from "../../lib/errors";
import type { reports } from "../../db/schema";

export type Report = typeof reports.$inferSelect;
export type ReportStatus = Report["status"];

/**
 * 日報の状態遷移マシン。
 * DRAFT → SUBMITTED → REVIEWED / NEEDS_ACTION、NEEDS_ACTION → REVIEWED（対応完了）
 */
const ALLOWED_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["REVIEWED", "NEEDS_ACTION"],
  NEEDS_ACTION: ["REVIEWED"],
  REVIEWED: ["NEEDS_ACTION"],
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済み",
  REVIEWED: "確認済み",
  NEEDS_ACTION: "要対応",
};

export function assertReportTransition(from: ReportStatus, to: ReportStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(
      `「${STATUS_LABELS[from]}」から「${STATUS_LABELS[to]}」へは変更できません`,
    );
  }
}

/** 支援員が修正できる本文フィールド（原文は上書きせず修正履歴に残す対象） */
export const REVISABLE_FIELDS = [
  "workDescription",
  "didWell",
  "difficult",
  "enjoyed",
  "troubled",
  "freeText",
] as const;

export type RevisableField = (typeof REVISABLE_FIELDS)[number];
