import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type Stripe from "stripe";
import { createCompleteTrialSetupHandler } from "./trialSetup";

const now = new Date("2026-10-09T12:00:00Z");
const user = {
  id: "owner_fixture",
  stripeCustomerId: "cus_owner_fixture",
  subscriptionStatus: "expired",
  trialStartDate: null as Date | null,
  trialEndDate: null as Date | null,
};

function fixture(overrides: Partial<typeof user> = {}, intentOverrides: Partial<Stripe.SetupIntent> = {}) {
  const currentUser = { ...user, ...overrides };
  const intent = {
    id: "seti_fixture",
    customer: user.stripeCustomerId,
    status: "succeeded",
    payment_method: "pm_card_fixture",
    metadata: { userId: user.id, purpose: "trial_signup" },
    ...intentOverrides,
  } as Stripe.SetupIntent;
  const storage = {
    getUser: vi.fn().mockResolvedValue(currentUser),
    updateUser: vi.fn().mockImplementation(async (_id, updates) => ({ ...currentUser, ...updates })),
  };
  const stripe = { setupIntents: { retrieve: vi.fn().mockResolvedValue(intent) } };
  const handler = createCompleteTrialSetupHandler({ storage, stripe, now: () => new Date(now) });
  async function invoke(body: unknown = { setupIntentId: "seti_fixture" }, authenticated = true) {
    const response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    await handler({
      user: authenticated ? { id: user.id } : undefined,
      body,
    } as unknown as Request, response as unknown as Response, vi.fn());
    return response;
  }
  return { invoke, storage, stripe };
}

describe("verified trial activation", () => {
  it("starts exactly 14 days after a verified setup, including a never-started expired placeholder", async () => {
    const test = fixture();
    const response = await test.invoke();
    expect(test.stripe.setupIntents.retrieve).toHaveBeenCalledWith("seti_fixture");
    expect(test.storage.updateUser).toHaveBeenCalledWith(user.id, {
      trialStartDate: now,
      trialEndDate: new Date("2026-10-23T12:00:00Z"),
      subscriptionStatus: "trial",
    });
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, subscriptionStatus: "trial" }));
    expect(response.json.mock.calls[0][0]).not.toHaveProperty("user");
  });

  it("requires authentication", async () => {
    const test = fixture();
    const response = await test.invoke({}, false);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(test.stripe.setupIntents.retrieve).not.toHaveBeenCalled();
    expect(test.storage.updateUser).not.toHaveBeenCalled();
  });

  it.each([{}, { setupIntentId: "" }, { setupIntentId: "pi_wrong_type" }])(
    "requires an explicit setup-intent ID: %j", async body => {
      const test = fixture();
      const response = await test.invoke(body);
      expect(response.status).toHaveBeenCalledWith(400);
      expect(test.storage.updateUser).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing user", async () => {
    const test = fixture();
    test.storage.getUser.mockResolvedValue(undefined);
    expect((await test.invoke()).status).toHaveBeenCalledWith(404);
  });

  it("requires an associated customer before verification", async () => {
    const test = fixture({ stripeCustomerId: null as unknown as string });
    expect((await test.invoke()).status).toHaveBeenCalledWith(400);
    expect(test.stripe.setupIntents.retrieve).not.toHaveBeenCalled();
  });

  it.each([
    { customer: "cus_other_fixture" },
    { metadata: { userId: "other_fixture", purpose: "trial_signup" } },
    { metadata: { userId: user.id, purpose: "unrelated_setup" } },
  ])("rejects a setup belonging to another user or purpose: %j", async override => {
    const test = fixture({}, override);
    expect((await test.invoke()).status).toHaveBeenCalledWith(403);
    expect(test.storage.updateUser).not.toHaveBeenCalled();
  });

  it.each(["requires_payment_method", "requires_action", "processing", "canceled"] as const)(
    "does not activate a %s setup", async status => {
      const test = fixture({}, { status });
      expect((await test.invoke()).status).toHaveBeenCalledWith(400);
      expect(test.storage.updateUser).not.toHaveBeenCalled();
    },
  );

  it("requires a saved payment method even for a succeeded setup", async () => {
    const test = fixture({}, { payment_method: null });
    expect((await test.invoke()).status).toHaveBeenCalledWith(400);
    expect(test.storage.updateUser).not.toHaveBeenCalled();
  });

  it("accepts repeated completion of an active trial without extending it", async () => {
    const test = fixture({
      subscriptionStatus: "trial",
      trialStartDate: new Date("2026-10-05T12:00:00Z"),
      trialEndDate: new Date("2026-10-19T12:00:00Z"),
    });
    const response = await test.invoke();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true, trialEndDate: new Date("2026-10-19T12:00:00Z"),
    }));
    expect(test.storage.updateUser).not.toHaveBeenCalled();
  });

  it.each(["expired", "cancelled", "trial"])("does not restart an ended %s trial", async status => {
    const test = fixture({
      subscriptionStatus: status,
      trialStartDate: new Date("2026-09-01T12:00:00Z"),
      trialEndDate: new Date("2026-09-15T12:00:00Z"),
    });
    expect((await test.invoke()).status).toHaveBeenCalledWith(409);
    expect(test.storage.updateUser).not.toHaveBeenCalled();
  });

  it("does not replace a paid subscription with a trial", async () => {
    const test = fixture({ subscriptionStatus: "active" });
    expect((await test.invoke()).status).toHaveBeenCalledWith(409);
    expect(test.storage.updateUser).not.toHaveBeenCalled();
  });

  it("does not report success when the database update fails", async () => {
    const test = fixture();
    test.storage.updateUser.mockResolvedValue(undefined);
    expect((await test.invoke()).status).toHaveBeenCalledWith(500);
  });

  it("does not disclose Stripe errors or update access when verification fails", async () => {
    const test = fixture();
    test.stripe.setupIntents.retrieve.mockRejectedValue(new Error("private fixture details"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await test.invoke();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify(response.json.mock.calls)).not.toContain("private fixture details");
      expect(test.storage.updateUser).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
