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
