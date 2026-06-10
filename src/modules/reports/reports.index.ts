import { createRouter } from "../../lib/create-app";
import * as handlers from "./reports.handlers";
import * as meRoutes from "./reports.me.routes";
import * as routes from "./reports.routes";

const router = createRouter()
  // 職員向け
  .openapi(routes.list, handlers.list)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.review, handlers.review)
  .openapi(routes.revise, handlers.revise)
  .openapi(routes.addComment, handlers.createComment)
  // 利用者本人向け（/me）
  .openapi(meRoutes.listMine, handlers.listMine)
  .openapi(meRoutes.submitMine, handlers.submitMine)
  .openapi(meRoutes.submitPreCheck, handlers.submitPreCheck)
  .openapi(meRoutes.profile, handlers.profile);

export default router;
