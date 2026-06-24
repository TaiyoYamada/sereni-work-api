import { describe, expect, it } from "vitest";

import { NotFoundError } from "../../lib/errors";
import type { Participant } from "../../lib/types";
import type { EvaluationsRepository } from "./evaluations.repository";
import type { ParticipantGrowthPoint } from "./evaluations.schema";
import { getParticipantGrowth, type EvaluationsDeps } from "./evaluations.service";

const point: ParticipantGrowthPoint = {
  assignmentId: "11111111-1111-1111-1111-111111111111",
  companyName: "A社",
  startDate: "2026-01-10",
  endDate: "2026-01-24",
  attitude: 4,
  aptitude: 3.5,
  communication: null,
  accommodationFit: 4,
  continuity: 3,
};

function makeDeps(overrides: {
  growth?: ParticipantGrowthPoint[];
  participantExists?: boolean;
}): EvaluationsDeps {
  // 成長取得のみを検証するため、未使用メソッドはダミー実装にする
  const repo = {
    async listByAssignment() {
      return [];
    },
    async listParticipantGrowth() {
      return overrides.growth ?? [];
    },
    async upsert() {
      throw new Error("not used");
    },
  } as unknown as EvaluationsRepository;

  return {
    repo,
    getAssignmentById: (async () => {
      throw new Error("not used");
    }) as EvaluationsDeps["getAssignmentById"],
    getParticipantById: async (id: string) => {
      if (overrides.participantExists === false) {
        throw new NotFoundError("利用者が見つかりません");
      }
      return { id } as Participant;
    },
  };
}

describe("getParticipantGrowth", () => {
  it("利用者が存在すれば成長ポイントを返す", async () => {
    const result = await getParticipantGrowth("p1", makeDeps({ growth: [point] }));
    expect(result).toEqual([point]);
  });

  it("評価がなければ空配列を返す", async () => {
    const result = await getParticipantGrowth("p1", makeDeps({ growth: [] }));
    expect(result).toEqual([]);
  });

  it("利用者が存在しなければ NOT_FOUND を投げる", async () => {
    await expect(
      getParticipantGrowth("missing", makeDeps({ participantExists: false })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
