/**
 * API 統合テスト（実 PostgreSQL に対して app 全体を通しで検証する）。
 * DATABASE_URL が設定されている場合のみ実行される（CI では postgres サービスを使用）。
 * 事前に `bun run db:migrate` が必要。
 */
import { sql } from "drizzle-orm";
import { sign } from "hono/jwt";
import { beforeAll, describe, expect, it } from "vitest";

import app from "./app";
import { db } from "./db/client";
import { participants, staff } from "./db/schema";
import { env } from "./env";
import { todayInFacilityTz } from "./lib/dates";

const hasDb = Boolean(process.env.DATABASE_URL);

const ADMIN_AUTH_ID = crypto.randomUUID();
const STAFF_AUTH_ID = crypto.randomUUID();
const PARTICIPANT_AUTH_ID = crypto.randomUUID();

let adminToken: string;
let staffToken: string;
let participantToken: string;
let staffId: string;

async function tokenFor(authUserId: string) {
  return sign(
    { sub: authUserId, exp: Math.floor(Date.now() / 1000) + 3600 },
    env.SUPABASE_JWT_SECRET,
  );
}

function authed(token: string, init: RequestInit = {}) {
  return {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!hasDb)("API 統合テスト（実 DB）", () => {
  beforeAll(async () => {
    await db.execute(sql`
      TRUNCATE TABLE audit_logs, report_translations, report_revisions, report_comments,
        reports, pre_checks, evaluations, assignments, optimization_runs,
        participants, companies, staff CASCADE
    `);
    const [admin] = await db
      .insert(staff)
      .values([
        {
          name: "統合テスト管理者",
          email: "it-admin@example.com",
          role: "admin",
          authUserId: ADMIN_AUTH_ID,
        },
        {
          name: "統合テスト支援員",
          email: "it-staff@example.com",
          role: "staff",
          authUserId: STAFF_AUTH_ID,
        },
      ])
      .returning();
    staffId = admin!.id;
    await db.insert(participants).values({
      name: "統合テスト利用者",
      authUserId: PARTICIPANT_AUTH_ID,
    });
    adminToken = await tokenFor(ADMIN_AUTH_ID);
    staffToken = await tokenFor(STAFF_AUTH_ID);
    participantToken = await tokenFor(PARTICIPANT_AUTH_ID);
  });

  it("認証なしは 401、利用者トークンで職員ルートは 403", async () => {
    expect((await app.request("/participants")).status).toBe(401);
    expect((await app.request("/participants", authed(participantToken))).status).toBe(403);
  });

  it("利用者・企業・割当 → 確定 → 開始 → 日報提出 → 確認 の一連の業務フローが通る", async () => {
    const today = todayInFacilityTz();

    // 管理者: 利用者登録
    const createParticipant = await app.request(
      "/participants",
      authed(adminToken, {
        method: "POST",
        body: JSON.stringify({
          name: "山本 次郎",
          desiredOccupations: ["事務"],
          accommodations: ["静かな環境"],
        }),
      }),
    );
    expect(createParticipant.status).toBe(201);

    // 管理者: 企業登録（定員1名）
    const createCompany = await app.request(
      "/companies",
      authed(adminToken, {
        method: "POST",
        body: JSON.stringify({ name: "統合テスト株式会社", capacity: 1 }),
      }),
    );
    expect(createCompany.status).toBe(201);
    const company = (await createCompany.json()) as { id: string };

    // 本人参加用の participant を取得（authUserId 付きの行）
    const myParticipant = await db.query.participants.findFirst({
      where: (p, { eq }) => eq(p.authUserId, PARTICIPANT_AUTH_ID),
    });

    // 支援員: 割当作成（今日を含む期間）
    const createAssignment = await app.request(
      "/assignments",
      authed(staffToken, {
        method: "POST",
        body: JSON.stringify({
          participantId: myParticipant!.id,
          companyId: company.id,
          startDate: today,
          endDate: addDays(today, 4),
          meetingPlace: "1階受付",
        }),
      }),
    );
    expect(createAssignment.status).toBe(201);
    const assignment = (await createAssignment.json()) as { id: string; status: string };
    expect(assignment.status).toBe("DRAFT");

    // 支援員は確定できない（管理者のみ）
    const confirmByStaff = await app.request(
      `/assignments/${assignment.id}/confirm`,
      authed(staffToken, { method: "POST" }),
    );
    expect(confirmByStaff.status).toBe(403);

    // 管理者: 確定
    const confirm = await app.request(
      `/assignments/${assignment.id}/confirm`,
      authed(adminToken, { method: "POST" }),
    );
    expect(confirm.status).toBe(200);
    expect(((await confirm.json()) as { status: string }).status).toBe("CONFIRMED");

    // 定員チェック: 同じ企業・重複期間の2人目の確定は 409
    const second = (await (
      await app.request(
        "/participants",
        authed(adminToken, { method: "POST", body: JSON.stringify({ name: "二人目" }) }),
      )
    ).json()) as { id: string };
    const secondAssignment = (await (
      await app.request(
        "/assignments",
        authed(adminToken, {
          method: "POST",
          body: JSON.stringify({
            participantId: second.id,
            companyId: company.id,
            startDate: today,
            endDate: addDays(today, 2),
          }),
        }),
      )
    ).json()) as { id: string };
    const overCapacity = await app.request(
      `/assignments/${secondAssignment.id}/confirm`,
      authed(adminToken, { method: "POST" }),
    );
    expect(overCapacity.status).toBe(409);
    const overBody = (await overCapacity.json()) as { error: { code: string } };
    expect(overBody.error.code).toBe("ASSIGNMENT_CAPACITY_EXCEEDED");

    // 開始
    const start = await app.request(
      `/assignments/${assignment.id}/start`,
      authed(staffToken, { method: "POST" }),
    );
    expect(start.status).toBe(200);

    // 利用者本人: 今日の実習が見える
    const todayRes = await app.request("/me/today", authed(participantToken));
    expect(todayRes.status).toBe(200);
    const todayBody = (await todayRes.json()) as {
      today: { assignment: { id: string } } | null;
    };
    expect(todayBody.today?.assignment.id).toBe(assignment.id);

    // 利用者本人: 実習前チェック
    const preCheck = await app.request(
      "/me/pre-checks",
      authed(participantToken, {
        method: "PUT",
        body: JSON.stringify({
          assignmentId: assignment.id,
          checkDate: today,
          condition: 4,
          canParticipate: true,
        }),
      }),
    );
    expect(preCheck.status).toBe(200);

    // 利用者本人: 日報提出（冪等キー付き）
    const clientGeneratedId = crypto.randomUUID();
    const submitBody = JSON.stringify({
      assignmentId: assignment.id,
      reportDate: today,
      clientGeneratedId,
      freeText: "初日はファイリングを頑張りました",
      satisfaction: 4,
    });
    const submit = await app.request(
      "/me/reports",
      authed(participantToken, { method: "POST", body: submitBody }),
    );
    expect(submit.status).toBe(201);
    const report = (await submit.json()) as { id: string; status: string };
    expect(report.status).toBe("SUBMITTED");

    // 再送（オフライン復帰を想定）→ 200 で同じ日報が返り、重複作成されない
    const resend = await app.request(
      "/me/reports",
      authed(participantToken, { method: "POST", body: submitBody }),
    );
    expect(resend.status).toBe(200);
    expect(((await resend.json()) as { id: string }).id).toBe(report.id);

    // 支援員: 日報確認 → コメント → 修正（原文保持）
    const review = await app.request(
      `/reports/${report.id}/review`,
      authed(staffToken, { method: "POST", body: JSON.stringify({ result: "REVIEWED" }) }),
    );
    expect(review.status).toBe(200);

    const comment = await app.request(
      `/reports/${report.id}/comments`,
      authed(staffToken, {
        method: "POST",
        body: JSON.stringify({ body: "初日おつかれさまでした！" }),
      }),
    );
    expect(comment.status).toBe(201);

    const revise = await app.request(
      `/reports/${report.id}/revise`,
      authed(staffToken, {
        method: "POST",
        body: JSON.stringify({
          reason: "誤字修正",
          changes: { freeText: "初日はファイリングを頑張りました。" },
        }),
      }),
    );
    expect(revise.status).toBe(200);

    // 評価の登録（実習中なので可能）
    const evaluation = await app.request(
      "/evaluations",
      authed(staffToken, {
        method: "PUT",
        body: JSON.stringify({
          assignmentId: assignment.id,
          attitude: 5,
          nextNote: "次回は接客にも挑戦",
        }),
      }),
    );
    expect(evaluation.status).toBe(200);

    // 完了
    const complete = await app.request(
      `/assignments/${assignment.id}/complete`,
      authed(adminToken, { method: "POST" }),
    );
    expect(complete.status).toBe(200);
    expect(((await complete.json()) as { status: string }).status).toBe("COMPLETED");

    // 監査ログが記録されている
    const auditCount = await db.execute(sql`SELECT count(*)::int AS count FROM audit_logs`);
    expect((auditCount as unknown as { count: number }[])[0]!.count).toBeGreaterThan(0);

    // 職員一覧が staff トークンで見える（担当者選択用）
    const staffList = await app.request("/staff", authed(staffToken));
    expect(staffList.status).toBe(200);

    // viewer 相当の確認: 利用者は /reports（職員ルート）にアクセスできない
    expect((await app.request("/reports", authed(participantToken))).status).toBe(403);

    // OpenAPI ドキュメントが生成される
    const doc = await app.request("/doc");
    expect(doc.status).toBe(200);
    const docBody = (await doc.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(docBody.paths)).toContain("/assignments/{id}/confirm");
    expect(staffId).toBeTruthy();
  });
});
