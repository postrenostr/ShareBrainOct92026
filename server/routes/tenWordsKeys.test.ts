import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { createTenWordsKeysRouter } from "./tenWordsKeys";
import type { TenWordsApiKeys } from "../services/tenWords/apiKeys";
const id = "da403209-1ddc-4cc7-bd09-af6f09ecbc0b";
function setup(signedIn = true) {
  const clients = { list: vi.fn(async () => []), create: vi.fn(async () => ({ key: "shown-once", client: { id } })),
    rotate: vi.fn(async () => null), revoke: vi.fn(async () => null) };
  const app = express(); app.use(express.json());
  app.use("/clients", createTenWordsKeysRouter(clients as unknown as TenWordsApiKeys, (req, res, next) => {
    if (!signedIn) return void res.sendStatus(401);
    req.user = { claims: { sub: "owner" } } as any; next();
  }));
  return { app, clients };
}
describe("10words key management", () => {
  it("requires sessions and rejects API-key administration", async () => {
    await request(setup(false).app).get("/clients").expect(401);
    const { app, clients } = setup();
    await request(app).get("/clients").set("Authorization", "Bearer anything").expect(403);
    expect(clients.list).not.toHaveBeenCalled();
  });
  it("creates scoped clients using the authenticated identity and no-store responses", async () => {
    const { app, clients } = setup();
    const response = await request(app).post("/clients").send({ name: " Voice ", scopes: ["audio:read"], rateLimit: 30 }).expect(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.key).toBe("shown-once");
    expect(clients.create).toHaveBeenCalledWith("owner", { name: "Voice", scopes: ["audio:read"], rateLimit: 30 });
    const listed = await request(app).get("/clients").expect(200);
    expect(listed.body).not.toHaveProperty("key");
    expect(clients.list).toHaveBeenCalledWith("owner");
  });
  it("rejects invalid scopes, limits and spoofed owner fields", async () => {
    const { app, clients } = setup();
    for (const body of [{ name: "", scopes: ["audio:read"] }, { name: "App", scopes: [] },
      { name: "App", scopes: ["admin"] }, { name: "App", scopes: ["audio:read"], rateLimit: 121 },
      { name: "App", scopes: ["audio:read"], ownerId: "someone" }])
      await request(app).post("/clients").send(body).expect(400);
    expect(clients.create).not.toHaveBeenCalled();
  });
  it("rejects foreign origins and non-JSON mutations", async () => {
    const { app, clients } = setup();
    await request(app).post("/clients").set("Origin", "https://foreign.example").send({}).expect(403);
    await request(app).post("/clients").type("form").send({ name: "App" }).expect(415);
    expect(clients.create).not.toHaveBeenCalled();
  });
  it("scopes rotation/revocation to owner and returns 404 for inaccessible clients", async () => {
    const { app, clients } = setup();
    await request(app).post(`/clients/${id}/rotate`).send({}).expect(404);
    await request(app).post(`/clients/${id}/revoke`).send({}).expect(404);
    expect(clients.rotate).toHaveBeenCalledWith("owner", id);
    expect(clients.revoke).toHaveBeenCalledWith("owner", id);
    await request(app).post("/clients/invalid/rotate").send({}).expect(400);
  });
  it("does not leak database errors", async () => {
    const { app, clients } = setup(); clients.list.mockRejectedValueOnce(new Error("database secret"));
    const response = await request(app).get("/clients").expect(503);
    expect(JSON.stringify(response.body)).not.toContain("database secret");
  });
});
