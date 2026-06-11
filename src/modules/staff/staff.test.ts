import { describe, expect, it, vi } from "vitest";

import type { SupabaseAuthAdmin } from "../../lib/clients/supabase-auth-admin";
import type { Staff } from "../../lib/types";
import type { StaffRepository } from "./staff.repository";
import { createStaff, inviteStaff, updateStaff } from "./staff.service";

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: crypto.randomUUID(),
    authUserId: null,
    name: "職員",
    email: `${crypto.randomUUID()}@example.com`,
    role: "staff",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeRepo(initial: Staff[] = []): StaffRepository {
  const store = new Map(initial.map((s) => [s.id, s]));
  return {
    async list() {
      return { rows: [...store.values()], total: store.size };
    },
    async findById(id) {
      return store.get(id);
    },
    async findByEmail(email) {
      return [...store.values()].find((s) => s.email === email);
    },
    async create(values) {
      const row = makeStaff(values as Partial<Staff>);
      store.set(row.id, row);
      return row;
    },
    async update(id, values) {
      const current = store.get(id);
      if (!current) return undefined;
      const next = { ...current, ...values, updatedAt: new Date() } as Staff;
      store.set(id, next);
      return next;
    },
  };
}

describe("createStaff", () => {
  it("メールアドレス重複は CONFLICT", async () => {
    const existing = makeStaff({ email: "dup@example.com" });
    const repo = fakeRepo([existing]);
    await expect(
      createStaff({ name: "新人", email: "dup@example.com", role: "staff" }, repo),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

function fakeAuthAdmin(overrides: Partial<SupabaseAuthAdmin> = {}): SupabaseAuthAdmin {
  return {
    inviteUserByEmail: vi.fn(async () => ({ id: crypto.randomUUID() })),
    createUser: vi.fn(async () => ({ id: crypto.randomUUID() })),
    updateUserPassword: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("inviteStaff", () => {
  it("招待で authUserId が紐付く", async () => {
    const member = makeStaff();
    const repo = fakeRepo([member]);
    const authUserId = crypto.randomUUID();
    const authAdmin = fakeAuthAdmin({
      inviteUserByEmail: vi.fn(async () => ({ id: authUserId })),
    });

    const after = await inviteStaff(member.id, repo, authAdmin);
    expect(after.authUserId).toBe(authUserId);
    expect(authAdmin.inviteUserByEmail).toHaveBeenCalledWith(member.email);
  });

  it("存在しない職員は NOT_FOUND", async () => {
    await expect(
      inviteStaff(crypto.randomUUID(), fakeRepo(), fakeAuthAdmin()),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("停止中の職員は CONFLICT", async () => {
    const member = makeStaff({ isActive: false });
    const repo = fakeRepo([member]);
    await expect(inviteStaff(member.id, repo, fakeAuthAdmin())).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("updateStaff（ロックアウト防止）", () => {
  it("自分自身のロール変更は FORBIDDEN", async () => {
    const admin = makeStaff({ role: "admin" });
    const repo = fakeRepo([admin]);
    await expect(updateStaff(admin, admin.id, { role: "viewer" }, repo)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("自分自身のアカウント停止は FORBIDDEN", async () => {
    const admin = makeStaff({ role: "admin" });
    const repo = fakeRepo([admin]);
    await expect(updateStaff(admin, admin.id, { isActive: false }, repo)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("自分自身でも名前の変更はできる", async () => {
    const admin = makeStaff({ role: "admin", name: "旧名" });
    const repo = fakeRepo([admin]);
    const { after } = await updateStaff(admin, admin.id, { name: "新名" }, repo);
    expect(after.name).toBe("新名");
  });

  it("他の職員のロール変更・停止はできる", async () => {
    const admin = makeStaff({ role: "admin" });
    const target = makeStaff({ role: "staff" });
    const repo = fakeRepo([admin, target]);
    const { after } = await updateStaff(
      admin,
      target.id,
      { role: "viewer", isActive: false },
      repo,
    );
    expect(after.role).toBe("viewer");
    expect(after.isActive).toBe(false);
  });
});
