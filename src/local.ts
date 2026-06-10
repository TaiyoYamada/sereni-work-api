import { serve } from "@hono/node-server";

import app from "./app";
import { env } from "./env";

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${info.port}`);
});
