import { NotFoundError } from "../../lib/errors";
import type { Participant, Staff } from "../../lib/types";
import { assertCanEditParticipant } from "./participants.policy";
import { participantsRepository, type ParticipantsRepository } from "./participants.repository";
import type {
  CreateParticipantInput,
  ListParticipantsQuery,
  UpdateParticipantInput,
} from "./participants.schema";

export async function listParticipants(
  query: ListParticipantsQuery,
  repo: ParticipantsRepository = participantsRepository,
): Promise<{ rows: Participant[]; total: number }> {
  return repo.list(query);
}

export async function getParticipant(
  id: string,
  repo: ParticipantsRepository = participantsRepository,
): Promise<Participant> {
  const participant = await repo.findById(id);
  if (!participant) throw new NotFoundError("利用者が見つかりません");
  return participant;
}

export async function getParticipantsByIds(
  ids: string[],
  repo: ParticipantsRepository = participantsRepository,
): Promise<Participant[]> {
  return repo.findByIds(ids);
}

export async function createParticipant(
  input: CreateParticipantInput,
  repo: ParticipantsRepository = participantsRepository,
): Promise<Participant> {
  return repo.create(input);
}

export async function updateParticipant(
  actor: Staff,
  id: string,
  input: UpdateParticipantInput,
  repo: ParticipantsRepository = participantsRepository,
): Promise<{ before: Participant; after: Participant }> {
  const before = await repo.findById(id);
  if (!before) throw new NotFoundError("利用者が見つかりません");

  assertCanEditParticipant(actor, before);

  const after = await repo.update(id, input);
  if (!after) throw new NotFoundError("利用者が見つかりません");
  return { before, after };
}
