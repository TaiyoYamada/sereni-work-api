import { createRouter } from "../../lib/create-app";
import * as handlers from "./staff.handlers";
import * as routes from "./staff.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  // /staff/me は /staff/{id} より先に登録する（パスマッチの優先順位）
  .openapi(routes.getMe, handlers.getMe)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.create, handlers.create)
  .openapi(routes.patch, handlers.patch);

export default router;
