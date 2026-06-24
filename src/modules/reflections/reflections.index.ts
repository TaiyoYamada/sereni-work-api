import { createRouter } from "../../lib/create-app";
import * as handlers from "./reflections.handlers";
import * as routes from "./reflections.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create)
  .openapi(routes.update, handlers.update)
  .openapi(routes.remove, handlers.remove);

export default router;
