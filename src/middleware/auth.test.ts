import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";

import { env } from "../env";
import { createApp } from "../lib/create-app";
import type { Participant, Staff } from "../lib/types";
import type { ActorFinders } from "./auth";
import { authenticate } from "./auth";
import { requireParticipant, requireRole, requireStaff } from "./require-role";

const STAFF_AUTH_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_AUTH_ID = "22222222-2222-2222-2222-222222222222";
const VIEWER_AUTH_ID = "33333333-3333-3333-3333-333333333333";
const SUSPENDED_AUTH_ID = "44444444-4444-4444-4444-444444444444";
const PARTICIPANT_AUTH_ID = "55555555-5555-5555-5555-555555555555";

function makeStaff(overrides: Partial<Staff>): Staff {
  return {
    id: crypto.randomUUID(),
    authUserId: null,
    name: "テスト職員",
    email: "staff@example.com",
    role: "staff",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeParticipant(overrides: Partial<Participant>): Participant {
  return {
    id: crypto.randomUUID(),
    authUserId: null,
    loginId: null,
    name: "テスト利用者",
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

const staffByAuthId: Record<string, Staff> = {
  [STAFF_AUTH_ID]: makeStaff({ authUserId: STAFF_AUTH_ID, role: "staff" }),
  [ADMIN_AUTH_ID]: makeStaff({ authUserId: ADMIN_AUTH_ID, role: "admin" }),
  [VIEWER_AUTH_ID]: makeStaff({ authUserId: VIEWER_AUTH_ID, role: "viewer" }),
  [SUSPENDED_AUTH_ID]: makeStaff({ authUserId: SUSPENDED_AUTH_ID, isActive: false }),
};

const finders: ActorFinders = {
  findStaffByAuthUserId: async (id) => staffByAuthId[id],
  findParticipantByAuthUserId: async (id) =>
    id === PARTICIPANT_AUTH_ID ? makeParticipant({ authUserId: PARTICIPANT_AUTH_ID }) : undefined,
};

function buildApp() {
  const app = createApp();
  app.use("*", authenticate(finders));
  app.get("/staff-only", requireStaff(), (c) => c.json({ ok: true }));
  app.get("/admin-only", requireRole("admin"), (c) => c.json({ ok: true }));
  app.get("/me-only", requireParticipant(), (c) => c.json({ ok: true }));
  return app;
}

async function tokenFor(authUserId: string) {
  return sign(
    { sub: authUserId, exp: Math.floor(Date.now() / 1000) + 600 },
    env.SUPABASE_JWT_SECRET,
  );
}

async function request(path: string, authUserId?: string, rawToken?: string) {
  const app = buildApp();
  const headers: Record<string, string> = {};
  if (rawToken) headers.Authorization = `Bearer ${rawToken}`;
  else if (authUserId) headers.Authorization = `Bearer ${await tokenFor(authUserId)}`;
  return app.request(path, { headers });
}

async function errorCode(res: Response) {
  const body = (await res.json()) as { error: { code: string } };
  return body.error.code;
}

describe("authenticate", () => {
  it("Authorization ヘッダーがなければ 401", async () => {
    const res = await request("/staff-only");
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("UNAUTHENTICATED");
  });

  it("不正なトークンは 401", async () => {
    const res = await request("/staff-only", undefined, "invalid.token.here");
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("UNAUTHENTICATED");
  });

  it("期限切れトークンは 401", async () => {
    const expired = await sign(
      { sub: STAFF_AUTH_ID, exp: Math.floor(Date.now() / 1000) - 60 },
      env.SUPABASE_JWT_SECRET,
    );
    const res = await request("/staff-only", undefined, expired);
    expect(res.status).toBe(401);
  });

  it("停止されたアカウントは 403", async () => {
    const res = await request("/staff-only", SUSPENDED_AUTH_ID);
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("FORBIDDEN");
  });

  it("業務テーブルに紐付かないユーザーは 403", async () => {
    const res = await request("/staff-only", crypto.randomUUID());
    expect(res.status).toBe(403);
  });
});

describe("requireStaff / requireRole", () => {
  it.each([
    ["staff", STAFF_AUTH_ID],
    ["admin", ADMIN_AUTH_ID],
    ["viewer", VIEWER_AUTH_ID],
  ])("%s は職員ルートにアクセスできる", async (_role, authId) => {
    const res = await request("/staff-only", authId);
    expect(res.status).toBe(200);
  });

  it("利用者は職員ルートにアクセスできない", async () => {
    const res = await request("/staff-only", PARTICIPANT_AUTH_ID);
    expect(res.status).toBe(403);
  });

  it("admin は admin 専用ルートにアクセスできる", async () => {
    const res = await request("/admin-only", ADMIN_AUTH_ID);
    expect(res.status).toBe(200);
  });

  it.each([
    ["staff", STAFF_AUTH_ID],
    ["viewer", VIEWER_AUTH_ID],
  ])("%s は admin 専用ルートにアクセスできない", async (_role, authId) => {
    const res = await request("/admin-only", authId);
    expect(res.status).toBe(403);
  });
});

describe("requireParticipant", () => {
  it("利用者は /me 系ルートにアクセスできる", async () => {
    const res = await request("/me-only", PARTICIPANT_AUTH_ID);
    expect(res.status).toBe(200);
  });

  it("職員は /me 系ルートにアクセスできない", async () => {
    const res = await request("/me-only", STAFF_AUTH_ID);
    expect(res.status).toBe(403);
  });
});
