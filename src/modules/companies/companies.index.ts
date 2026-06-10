import { createRouter } from "../../lib/create-app";
import * as handlers from "./companies.handlers";
import * as routes from "./companies.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.create, handlers.create)
  .openapi(routes.patch, handlers.patch);

export default router;
