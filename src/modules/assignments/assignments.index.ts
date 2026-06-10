import { createRouter } from "../../lib/create-app";
import * as handlers from "./assignments.handlers";
import * as meRoutes from "./assignments.me.routes";
import * as routes from "./assignments.routes";

const router = createRouter()
  // 職員向け
  .openapi(routes.list, handlers.list)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.create, handlers.create)
  .openapi(routes.patch, handlers.patch)
  .openapi(routes.confirm, handlers.confirm)
  .openapi(routes.start, handlers.start)
  .openapi(routes.complete, handlers.complete)
  .openapi(routes.cancel, handlers.cancel)
  // 利用者本人向け（/me）
  .openapi(meRoutes.today, handlers.today)
  .openapi(meRoutes.listMine, handlers.listMine);

export default router;
