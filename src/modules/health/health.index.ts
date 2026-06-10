import { createRouter } from "../../lib/create-app";
import * as routes from "./health.routes";

const router = createRouter().openapi(routes.get, (c) => c.json({ status: "ok" as const }, 200));

export default router;
