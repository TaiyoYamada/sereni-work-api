import { createRouter } from "../../lib/create-app";
import * as handlers from "./optimization.handlers";
import * as routes from "./optimization.routes";

const router = createRouter()
  .openapi(routes.create, handlers.create)
  .openapi(routes.list, handlers.list)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.adopt, handlers.adopt);

export default router;
