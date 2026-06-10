import { describe, expect, it } from "vitest";

import app from "../../app";

describe("GET /health", () => {
  it("200 と status: ok を返す", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("存在しないパス", () => {
  it("統一エラー形式の 404 を返す", async () => {
    const res = await app.request("/no-such-path");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
