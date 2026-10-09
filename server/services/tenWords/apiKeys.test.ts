import { describe, it, expect, vi } from "vitest";
import { hashTenWordsKey, TenWordsApiKeys } from "./apiKeys";

describe("10words client credentials", () => {
  it("generates unique secrets and stores only their hashes", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: "client", name: "Voice" }] }));
    const clients = new TenWordsApiKeys({ query });
    const first = await clients.create("owner", { name: "Voice", scopes: ["lessons:read"], rateLimit: 30 });
    const second = await clients.create("owner", { name: "Other", scopes: ["audio:read"], rateLimit: 60 });
    expect(first.key).toMatch(/^tw_[a-f0-9]{64}$/);
    expect(second.key).not.toBe(first.key);
    expect(query.mock.calls[0][1]).toContain(hashTenWordsKey(first.key));
    expect(JSON.stringify(query.mock.calls)).not.toContain(first.key);
    expect(first.client).not.toHaveProperty("keyHash");
  });
  it("binds list, rotation and revocation to the owner and keeps rotation counters", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const clients = new TenWordsApiKeys({ query });
    await clients.list("owner");
    expect(query.mock.calls[0][1]).toEqual(["owner"]);
    expect(await clients.rotate("owner", "client")).toBeNull();
    expect(query.mock.calls[1][0]).toContain("owner_id=$1 AND id=$2 AND revoked_at IS NULL");
    expect(query.mock.calls[1][0]).not.toContain("usage_count=");
    expect(await clients.revoke("owner", "client")).toBeNull();
    expect(query.mock.calls[2][1]).toEqual(["owner", "client"]);
  });
  it("consumes limits atomically in the database using hashes and permissions", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: "client" }] }));
    const clients = new TenWordsApiKeys({ query });
    expect(await clients.authorize("secret", "audio:read")).toBe("ok");
    expect(query.mock.calls[0][1]).toEqual([hashTenWordsKey("secret"), "audio:read"]);
    expect(query.mock.calls[0][0]).toContain("window_count<rate_limit");
    expect(query.mock.calls[0][0]).toContain("revoked_at IS NULL AND $2=ANY(scopes)");
  });
  it("distinguishes revoked, scope-restricted and rate-limited credentials", async () => {
    for (const [rows, expected] of [[[], "invalid"], [[{ scopes: ["languages:read"] }], "forbidden"], [[{ scopes: ["audio:read"] }], "limited"]] as const) {
      const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows });
      expect(await new TenWordsApiKeys({ query }).authorize("secret", "audio:read")).toBe(expected);
    }
  });
});
