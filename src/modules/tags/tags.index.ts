import type { RouteHandler } from "@hono/zod-openapi";

import { createRouter } from "../../lib/create-app";
import type { AppEnv } from "../../lib/types";
import { tagsRepository } from "./tags.repository";
import * as routes from "./tags.routes";

// 集計1本だけの小さいモジュールのため service / handlers ファイルは分けない（CLAUDE.md の例外規定）
const getSuggestions: RouteHandler<typeof routes.getSuggestions, AppEnv> = async (c) => {
  return c.json(await tagsRepository.suggestions(), 200);
};

const router = createRouter().openapi(routes.getSuggestions, getSuggestions);

export default router;
