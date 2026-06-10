import { describe, expect, it } from "vitest";

import { AppError } from "../../lib/errors";
import type { Participant, Staff } from "../../lib/types";
import { assertCanEditParticipant } from "./participants.policy";
import type { ParticipantsRepository } from "./participants.repository";
import { getParticipant, updateParticipant } from "./participants.service";

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: crypto.randomUUID(),
    authUserId: null,
    name: "職員",
    email: "staff@example.com",
    role: "staff",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: crypto.randomUUID(),
    authUserId: null,
    name: "利用者",
    kana: null,
    email: null,
    preferredLanguage: "ja",
    desiredOccupations: [],
    skills: [],
    strengths: null,
    weaknesses: null,
    accommodations: [],
    commuteConditions: null,
    needsTransport: false,
    assignedStaffId: null,
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeRepo(store: Map<string, Participant>): ParticipantsRepository {
  return {
    async list() {
      return { rows: [...store.values()], total: store.size };
    },
    async findById(id) {
      return store.get(id);
    },
    async findByIds(ids) {
      return ids.flatMap((id) => store.get(id) ?? []);
    },
    async create(values) {
      const row = makeParticipant({ ...values, id: crypto.randomUUID() } as Partial<Participant>);
      store.set(row.id, row);
      return row;
    },
    async update(id, values) {
      const current = store.get(id);
      if (!current) return undefined;
      const next = { ...current, ...values, updatedAt: new Date() } as Participant;
      store.set(id, next);
      return next;
    },
  };
}

describe("assertCanEditParticipant", () => {
  const participant = makeParticipant({ assignedStaffId: "staff-1" });

  it("admin は誰でも編集できる", () => {
    expect(() => assertCanEditParticipant(makeStaff({ role: "admin" }), participant)).not.toThrow();
  });

  it("staff は担当利用者を編集できる", () => {
    expect(() =>
      assertCanEditParticipant(makeStaff({ role: "staff", id: "staff-1" }), participant),
    ).not.toThrow();
  });

  it("staff は担当外の利用者を編集できない", () => {
    expect(() =>
      assertCanEditParticipant(makeStaff({ role: "staff", id: "staff-2" }), participant),
    ).toThrow(AppError);
  });

  it("viewer は担当でも編集できない", () => {
    expect(() =>
      assertCanEditParticipant(makeStaff({ role: "viewer", id: "staff-1" }), participant),
    ).toThrow(AppError);
  });
});

describe("getParticipant", () => {
  it("存在しない ID は NOT_FOUND", async () => {
    const repo = fakeRepo(new Map());
    await expect(getParticipant(crypto.randomUUID(), repo)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("updateParticipant", () => {
  it("担当 staff は更新でき、before/after が返る", async () => {
    const participant = makeParticipant({ assignedStaffId: "staff-1", name: "旧名" });
    const repo = fakeRepo(new Map([[participant.id, participant]]));
    const actor = makeStaff({ role: "staff", id: "staff-1" });

    const { before, after } = await updateParticipant(
      actor,
      participant.id,
      { name: "新名" },
      repo,
    );
    expect(before.name).toBe("旧名");
    expect(after.name).toBe("新名");
  });

  it("担当外の staff は FORBIDDEN", async () => {
    const participant = makeParticipant({ assignedStaffId: "staff-1" });
    const repo = fakeRepo(new Map([[participant.id, participant]]));
    const actor = makeStaff({ role: "staff", id: "staff-9" });

    await expect(
      updateParticipant(actor, participant.id, { name: "X" }, repo),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("存在しない利用者は NOT_FOUND", async () => {
    const repo = fakeRepo(new Map());
    await expect(
      updateParticipant(makeStaff({ role: "admin" }), crypto.randomUUID(), {}, repo),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
