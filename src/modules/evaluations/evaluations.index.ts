import { createRouter } from "../../lib/create-app";
import * as handlers from "./evaluations.handlers";
import * as routes from "./evaluations.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.upsert, handlers.upsert);

export default router;
