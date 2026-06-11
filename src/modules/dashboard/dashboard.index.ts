import { createRouter } from "../../lib/create-app";
import * as handlers from "./dashboard.handlers";
import * as routes from "./dashboard.routes";

const router = createRouter().openapi(routes.getDashboard, handlers.get);

export default router;
