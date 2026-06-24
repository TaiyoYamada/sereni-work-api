import { and, count, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/client";
import { assignments, participants, reports, supportStages } from "../../db/schema";
import type {
  AssignmentStatusCount,
  ConditionTrendPoint,
  ExpiringParticipant,
  MissingPreCheck,
  ReportTrendPoint,
  StageCount,
} from "./dashboard.schema";

/** 集計トレンドの対象日数（直近2週間） */
const TREND_DAYS = 14;

/** 期限アラートの対象日数（この日数以内に期限を迎える / 既に超過したもの） */
const EXPIRY_THRESHOLD_DAYS = 60;

const expiringRowSchema = z.object({
  participant_id: z.string(),
  name: z.string(),
  reason: z.enum(["CERT", "USAGE_LIMIT"]),
  due_date: z.string(),
});

// db.execute（生 SQL）の行は境界として Zod で検証してから返す
const reportTrendRowSchema = z.object({
  date: z.string(),
  expected: z.number(),
  submitted: z.number(),
});

const conditionTrendRowSchema = z.object({
  date: z.string(),
  condition: z.number().nullable(),
  fatigue: z.number().nullable(),
  anxiety: z.number().nullable(),
});

const missingPreCheckRowSchema = z.object({
  assignment_id: z.string(),
  participant_id: z.string(),
  participant_name: z.string(),
  company_name: z.string(),
});

export const dashboardRepository = {
  /** 実習割当の状態別件数 */
  async assignmentStatusCounts(): Promise<AssignmentStatusCount[]> {
    const rows = await db
      .select({ status: assignments.status, value: count() })
      .from(assignments)
      .groupBy(assignments.status);
    return rows.map((row) => ({ status: row.status, count: row.value }));
  },

  /** 日報の状態別件数と面談希望件数 */
  async reportCounts(): Promise<{
    submitted: number;
    needsAction: number;
    interviewNeeded: number;
  }> {
    const [byStatus, interview] = await Promise.all([
      db.select({ status: reports.status, value: count() }).from(reports).groupBy(reports.status),
      db
        .select({ value: count() })
        .from(reports)
        .where(and(eq(reports.interviewNeeded, true), ne(reports.status, "REVIEWED"))),
    ]);
    const countFor = (status: string) => byStatus.find((row) => row.status === status)?.value ?? 0;
    return {
      submitted: countFor("SUBMITTED"),
      needsAction: countFor("NEEDS_ACTION"),
      interviewNeeded: interview[0]?.value ?? 0,
    };
  },

  /**
   * 日報提出トレンド（today を含む直近 TREND_DAYS 日）。
   * 提出想定数は「期間がその日を含む IN_PROGRESS / COMPLETED の割当数」で近似する
   * （割当の状態履歴は持っていないため、過去日は COMPLETED が実習中だった日をカバーする）。
   */
  async reportTrend(today: string): Promise<ReportTrendPoint[]> {
    const rows = await db.execute(sql`
      with days as (
        select generate_series(${today}::date - ${TREND_DAYS - 1}::int, ${today}::date, '1 day')::date as day
      )
      select
        to_char(day, 'YYYY-MM-DD') as date,
        (select count(*)::int from assignments a
          where a.status in ('IN_PROGRESS', 'COMPLETED')
            and a.start_date <= day and a.end_date >= day) as expected,
        (select count(*)::int from reports r
          where r.report_date = day and r.status <> 'DRAFT') as submitted
      from days
      order by day
    `);
    return z.array(reportTrendRowSchema).parse(rows);
  },

  /** プレチェックの体調平均トレンド（today を含む直近 TREND_DAYS 日。記録がない日は含まれない） */
  async conditionTrend(today: string): Promise<ConditionTrendPoint[]> {
    const rows = await db.execute(sql`
      select
        to_char(check_date, 'YYYY-MM-DD') as date,
        round(avg(condition)::numeric, 2)::float as condition,
        round(avg(fatigue)::numeric, 2)::float as fatigue,
        round(avg(anxiety)::numeric, 2)::float as anxiety
      from pre_checks
      where check_date between ${today}::date - ${TREND_DAYS - 1}::int and ${today}::date
      group by check_date
      order by check_date
    `);
    return z.array(conditionTrendRowSchema).parse(rows);
  },

  /** 本日実習中なのにプレチェック未提出の割当 */
  async missingPreChecks(today: string): Promise<MissingPreCheck[]> {
    const rows = await db.execute(sql`
      select
        a.id as assignment_id,
        p.id as participant_id,
        p.name as participant_name,
        c.name as company_name
      from assignments a
      join participants p on p.id = a.participant_id
      join companies c on c.id = a.company_id
      where a.status = 'IN_PROGRESS'
        and a.start_date <= ${today}::date and a.end_date >= ${today}::date
        and not exists (
          select 1 from pre_checks pc
          where pc.assignment_id = a.id and pc.check_date = ${today}::date
        )
      order by p.name
    `);
    return z
      .array(missingPreCheckRowSchema)
      .parse(rows)
      .map((row) => ({
        assignmentId: row.assignment_id,
        participantId: row.participant_id,
        participantName: row.participant_name,
        companyName: row.company_name,
      }));
  },

  /**
   * 期限が近い（または超過した）利用者。
   * 受給者証の有効期限、または利用開始から2年（利用上限）が EXPIRY_THRESHOLD_DAYS 以内のもの。
   * 在籍中（is_active）のみ。due_date 昇順。
   */
  async expiringParticipants(today: string): Promise<ExpiringParticipant[]> {
    const rows = await db.execute(sql`
      select id as participant_id, name, 'CERT' as reason,
        to_char(recipient_cert_expiry, 'YYYY-MM-DD') as due_date
      from participants
      where is_active and recipient_cert_expiry is not null
        and recipient_cert_expiry <= ${today}::date + ${EXPIRY_THRESHOLD_DAYS}::int
      union all
      select id as participant_id, name, 'USAGE_LIMIT' as reason,
        to_char((service_start_date + interval '2 years')::date, 'YYYY-MM-DD') as due_date
      from participants
      where is_active and service_start_date is not null
        and (service_start_date + interval '2 years')::date
          <= ${today}::date + ${EXPIRY_THRESHOLD_DAYS}::int
      order by due_date
    `);
    return z
      .array(expiringRowSchema)
      .parse(rows)
      .map((row) => ({
        participantId: row.participant_id,
        name: row.name,
        reason: row.reason,
        dueDate: row.due_date,
      }));
  },

  /** 支援ステージ別の在籍人数（在籍中のみ） */
  async stageDistribution(): Promise<StageCount[]> {
    const rows = await db
      .select({ stage: participants.stage, value: count() })
      .from(participants)
      .where(eq(participants.isActive, true))
      .groupBy(participants.stage);
    const countFor = (stage: (typeof supportStages)[number]) =>
      rows.find((row) => row.stage === stage)?.value ?? 0;
    // 全ステージを 0 件込みで返す（UI 側で欠損を気にしない）
    return supportStages.map((stage) => ({ stage, count: countFor(stage) }));
  },
};

export type DashboardRepository = typeof dashboardRepository;
