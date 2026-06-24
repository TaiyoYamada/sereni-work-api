import { describe, expect, it } from "vitest";

import type { DashboardRepository } from "./dashboard.repository";
import { getDashboard } from "./dashboard.service";

function fakeRepo(overrides: Partial<DashboardRepository> = {}): DashboardRepository {
  return {
    async assignmentStatusCounts() {
      return [
        { status: "IN_PROGRESS", count: 3 },
        { status: "CONFIRMED", count: 2 },
        { status: "DRAFT", count: 1 },
      ];
    },
    async reportCounts() {
      return { submitted: 4, needsAction: 1, interviewNeeded: 2 };
    },
    async reportTrend() {
      return [
        { date: "2026-06-10", expected: 3, submitted: 3 },
        { date: "2026-06-11", expected: 3, submitted: 1 },
      ];
    },
    async conditionTrend() {
      return [{ date: "2026-06-11", condition: 3.5, fatigue: 2.0, anxiety: null }];
    },
    async missingPreChecks() {
      return [];
    },
    async expiringParticipants() {
      return [
        { participantId: "p1", name: "山田", reason: "CERT", dueDate: "2026-07-01" },
        { participantId: "p2", name: "佐藤", reason: "USAGE_LIMIT", dueDate: "2026-07-20" },
      ];
    },
    async stageDistribution() {
      return [
        { stage: "ASSESSMENT", count: 2 },
        { stage: "TRAINING", count: 1 },
        { stage: "INTERNSHIP", count: 3 },
        { stage: "JOB_HUNTING", count: 0 },
        { stage: "RETENTION", count: 0 },
      ];
    },
    ...overrides,
  };
}

describe("getDashboard", () => {
  it("状態別件数からカウントを導出する", async () => {
    const dashboard = await getDashboard("2026-06-11", fakeRepo());
    expect(dashboard.counts).toEqual({
      inProgressAssignments: 3,
      confirmedAssignments: 2,
      submittedReports: 4,
      needsActionReports: 1,
      interviewNeededReports: 2,
    });
  });

  it("本日の提出状況はトレンドの最終日から導出する", async () => {
    const dashboard = await getDashboard("2026-06-11", fakeRepo());
    expect(dashboard.today).toMatchObject({
      date: "2026-06-11",
      expectedReports: 3,
      submittedReports: 1,
    });
  });

  it("期限アラートとステージ分布をそのまま返す", async () => {
    const dashboard = await getDashboard("2026-06-11", fakeRepo());
    expect(dashboard.expiringParticipants).toHaveLength(2);
    expect(dashboard.expiringParticipants[0]).toMatchObject({ reason: "CERT" });
    expect(dashboard.stageDistribution).toHaveLength(5);
  });

  it("トレンドが空でも 0 件として返す", async () => {
    const dashboard = await getDashboard(
      "2026-06-11",
      fakeRepo({
        async reportTrend() {
          return [];
        },
      }),
    );
    expect(dashboard.today.expectedReports).toBe(0);
    expect(dashboard.today.submittedReports).toBe(0);
  });
});
