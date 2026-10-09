import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { requireValidSubscription, requireValidSubscriptionForCustomAgents } from "./requireValidSubscription";

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    updateUserSubscriptionStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function check(
  subscriptionStatus: string,
  options: { authenticated?: boolean; stripeCustomerId?: string | null; trialEndDate?: Date } = {},
) {
  vi.mocked(storage.getUser).mockResolvedValue({
    id: "fixture_user",
    subscriptionStatus,
    stripeCustomerId: options.stripeCustomerId ?? null,
    trialEndDate: options.trialEndDate ?? null,
  } as Awaited<ReturnType<typeof storage.getUser>>);
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  const next = vi.fn();
  await requireValidSubscription({
    isAuthenticated: () => options.authenticated !== false,
    user: { id: "fixture_user" },
  } as unknown as Request, response as unknown as Response, next);
  return { response, next };
}

describe("paid features remain protected after free login", () => {
  it.each(["none", "expired", "cancelled", "unknown"])("blocks a %s account from paid features", async status => {
    const { response, next } = await check(status);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("requires authentication even for an active subscription", async () => {
    const { response, next } = await check("active", { authenticated: false });
    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows paid subscribers", async () => {
    const { response, next } = await check("active");
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it("allows a confirmed unexpired trial", async () => {
    const { next } = await check("trial", {
      stripeCustomerId: "cus_fixture",
      trialEndDate: new Date(Date.now() + 86400000),
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not treat signing in as payment-method confirmation", async () => {
    const { response, next } = await check("trial", { trialEndDate: new Date(Date.now() + 86400000) });
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("does not allow an expired trial", async () => {
    const { response, next } = await check("trial", {
      stripeCustomerId: "cus_fixture",
      trialEndDate: new Date(Date.now() - 86400000),
    });
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("does not let custom-agent creation bypass payment checks", async () => {
    vi.mocked(storage.getUser).mockResolvedValue({
      id: "fixture_user", subscriptionStatus: "none",
    } as Awaited<ReturnType<typeof storage.getUser>>);
    const response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    const next = vi.fn();
    await requireValidSubscriptionForCustomAgents({
      isAuthenticated: () => true, user: { id: "fixture_user" }, body: { isPersonal: false },
    } as unknown as Request, response as unknown as Response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
