import { createRouter } from "../../lib/create-app";
import * as handlers from "./participants.handlers";
import * as routes from "./participants.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.create, handlers.create)
  .openapi(routes.issueAccount, handlers.issueAccount)
  .openapi(routes.resetAccountPassword, handlers.resetAccountPassword)
  .openapi(routes.patch, handlers.patch);

export default router;
