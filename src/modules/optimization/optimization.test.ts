import { describe, expect, it } from "vitest";

import type { OptimizerResponse } from "../../lib/clients/optimizer";
import type { Participant, Staff } from "../../lib/types";
import type { Company } from "../companies/companies.schema";
import type { OptimizationRepository } from "./optimization.repository";
import type { OptimizationRun, StoredCandidate } from "./optimization.schema";
import type { OptimizationDeps } from "./optimization.service";
import {
  accommodationsSupported,
  adoptCandidate,
  desireMatchScore,
  runOptimization,
  skillMatchScore,
} from "./optimization.service";

const admin = { id: crypto.randomUUID(), role: "admin", name: "管理者" } as Staff;
const staffMember = { id: crypto.randomUUID(), role: "staff", name: "支援員" } as Staff;

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: crypto.randomUUID(),
    authUserId: null,
    name: "利用者A",
    kana: null,
    email: null,
    preferredLanguage: "ja",
    desiredOccupations: ["事務"],
    skills: ["PC基本操作"],
    strengths: null,
    weaknesses: null,
    accommodations: ["静かな環境"],
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

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: crypto.randomUUID(),
    name: "テスト株式会社",
    industry: "事務",
    internshipDescription: "データ入力",
    requiredSkills: ["PC基本操作"],
    supportedAccommodations: ["静かな環境"],
    capacity: 2,
    availableSchedule: null,
    workHours: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    address: null,
    belongings: null,
    emergencyContact: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRun(overrides: Partial<OptimizationRun> = {}): OptimizationRun {
  return {
    id: crypto.randomUUID(),
    executedByStaffId: admin.id,
    status: "PENDING",
    periodStart: new Date(),
    periodEnd: new Date(),
    participantIds: [],
    companyIds: [],
    solver: "sa",
    problemVersion: "v1",
    quboVersion: "v1",
    variableCount: null,
    constraintCount: null,
    weights: {},
    penaltyCoefficients: null,
    randomSeed: null,
    numReads: null,
    executionTimeMs: null,
    energy: null,
    violationCount: null,
    solverMetrics: null,
    errorMessage: null,
    candidates: null,
    selectedCandidate: null,
    manualAdjustments: null,
    finalizedByStaffId: null,
    traceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeps(options: {
  participants: Participant[];
  companies: Company[];
  response?: OptimizerResponse;
  occupied?: number;
  busy?: boolean;
  existingRun?: OptimizationRun;
}): {
  deps: OptimizationDeps;
  state: { runs: Map<string, OptimizationRun>; proposed: unknown[]; requests: unknown[] };
} {
  const state = {
    runs: new Map<string, OptimizationRun>(),
    proposed: [] as unknown[],
    requests: [] as unknown[],
  };
  if (options.existingRun) state.runs.set(options.existingRun.id, options.existingRun);

  const repo: OptimizationRepository = {
    async create(values) {
      const run = makeRun(values as Partial<OptimizationRun>);
      state.runs.set(run.id, run);
      return run;
    },
    async update(id, values) {
      const current = state.runs.get(id);
      if (!current) return undefined;
      const next = { ...current, ...values, updatedAt: new Date() } as OptimizationRun;
      state.runs.set(id, next);
      return next;
    },
    async findById(id) {
      return state.runs.get(id);
    },
    async list() {
      return { rows: [...state.runs.values()], total: state.runs.size };
    },
    async getParticipantHistory() {
      return [];
    },
  };

  const deps: OptimizationDeps = {
    repo,
    invoker: async (request) => {
      state.requests.push(request);
      return (
        options.response ?? {
          status: "SUCCEEDED",
          runId: "x",
          solver: "sa",
          variableCount: 1,
          constraintCount: 1,
          executionTimeMs: 10,
          energy: null,
          candidates: [],
        }
      );
    },
    getParticipants: async () => options.participants,
    getCompanies: async () => options.companies,
    getOccupiedCount: async () => options.occupied ?? 0,
    isParticipantBusy: async () => options.busy ?? false,
    propose: async (items) => {
      state.proposed.push(...items);
      return [];
    },
  };
  return { deps, state };
}

describe("特徴量の計算", () => {
  it("希望職種と業種が一致すれば 1.0", () => {
    expect(desireMatchScore(makeParticipant(), makeCompany())).toBe(1.0);
  });

  it("実習内容にのみ含まれる場合は 0.7", () => {
    const company = makeCompany({ industry: "物流", internshipDescription: "事務の補助" });
    expect(desireMatchScore(makeParticipant(), company)).toBe(0.7);
  });

  it("スキル一致は必要スキルに対する割合", () => {
    const company = makeCompany({ requiredSkills: ["PC基本操作", "電話対応"] });
    expect(skillMatchScore(makeParticipant(), company)).toBe(0.5);
  });

  it("必要な配慮に1つでも対応できなければ不可", () => {
    const participant = makeParticipant({ accommodations: ["静かな環境", "送迎"] });
    expect(accommodationsSupported(participant, makeCompany())).toBe(false);
  });
});

describe("runOptimization", () => {
  const participant = makeParticipant();
  const company = makeCompany();

  function successResponse(): OptimizerResponse {
    return {
      status: "SUCCEEDED",
      runId: "x",
      solver: "sa",
      variableCount: 1,
      constraintCount: 1,
      executionTimeMs: 12,
      energy: -1.5,
      candidates: [
        {
          assignments: [{ participantId: "p0", companyId: "c0", periodId: "t0" }],
          score: 2.1,
          scoreBreakdown: { desire: 1, skill: 0.8, fairness: 0.3, rotation: 0 },
          violations: [],
          reasons: [
            { participantId: "p0", companyId: "c0", codes: ["DESIRE_MATCH", "ACCOMMODATION_OK"] },
          ],
          energy: -1.5,
        },
      ],
    };
  }

  const input = {
    participantIds: [participant.id],
    companyIds: [company.id],
    periodStart: "2026-07-01",
    periodEnd: "2026-07-05",
    solver: "sa" as const,
    maxCandidates: 3,
  };

  it("成功時: 匿名IDを実IDへ復元し、日本語の提案理由つきで保存する", async () => {
    const { deps } = makeDeps({
      participants: [participant],
      companies: [company],
      response: successResponse(),
    });
    const run = await runOptimization(admin, input, deps);

    expect(run.status).toBe("SUCCEEDED");
    const candidates = run.candidates as StoredCandidate[];
    expect(candidates[0]!.assignments[0]!.participantId).toBe(participant.id);
    expect(candidates[0]!.assignments[0]!.participantName).toBe(participant.name);
    expect(candidates[0]!.assignments[0]!.reasons).toContain("希望職種と一致");
    expect(run.violationCount).toBe(0);
  });

  it("optimizer へ個人情報を送らない（匿名 ID と数値のみ）", async () => {
    const { deps, state } = makeDeps({
      participants: [participant],
      companies: [company],
      response: successResponse(),
    });
    await runOptimization(admin, input, deps);

    const sent = JSON.stringify(state.requests[0]);
    expect(sent).not.toContain(participant.name);
    expect(sent).not.toContain(company.name);
    expect(sent).not.toContain(participant.id); // 実 UUID も送らない
    expect(sent).toContain('"p0"');
  });

  it("確定済み割当がある利用者は対象外（unavailable）になる", async () => {
    const { deps, state } = makeDeps({
      participants: [participant],
      companies: [company],
      response: successResponse(),
      busy: true,
    });
    await runOptimization(admin, input, deps);
    const request = state.requests[0] as { participants: { unavailablePeriods: string[] }[] };
    expect(request.participants[0]!.unavailablePeriods).toEqual(["t0"]);
  });

  it("有効定員 = 登録定員 - 占有数 で送られる", async () => {
    const { deps, state } = makeDeps({
      participants: [participant],
      companies: [company], // capacity 2
      response: successResponse(),
      occupied: 1,
    });
    await runOptimization(admin, input, deps);
    const request = state.requests[0] as { companies: { capacity: Record<string, number> }[] };
    expect(request.companies[0]!.capacity.t0).toBe(1);
  });

  it("optimizer の定員超過をサーバー側でも検出する（独立再検証）", async () => {
    const response = successResponse();
    response.candidates[0]!.assignments = [
      { participantId: "p0", companyId: "c0", periodId: "t0" },
      { participantId: "p0", companyId: "c0", periodId: "t0" },
    ];
    const smallCompany = makeCompany({ id: company.id, capacity: 1 });
    const { deps } = makeDeps({
      participants: [participant],
      companies: [smallCompany],
      response,
    });
    const run = await runOptimization(admin, { ...input }, deps);
    const candidates = run.candidates as StoredCandidate[];
    expect(candidates[0]!.violations.length).toBeGreaterThan(0);
    expect(run.violationCount).toBeGreaterThan(0);
  });

  it("実機（dwave）は管理者以外 FORBIDDEN", async () => {
    const { deps } = makeDeps({ participants: [participant], companies: [company] });
    await expect(
      runOptimization(staffMember, { ...input, solver: "dwave" }, deps),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("optimizer 失敗時は FAILED として記録される", async () => {
    const { deps, state } = makeDeps({
      participants: [participant],
      companies: [company],
      response: { status: "FAILED", runId: "x", errorMessage: "変数数が上限超過", candidates: [] },
    });
    const run = await runOptimization(admin, input, deps);
    expect(run.status).toBe("FAILED");
    expect(run.errorMessage).toContain("上限");
    expect(state.proposed).toHaveLength(0);
  });
});

describe("adoptCandidate", () => {
  const candidate: StoredCandidate = {
    assignments: [
      {
        participantId: crypto.randomUUID(),
        participantName: "利用者A",
        companyId: crypto.randomUUID(),
        companyName: "テスト株式会社",
        startDate: "2026-07-01",
        endDate: "2026-07-05",
        reasons: ["希望職種と一致"],
      },
    ],
    score: 2.1,
    scoreBreakdown: {},
    violations: [],
    energy: null,
  };

  it("候補を採用すると PROPOSED の割当が作られ selectedCandidate が保存される", async () => {
    const run = makeRun({ status: "SUCCEEDED", candidates: [candidate] });
    const { deps, state } = makeDeps({ participants: [], companies: [], existingRun: run });

    const updated = await adoptCandidate(run.id, 0, deps);
    expect(state.proposed).toHaveLength(1);
    expect((state.proposed[0] as { proposalReason: string }).proposalReason).toBe("希望職種と一致");
    expect(updated.selectedCandidate).not.toBeNull();
  });

  it("制約違反のある候補は採用できない", async () => {
    const bad = { ...candidate, violations: ["SERVER_CAPACITY:テスト株式会社"] };
    const run = makeRun({ status: "SUCCEEDED", candidates: [bad] });
    const { deps } = makeDeps({ participants: [], companies: [], existingRun: run });
    await expect(adoptCandidate(run.id, 0, deps)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("成功していない実行の候補は採用できない", async () => {
    const run = makeRun({ status: "FAILED" });
    const { deps } = makeDeps({ participants: [], companies: [], existingRun: run });
    await expect(adoptCandidate(run.id, 0, deps)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("二重採用はできない", async () => {
    const run = makeRun({
      status: "SUCCEEDED",
      candidates: [candidate],
      selectedCandidate: candidate,
    });
    const { deps } = makeDeps({ participants: [], companies: [], existingRun: run });
    await expect(adoptCandidate(run.id, 0, deps)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
