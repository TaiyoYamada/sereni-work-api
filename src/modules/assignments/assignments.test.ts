import { describe, expect, it } from "vitest";

import type { Participant, Staff } from "../../lib/types";
import type { Company } from "../companies/companies.schema";
import type { Assignment, AssignmentStatus } from "./assignments.domain";
import { assertTransition, periodsOverlap } from "./assignments.domain";
import type { AssignmentsRepository } from "./assignments.repository";
import type { AssignmentWithNames } from "./assignments.schema";
import type { AssignmentsDeps } from "./assignments.service";
import {
  cancelAssignment,
  completeAssignment,
  confirmAssignment,
  createAssignment,
  startAssignment,
  updateAssignment,
} from "./assignments.service";

function makeAssignment(overrides: Partial<AssignmentWithNames> = {}): AssignmentWithNames {
  return {
    id: crypto.randomUUID(),
    participantId: crypto.randomUUID(),
    companyId: crypto.randomUUID(),
    startDate: "2026-07-01",
    endDate: "2026-07-05",
    status: "DRAFT",
    meetingPlace: null,
    goal: null,
    optimizationRunId: null,
    proposalReason: null,
    confirmedByStaffId: null,
    confirmedAt: null,
    cancelledReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    participantName: "利用者",
    companyName: "企業",
    ...overrides,
  };
}

function makeDeps(options: {
  assignments?: AssignmentWithNames[];
  capacity?: number;
  occupyingCount?: number;
  participantOverlaps?: Assignment[];
  participantActive?: boolean;
  companyActive?: boolean;
}): AssignmentsDeps {
  const store = new Map((options.assignments ?? []).map((a) => [a.id, a]));
  const repo: AssignmentsRepository = {
    async list() {
      return { rows: [...store.values()], total: store.size };
    },
    async findById(id) {
      return store.get(id);
    },
    async create(values) {
      const row = makeAssignment(values as Partial<AssignmentWithNames>);
      store.set(row.id, row);
      return row;
    },
    async update(id, values) {
      const current = store.get(id);
      if (!current) return undefined;
      const next = { ...current, ...values, updatedAt: new Date() } as AssignmentWithNames;
      store.set(id, next);
      return next;
    },
    async countOccupyingForCompany() {
      return options.occupyingCount ?? 0;
    },
    async findOccupyingForParticipant() {
      return options.participantOverlaps ?? [];
    },
    async findTodayForParticipant() {
      return undefined;
    },
  };
  return {
    repo,
    getCompanyById: async (id: string) =>
      ({
        id,
        name: "企業",
        capacity: options.capacity ?? 2,
        isActive: options.companyActive ?? true,
      }) as Company,
    getParticipantById: async (id: string) =>
      ({ id, name: "利用者", isActive: options.participantActive ?? true }) as Participant,
  };
}

const admin = { id: crypto.randomUUID(), role: "admin" } as Staff;

describe("assertTransition", () => {
  it.each<[AssignmentStatus, AssignmentStatus]>([
    ["DRAFT", "CONFIRMED"],
    ["DRAFT", "PROPOSED"],
    ["PROPOSED", "CONFIRMED"],
    ["CONFIRMED", "IN_PROGRESS"],
    ["IN_PROGRESS", "COMPLETED"],
    ["IN_PROGRESS", "CANCELLED"],
  ])("%s → %s は許可", (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each<[AssignmentStatus, AssignmentStatus]>([
    ["DRAFT", "IN_PROGRESS"],
    ["DRAFT", "COMPLETED"],
    ["CONFIRMED", "COMPLETED"],
    ["COMPLETED", "CANCELLED"],
    ["CANCELLED", "CONFIRMED"],
    ["COMPLETED", "IN_PROGRESS"],
  ])("%s → %s は CONFLICT", (from, to) => {
    expect(() => assertTransition(from, to)).toThrow();
  });
});

describe("periodsOverlap", () => {
  it("重なる期間を検出する", () => {
    expect(periodsOverlap("2026-07-01", "2026-07-05", "2026-07-05", "2026-07-10")).toBe(true);
    expect(periodsOverlap("2026-07-01", "2026-07-05", "2026-07-06", "2026-07-10")).toBe(false);
  });
});

describe("createAssignment", () => {
  it("DRAFT として作成される", async () => {
    const deps = makeDeps({});
    const created = await createAssignment(
      {
        participantId: crypto.randomUUID(),
        companyId: crypto.randomUUID(),
        startDate: "2026-07-01",
        endDate: "2026-07-05",
      },
      deps,
    );
    expect(created.status).toBe("DRAFT");
  });

  it("退所済み利用者には割当できない", async () => {
    const deps = makeDeps({ participantActive: false });
    await expect(
      createAssignment(
        {
          participantId: crypto.randomUUID(),
          companyId: crypto.randomUUID(),
          startDate: "2026-07-01",
          endDate: "2026-07-05",
        },
        deps,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("confirmAssignment", () => {
  it("DRAFT から確定でき、確定者と日時が記録される", async () => {
    const assignment = makeAssignment();
    const deps = makeDeps({ assignments: [assignment] });
    const { after } = await confirmAssignment(admin, assignment.id, deps);
    expect(after.status).toBe("CONFIRMED");
    expect(after.confirmedByStaffId).toBe(admin.id);
    expect(after.confirmedAt).not.toBeNull();
  });

  it("定員に達している場合は ASSIGNMENT_CAPACITY_EXCEEDED", async () => {
    const assignment = makeAssignment();
    const deps = makeDeps({ assignments: [assignment], capacity: 2, occupyingCount: 2 });
    await expect(confirmAssignment(admin, assignment.id, deps)).rejects.toMatchObject({
      code: "ASSIGNMENT_CAPACITY_EXCEEDED",
    });
  });

  it("同一利用者の期間重複がある場合は CONFLICT", async () => {
    const assignment = makeAssignment();
    const deps = makeDeps({
      assignments: [assignment],
      participantOverlaps: [makeAssignment({ status: "CONFIRMED" })],
    });
    await expect(confirmAssignment(admin, assignment.id, deps)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("確定済みをもう一度確定しようとすると CONFLICT", async () => {
    const assignment = makeAssignment({ status: "CONFIRMED" });
    const deps = makeDeps({ assignments: [assignment] });
    await expect(confirmAssignment(admin, assignment.id, deps)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("updateAssignment", () => {
  it("確定済みの割当は直接編集できない", async () => {
    const assignment = makeAssignment({ status: "CONFIRMED" });
    const deps = makeDeps({ assignments: [assignment] });
    await expect(updateAssignment(assignment.id, { goal: "変更" }, deps)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("期間が逆転する更新は VALIDATION_ERROR", async () => {
    const assignment = makeAssignment();
    const deps = makeDeps({ assignments: [assignment] });
    await expect(
      updateAssignment(assignment.id, { endDate: "2026-06-01" }, deps),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("start / complete / cancel", () => {
  it("CONFIRMED → start → IN_PROGRESS → complete → COMPLETED", async () => {
    const assignment = makeAssignment({ status: "CONFIRMED" });
    const deps = makeDeps({ assignments: [assignment] });
    const started = await startAssignment(assignment.id, deps);
    expect(started.after.status).toBe("IN_PROGRESS");
    const completed = await completeAssignment(assignment.id, deps);
    expect(completed.after.status).toBe("COMPLETED");
  });

  it("DRAFT を start すると CONFLICT", async () => {
    const assignment = makeAssignment();
    const deps = makeDeps({ assignments: [assignment] });
    await expect(startAssignment(assignment.id, deps)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("cancel は理由が保存される。COMPLETED は中止できない", async () => {
    const active = makeAssignment({ status: "IN_PROGRESS" });
    const done = makeAssignment({ status: "COMPLETED" });
    const deps = makeDeps({ assignments: [active, done] });

    const { after } = await cancelAssignment(active.id, "体調不良のため", deps);
    expect(after.status).toBe("CANCELLED");
    expect(after.cancelledReason).toBe("体調不良のため");

    await expect(cancelAssignment(done.id, "誤操作", deps)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
