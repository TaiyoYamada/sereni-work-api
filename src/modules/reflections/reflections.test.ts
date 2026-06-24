import { describe, expect, it } from "vitest";

import { AppError, NotFoundError } from "../../lib/errors";
import type { Participant, Staff } from "../../lib/types";
import type { ReflectionsRepository } from "./reflections.repository";
import type { Reflection, ReflectionWithName } from "./reflections.schema";
import {
  createReflection,
  deleteReflection,
  listReflections,
  updateReflection,
  type ReflectionsDeps,
} from "./reflections.service";

const AUTHOR_ID = "staff-author";

function makeReflection(overrides: Partial<Reflection> = {}): Reflection {
  return {
    id: "r1",
    participantId: "p1",
    staffId: AUTHOR_ID,
    meetingDate: "2026-06-19",
    notes: "今週は集中して取り組めた",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const sampleRow: ReflectionWithName = { ...makeReflection(), staffName: "職員" };

function actor(id: string, role: Staff["role"] = "staff"): Staff {
  return { id, role, name: "職員" } as Staff;
}

function makeDeps(opts: {
  rows?: ReflectionWithName[];
  participantExists?: boolean;
  existing?: Reflection | undefined;
  onUpdate?: (id: string, values: Partial<Reflection>) => void;
  onRemove?: (id: string) => void;
}): ReflectionsDeps {
  const existing = "existing" in opts ? opts.existing : makeReflection();
  const repo: ReflectionsRepository = {
    async listByParticipant() {
      return opts.rows ?? [];
    },
    async findById() {
      return existing;
    },
    async findByIdWithName() {
      return existing ? { ...existing, staffName: "職員" } : undefined;
    },
    async create(values) {
      return {
        id: "new",
        participantId: values.participantId,
        staffId: values.staffId,
        meetingDate: values.meetingDate,
        notes: values.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    async update(id, values) {
      opts.onUpdate?.(id, values);
      return existing ? { ...existing, ...values } : undefined;
    },
    async remove(id) {
      opts.onRemove?.(id);
    },
  };
  return {
    repo,
    getParticipantById: async (id: string) => {
      if (opts.participantExists === false) throw new NotFoundError("利用者が見つかりません");
      return { id } as Participant;
    },
  };
}

describe("listReflections", () => {
  it("利用者の記録を返す", async () => {
    const rows = await listReflections("p1", makeDeps({ rows: [sampleRow] }));
    expect(rows).toEqual([sampleRow]);
  });

  it("利用者が存在しなければ NOT_FOUND", async () => {
    await expect(
      listReflections("missing", makeDeps({ participantExists: false })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createReflection", () => {
  it("記録者は actor の ID になる", async () => {
    const created = await createReflection(
      actor("staff-7"),
      { participantId: "p1", meetingDate: "2026-06-19", notes: "順調" },
      makeDeps({}),
    );
    expect(created.staffId).toBe("staff-7");
  });
});

describe("updateReflection", () => {
  it("記録者本人は更新できる", async () => {
    let captured: { id: string; values: Partial<Reflection> } | undefined;
    await updateReflection(
      actor(AUTHOR_ID),
      "r1",
      { notes: "更新後" },
      makeDeps({ onUpdate: (id, values) => (captured = { id, values }) }),
    );
    expect(captured).toEqual({ id: "r1", values: { notes: "更新後" } });
  });

  it("管理者は他人の記録も更新できる", async () => {
    let called = false;
    await updateReflection(
      actor("admin-1", "admin"),
      "r1",
      { notes: "管理者更新" },
      makeDeps({ onUpdate: () => (called = true) }),
    );
    expect(called).toBe(true);
  });

  it("記録者でも管理者でもなければ FORBIDDEN", async () => {
    await expect(
      updateReflection(actor("other-staff"), "r1", { notes: "x" }, makeDeps({})),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("記録が無ければ NOT_FOUND", async () => {
    await expect(
      updateReflection(
        actor(AUTHOR_ID),
        "missing",
        { notes: "x" },
        makeDeps({ existing: undefined }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteReflection", () => {
  it("記録者本人は削除できる", async () => {
    let removed: string | undefined;
    await deleteReflection(actor(AUTHOR_ID), "r1", makeDeps({ onRemove: (id) => (removed = id) }));
    expect(removed).toBe("r1");
  });

  it("記録者でも管理者でもなければ FORBIDDEN", async () => {
    await expect(deleteReflection(actor("other-staff"), "r1", makeDeps({}))).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("記録が無ければ NOT_FOUND", async () => {
    await expect(
      deleteReflection(actor(AUTHOR_ID), "missing", makeDeps({ existing: undefined })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
