import { dashboardRepository, type DashboardRepository } from "./dashboard.repository";
import type { DashboardResponse } from "./dashboard.schema";

/**
 * ダッシュボードの集計を一括で返す。
 * 本日の提出想定・提出数は reportTrend の最終日（= today）から導出する（SSOT）。
 */
export async function getDashboard(
  today: string,
  repo: DashboardRepository = dashboardRepository,
): Promise<DashboardResponse> {
  const [assignmentStatusCounts, reportCounts, reportTrend, conditionTrend, missingPreChecks] =
    await Promise.all([
      repo.assignmentStatusCounts(),
      repo.reportCounts(),
      repo.reportTrend(today),
      repo.conditionTrend(today),
      repo.missingPreChecks(today),
    ]);

  const statusCount = (status: string) =>
    assignmentStatusCounts.find((row) => row.status === status)?.count ?? 0;
  const todayPoint = reportTrend.at(-1);

  return {
    counts: {
      inProgressAssignments: statusCount("IN_PROGRESS"),
      confirmedAssignments: statusCount("CONFIRMED"),
      submittedReports: reportCounts.submitted,
      needsActionReports: reportCounts.needsAction,
      interviewNeededReports: reportCounts.interviewNeeded,
    },
    today: {
      date: today,
      expectedReports: todayPoint?.expected ?? 0,
      submittedReports: todayPoint?.submitted ?? 0,
      missingPreChecks,
    },
    reportTrend,
    conditionTrend,
    assignmentStatusCounts,
  };
}
