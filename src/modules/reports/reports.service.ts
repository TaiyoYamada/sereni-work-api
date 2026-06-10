import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import type { Participant, Staff } from "../../lib/types";
import { getAssignment } from "../assignments/assignments.service";
import type { Report, RevisableField } from "./reports.domain";
import { assertReportTransition, REVISABLE_FIELDS } from "./reports.domain";
import { reportsRepository, type ReportsRepository } from "./reports.repository";
import type {
  ListReportsQuery,
  ReportWithName,
  ReviewReportInput,
  ReviseReportInput,
  SubmitMyPreCheckInput,
  SubmitMyReportInput,
} from "./reports.schema";

export type ReportsDeps = {
  repo: ReportsRepository;
  getAssignmentById: typeof getAssignment;
};

const defaultDeps: ReportsDeps = {
  repo: reportsRepository,
  getAssignmentById: getAssignment,
};

export async function listReports(
  query: ListReportsQuery,
  deps: ReportsDeps = defaultDeps,
): Promise<{ rows: ReportWithName[]; total: number }> {
  return deps.repo.list(query);
}

export async function getReport(
  id: string,
  deps: ReportsDeps = defaultDeps,
): Promise<ReportWithName> {
  const report = await deps.repo.findById(id);
  if (!report) throw new NotFoundError("日報が見つかりません");
  return report;
}

/** 支援員の確認操作（提出済み → 確認済み / 要対応、要対応 → 確認済み） */
export async function reviewReport(
  id: string,
  input: ReviewReportInput,
  deps: ReportsDeps = defaultDeps,
): Promise<{ before: ReportWithName; after: ReportWithName }> {
  const before = await getReport(id, deps);
  assertReportTransition(before.status, input.result);
  await deps.repo.update(id, {
    status: input.result,
    ...(input.interviewNeeded !== undefined ? { interviewNeeded: input.interviewNeeded } : {}),
  });
  const after = await getReport(id, deps);
  return { before, after };
}

/**
 * 支援員による本文修正。
 * 原文は上書きで消えるが、修正前の内容・修正者・理由を必ず修正履歴に保存する。
 * （最初の提出内容は修正履歴を遡れば必ず復元できる）
 */
export async function reviseReport(
  actor: Staff,
  id: string,
  input: ReviseReportInput,
  deps: ReportsDeps = defaultDeps,
): Promise<{ before: ReportWithName; after: ReportWithName }> {
  const before = await getReport(id, deps);
  if (before.status === "DRAFT") {
    throw new ConflictError("提出前の日報は修正できません（本人が編集中です）");
  }

  const previousContent: Partial<Record<RevisableField, string | null>> = {};
  for (const field of REVISABLE_FIELDS) {
    if (input.changes[field] !== undefined) {
      previousContent[field] = before[field];
    }
  }

  await deps.repo.createRevision({
    reportId: id,
    revisedByStaffId: actor.id,
    reason: input.reason,
    previousContent,
  });
  await deps.repo.update(id, input.changes);
  const after = await getReport(id, deps);
  return { before, after };
}

export async function addComment(
  actor: Staff,
  reportId: string,
  body: string,
  deps: ReportsDeps = defaultDeps,
) {
  const report = await getReport(reportId, deps);
  if (report.status === "DRAFT") {
    throw new ConflictError("提出前の日報にはコメントできません");
  }
  return deps.repo.createComment({ reportId, staffId: actor.id, body });
}

export async function getReportComments(reportId: string, deps: ReportsDeps = defaultDeps) {
  return deps.repo.listComments(reportId);
}

/**
 * 利用者本人の日報提出（iOS）。
 * clientGeneratedId による冪等処理: 同じ ID の再送は新規作成せず既存を返す（オフライン再送対応）。
 */
export async function submitMyReport(
  actor: Participant,
  input: SubmitMyReportInput,
  deps: ReportsDeps = defaultDeps,
): Promise<{ report: Report; created: boolean }> {
  const existing = await deps.repo.findByClientGeneratedId(input.clientGeneratedId);
  if (existing) {
    if (existing.participantId !== actor.id) {
      throw new AppError("FORBIDDEN", 403, "この日報にはアクセスできません");
    }
    return { report: existing, created: false };
  }

  const assignment = await deps.getAssignmentById(input.assignmentId);
  if (assignment.participantId !== actor.id) {
    throw new AppError("FORBIDDEN", 403, "自分の実習の日報のみ提出できます");
  }
  if (assignment.status !== "IN_PROGRESS" && assignment.status !== "COMPLETED") {
    throw new ConflictError("実習中または完了した実習の日報のみ提出できます");
  }

  const duplicate = await deps.repo.findByAssignmentAndDate(input.assignmentId, input.reportDate);
  if (duplicate) {
    throw new ConflictError("この日の日報はすでに提出されています");
  }

  const report = await deps.repo.create({
    ...input,
    participantId: actor.id,
    status: "SUBMITTED",
    submittedAt: new Date(),
  });
  return { report, created: true };
}

/** 利用者本人の日報一覧（本人スコープ。他人のデータは構造的に取得不能） */
export async function listMyReports(
  actor: Participant,
  query: { page: number; perPage: number },
  deps: ReportsDeps = defaultDeps,
): Promise<{ rows: ReportWithName[]; total: number }> {
  return deps.repo.list({ ...query, participantId: actor.id });
}

/** 利用者本人の実習前チェック提出（同日2回目は上書き） */
export async function submitMyPreCheck(
  actor: Participant,
  input: SubmitMyPreCheckInput,
  deps: ReportsDeps = defaultDeps,
) {
  const assignment = await deps.getAssignmentById(input.assignmentId);
  if (assignment.participantId !== actor.id) {
    throw new AppError("FORBIDDEN", 403, "自分の実習のチェックのみ提出できます");
  }
  if (assignment.status !== "CONFIRMED" && assignment.status !== "IN_PROGRESS") {
    throw new ConflictError("確定済みまたは実習中の実習のみチェックを提出できます");
  }
  return deps.repo.upsertPreCheck({ ...input, participantId: actor.id });
}
