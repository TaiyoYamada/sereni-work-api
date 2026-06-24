import { configureOpenAPI } from "./lib/configure-openapi";
import { createApp } from "./lib/create-app";
import assignments from "./modules/assignments/assignments.index";
import companies from "./modules/companies/companies.index";
import dashboard from "./modules/dashboard/dashboard.index";
import evaluations from "./modules/evaluations/evaluations.index";
import health from "./modules/health/health.index";
import optimization from "./modules/optimization/optimization.index";
import participants from "./modules/participants/participants.index";
import reflections from "./modules/reflections/reflections.index";
import reports from "./modules/reports/reports.index";
import staff from "./modules/staff/staff.index";
import tags from "./modules/tags/tags.index";

const app = createApp();
configureOpenAPI(app);

// モジュールはここへメソッドチェーンで追加する（RPC 型導出のため別文にしない）
const routes = app
  .route("/", health)
  .route("/", participants)
  .route("/", companies)
  .route("/", staff)
  .route("/", assignments)
  .route("/", reports)
  .route("/", evaluations)
  .route("/", reflections)
  .route("/", optimization)
  .route("/", dashboard)
  .route("/", tags);

export type AppType = typeof routes;
export default routes;
