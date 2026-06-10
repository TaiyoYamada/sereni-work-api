import { configureOpenAPI } from "./lib/configure-openapi";
import { createApp } from "./lib/create-app";
import health from "./modules/health/health.index";

const app = createApp();
configureOpenAPI(app);

// モジュールはここへメソッドチェーンで追加する（RPC 型導出のため別文にしない）
const routes = app.route("/", health);

export type AppType = typeof routes;
export default routes;
