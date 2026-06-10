import { describe, expect, it } from "vitest";

import type { Participant, Staff } from "../../lib/types";
import type { AssignmentWithNames } from "../assignments/assignments.schema";
import type { Report } from "./reports.domain";
import { assertReportTransition } from "./reports.domain";
import type { ReportsRepository } from "./reports.repository";
import type { ReportWithName } from "./reports.schema";
import type { ReportsDeps } from "./reports.service";
import { reviewReport, reviseReport, submitMyPreCheck, submitMyReport } from "./reports.service";

const participant = { id: crypto.randomUUID(), name: "利用者", isActive: true } as Participant;
const staff = { id: crypto.randomUUID(), name: "支援員", role: "staff" } as Staff;

function makeReport(overrides: Partial<ReportWithName> = {}): ReportWithName {
  return {
    id: crypto.randomUUID(),
    assignmentId: crypto.randomUUID(),
    participantId: participant.id,
    reportDate: "2026-07-01",
    status: "SUBMITTED",
    workDescription: null,
    didWell: null,
    difficult: null,
    enjoyed: null,
    troubled: null,
    satisfaction: null,
    fatigue: null,
    anxiety: null,
    difficulty: null,
    comfort: null,
    instructionClarity: null,
    wantsToContinue: null,
    accommodationSufficient: null,
    wantsConsultation: false,
    freeText: "原文のテキスト",
    language: "ja",
    clientGeneratedId: crypto.randomUUID(),
    submittedAt: new Date(),
    interviewNeeded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    participantName: participant.name,
    ...overrides,
  };
}

type FakeState = {
  reports: Map<string, ReportWithName>;
  revisions: { reportId: string; reason: string; previousContent: unknown }[];
  preChecks: Map<string, Record<string, unknown>>;
};

function makeDeps(options: {
  reports?: ReportWithName[];
  assignmentStatus?: AssignmentWithNames["status"];
  assignmentParticipantId?: string;
}): { deps: ReportsDeps; state: FakeState } {
  const state: FakeState = {
    reports: new Map((options.reports ?? []).map((r) => [r.id, r])),
    revisions: [],
    preChecks: new Map(),
  };
  const repo: ReportsRepository = {
    async list() {
      return { rows: [...state.reports.values()], total: state.reports.size };
    },
    async findById(id) {
      return state.reports.get(id);
    },
    async findByClientGeneratedId(clientId) {
      return [...state.reports.values()].find((r) => r.clientGeneratedId === clientId);
    },
    async findByAssignmentAndDate(assignmentId, reportDate) {
      return [...state.reports.values()].find(
        (r) => r.assignmentId === assignmentId && r.reportDate === reportDate,
      ) as Report | undefined;
    },
    async create(values) {
      const row = makeReport(values as Partial<ReportWithName>);
      state.reports.set(row.id, row);
      return row;
    },
    async update(id, values) {
      const current = state.reports.get(id);
      if (!current) return undefined;
      const next = { ...current, ...values, updatedAt: new Date() } as ReportWithName;
      state.reports.set(id, next);
      return next;
    },
    async listComments() {
      return [];
    },
    async createComment(values) {
      return { ...values, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
    },
    async createRevision(values) {
      state.revisions.push({
        reportId: values.reportId,
        reason: values.reason,
        previousContent: values.previousContent,
      });
      return { ...values, id: crypto.randomUUID(), createdAt: new Date() };
    },
    async upsertPreCheck(values) {
      const key = `${values.assignmentId}:${values.checkDate}`;
      const existing = state.preChecks.get(key);
      const row = {
        id: existing?.id ?? crypto.randomUUID(),
        condition: null,
        sleep: null,
        fatigue: null,
        anxiety: null,
        motivation: null,
        canParticipate: null,
        wantsConsultation: false,
        accommodationNotes: null,
        ...values,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.preChecks.set(key, row);
      return row as never;
    },
  };
  const deps: ReportsDeps = {
    repo,
    getAssignmentById: async (id: string) =>
      ({
        id,
        participantId: options.assignmentParticipantId ?? participant.id,
        status: options.assignmentStatus ?? "IN_PROGRESS",
      }) as AssignmentWithNames,
  };
  return { deps, state };
}

describe("assertReportTransition", () => {
  it("SUBMITTED → REVIEWED / NEEDS_ACTION は許可、DRAFT → REVIEWED は拒否", () => {
    expect(() => assertReportTransition("SUBMITTED", "REVIEWED")).not.toThrow();
    expect(() => assertReportTransition("SUBMITTED", "NEEDS_ACTION")).not.toThrow();
    expect(() => assertReportTransition("NEEDS_ACTION", "REVIEWED")).not.toThrow();
    expect(() => assertReportTransition("DRAFT", "REVIEWED")).toThrow();
  });
});

describe("submitMyReport（冪等性）", () => {
  const input = {
    assignmentId: crypto.randomUUID(),
    reportDate: "2026-07-01",
    clientGeneratedId: crypto.randomUUID(),
    wantsConsultation: false,
    language: "ja",
    freeText: "今日もがんばりました",
  };

  it("初回は created: true で SUBMITTED として作成", async () => {
    const { deps } = makeDeps({});
    const { report, created } = await submitMyReport(participant, input, deps);
    expect(created).toBe(true);
    expect(report.status).toBe("SUBMITTED");
    expect(report.submittedAt).not.toBeNull();
  });

  it("同じ clientGeneratedId の再送は created: false で既存を返す（重複作成しない）", async () => {
    const { deps, state } = makeDeps({});
    const first = await submitMyReport(participant, input, deps);
    const second = await submitMyReport(participant, input, deps);
    expect(second.created).toBe(false);
    expect(second.report.id).toBe(first.report.id);
    expect(state.reports.size).toBe(1);
  });

  it("他人の実習への提出は FORBIDDEN", async () => {
    const { deps } = makeDeps({ assignmentParticipantId: crypto.randomUUID() });
    await expect(submitMyReport(participant, input, deps)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("実習中でない割当への提出は CONFLICT", async () => {
    const { deps } = makeDeps({ assignmentStatus: "CONFIRMED" });
    await expect(submitMyReport(participant, input, deps)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("同じ日の日報がすでにあれば CONFLICT（別の clientGeneratedId）", async () => {
    const { deps } = makeDeps({});
    await submitMyReport(participant, input, deps);
    await expect(
      submitMyReport(participant, { ...input, clientGeneratedId: crypto.randomUUID() }, deps),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("reviewReport", () => {
  it("SUBMITTED → REVIEWED + 面談フラグ", async () => {
    const report = makeReport();
    const { deps } = makeDeps({ reports: [report] });
    const { after } = await reviewReport(
      report.id,
      { result: "REVIEWED", interviewNeeded: true },
      deps,
    );
    expect(after.status).toBe("REVIEWED");
    expect(after.interviewNeeded).toBe(true);
  });

  it("DRAFT の確認は CONFLICT", async () => {
    const report = makeReport({ status: "DRAFT" });
    const { deps } = makeDeps({ reports: [report] });
    await expect(reviewReport(report.id, { result: "REVIEWED" }, deps)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("reviseReport（原文保持）", () => {
  it("修正前の内容が修正履歴に保存される", async () => {
    const report = makeReport({ freeText: "原文のテキスト" });
    const { deps, state } = makeDeps({ reports: [report] });

    const { after } = await reviseReport(
      staff,
      report.id,
      { reason: "誤字の修正", changes: { freeText: "修正後のテキスト" } },
      deps,
    );

    expect(after.freeText).toBe("修正後のテキスト");
    expect(state.revisions).toHaveLength(1);
    expect(state.revisions[0]!.reason).toBe("誤字の修正");
    expect(state.revisions[0]!.previousContent).toEqual({ freeText: "原文のテキスト" });
  });

  it("提出前（DRAFT）の修正は CONFLICT", async () => {
    const report = makeReport({ status: "DRAFT" });
    const { deps } = makeDeps({ reports: [report] });
    await expect(
      reviseReport(staff, report.id, { reason: "x", changes: { freeText: "y" } }, deps),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("submitMyPreCheck", () => {
  it("自分の実習に提出でき、participantId は本人に固定される", async () => {
    const { deps, state } = makeDeps({ assignmentStatus: "CONFIRMED" });
    await submitMyPreCheck(
      participant,
      {
        assignmentId: crypto.randomUUID(),
        checkDate: "2026-07-01",
        condition: 4,
        wantsConsultation: false,
      },
      deps,
    );
    const saved = [...state.preChecks.values()][0]!;
    expect(saved.participantId).toBe(participant.id);
  });

  it("他人の実習への提出は FORBIDDEN", async () => {
    const { deps } = makeDeps({
      assignmentStatus: "CONFIRMED",
      assignmentParticipantId: crypto.randomUUID(),
    });
    await expect(
      submitMyPreCheck(
        participant,
        { assignmentId: crypto.randomUUID(), checkDate: "2026-07-01", wantsConsultation: false },
        deps,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
