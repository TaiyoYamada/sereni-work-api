import { NotFoundError } from "../../lib/errors";
import { companiesRepository, type CompaniesRepository } from "./companies.repository";

export type { Company } from "./companies.schema";
import type {
  Company,
  CreateCompanyInput,
  ListCompaniesQuery,
  UpdateCompanyInput,
} from "./companies.schema";

export async function listCompanies(
  query: ListCompaniesQuery,
  repo: CompaniesRepository = companiesRepository,
): Promise<{ rows: Company[]; total: number }> {
  return repo.list(query);
}

export async function getCompany(
  id: string,
  repo: CompaniesRepository = companiesRepository,
): Promise<Company> {
  const company = await repo.findById(id);
  if (!company) throw new NotFoundError("実習先企業が見つかりません");
  return company;
}

export async function getCompaniesByIds(
  ids: string[],
  repo: CompaniesRepository = companiesRepository,
): Promise<Company[]> {
  return repo.findByIds(ids);
}

export async function createCompany(
  input: CreateCompanyInput,
  repo: CompaniesRepository = companiesRepository,
): Promise<Company> {
  return repo.create(input);
}

export async function updateCompany(
  id: string,
  input: UpdateCompanyInput,
  repo: CompaniesRepository = companiesRepository,
): Promise<{ before: Company; after: Company }> {
  const before = await repo.findById(id);
  if (!before) throw new NotFoundError("実習先企業が見つかりません");
  const after = await repo.update(id, input);
  if (!after) throw new NotFoundError("実習先企業が見つかりません");
  return { before, after };
}
