import { index, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { optimizationRunStatus } from "./enums";
import { staff } from "./staff";

/**
 * 最適化実行履歴（設計書16章）
 * ソルバー固有のメトリクス（Chain Strength 等）は solverMetrics に JSON で保存し、
 * 特定の量子サービスへスキーマを依存させない。
 */
export const optimizationRuns = pgTable(
  "optimization_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executedByStaffId: uuid("executed_by_staff_id")
      .notNull()
      .references(() => staff.id),
    status: optimizationRunStatus("status").notNull().default("PENDING"),
    /** 対象期間 */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** 対象利用者・対象実習先 */
    participantIds: uuid("participant_ids").array().notNull(),
    companyIds: uuid("company_ids").array().notNull(),
    /** 使用ソルバー（exact / ortools / sa / openjij / dwave 等） */
    solver: text("solver").notNull(),
    /** 問題定義・QUBO 定式化のバージョン */
    problemVersion: text("problem_version").notNull(),
    quboVersion: text("qubo_version").notNull(),
    variableCount: integer("variable_count"),
    constraintCount: integer("constraint_count"),
    /** 条件重み（業務用語キー: 希望重視・スキル重視・公平性重視 等） */
    weights: jsonb("weights").notNull(),
    penaltyCoefficients: jsonb("penalty_coefficients"),
    randomSeed: integer("random_seed"),
    numReads: integer("num_reads"),
    executionTimeMs: integer("execution_time_ms"),
    /** 最良エネルギー */
    energy: real("energy"),
    /** 再検証で検出した制約違反数（違反ありは確定不可） */
    violationCount: integer("violation_count"),
    /** 実機利用時のメトリクス（物理量子ビット数、Chain Strength、利用料金 等） */
    solverMetrics: jsonb("solver_metrics"),
    errorMessage: text("error_message"),
    /** 候補一覧と選択された候補 */
    candidates: jsonb("candidates"),
    selectedCandidate: jsonb("selected_candidate"),
    /** 手動修正の内容 */
    manualAdjustments: jsonb("manual_adjustments"),
    finalizedByStaffId: uuid("finalized_by_staff_id").references(() => staff.id),
    /** Hono–Python Lambda 間で共通の Trace ID */
    traceId: text("trace_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("optimization_runs_status_idx").on(table.status)],
);
