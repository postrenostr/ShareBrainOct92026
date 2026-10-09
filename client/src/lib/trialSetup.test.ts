import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import { apiRequest, queryClient } from "./queryClient";
import {
  completeTrialSetup, confirmTrialPayment, getStripeKeyMode, hasActiveTrial,
  trialErrorMessage, trialReturnPath,
} from "./trialSetup";

vi.mock("./queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
}));

const request = vi.mocked(apiRequest);
beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue(new Response(JSON.stringify({ success: true, subscriptionStatus: "trial" })));
});

describe("trial payment confirmation", () => {
  it("distinguishes public-key modes without treating a private key as public", () => {
    expect(getStripeKeyMode("pk_live_fixture")).toBe("live");
    expect(getStripeKeyMode("pk_test_fixture")).toBe("test");
    expect(getStripeKeyMode("sk_live_fixture")).toBeUndefined();
  });

  it("passes the intent ID and refreshes the subscription cache actually used by the app", async () => {
    await completeTrialSetup("seti_fixture");
    expect(request).toHaveBeenCalledWith("POST", "/api/complete-trial-setup", { setupIntentId: "seti_fixture" });
    for (const path of ["/api/user/subscription-status", "/api/user/trial-status", "/api/auth/user"]) {
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [path] });
    }
  });

  it("does not show activated access when the server rejects setup", async () => {
    request.mockRejectedValueOnce(new Error('400: {"message":"Card is not confirmed"}'));
    await expect(completeTrialSetup("seti_fixture")).rejects.toThrow("Card is not confirmed");
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it.each([{ success: false }, { success: true, subscriptionStatus: "expired" }])(
    "does not accept an unverified success response: %j", async result => {
      request.mockResolvedValueOnce(new Response(JSON.stringify(result)));
      await expect(completeTrialSetup("seti_fixture")).rejects.toThrow("could not be activated");
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    },
  );

  it("keeps normal card confirmation on-page so backend activation can finish", async () => {
    const confirmSetup = vi.fn().mockResolvedValue({ setupIntent: { id: "seti_fixture", status: "succeeded" } });
    const stripe = { confirmSetup } as unknown as Pick<Stripe, "confirmSetup">;
    const elements = {} as StripeElements;
    await confirmTrialPayment(stripe, elements, "https://example.test/trial-success");
    expect(confirmSetup).toHaveBeenCalledWith({
      elements, confirmParams: { return_url: "https://example.test/trial-success" }, redirect: "if_required",
    });
    expect(request).toHaveBeenCalledWith("POST", "/api/complete-trial-setup", { setupIntentId: "seti_fixture" });
  });

  it("does not activate a trial when Stripe reports a card error", async () => {
    const stripe = { confirmSetup: vi.fn().mockResolvedValue({ error: { message: "Card setup failed" } }) };
    await expect(confirmTrialPayment(stripe as unknown as Pick<Stripe, "confirmSetup">, {} as StripeElements, "https://example.test/trial-success"))
      .rejects.toThrow("Card setup failed");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not claim activation if confirmation never returns an intent", async () => {
    const stripe = { confirmSetup: vi.fn().mockResolvedValue({}) };
    await expect(confirmTrialPayment(stripe as unknown as Pick<Stripe, "confirmSetup">, {} as StripeElements, "https://example.test/trial-success"))
      .rejects.toThrow("has not completed");
    expect(request).not.toHaveBeenCalled();
  });

  it("only recognizes a verified, unblocked trial as active", () => {
    expect(hasActiveTrial({ isTrialActive: true, needsSubscription: false, subscriptionStatus: "trial" })).toBe(true);
    expect(hasActiveTrial({ isTrialActive: true, needsSubscription: true, subscriptionStatus: "trial" })).toBe(false);
    expect(hasActiveTrial({ isTrialActive: true, needsSubscription: false, subscriptionStatus: "active" })).toBe(false);
    expect(hasActiveTrial({})).toBe(false);
  });

  it("strips the return secret immediately but keeps the intent ID for retry", () => {
    expect(trialReturnPath({
      pathname: "/trial-success",
      search: "?setup_intent=seti_fixture&setup_intent_client_secret=private_fixture&redirect_status=succeeded&ref=welcome",
      hash: "#details",
    })).toBe("/trial-success?setup_intent=seti_fixture&redirect_status=succeeded&ref=welcome#details");
  });

  it("cleans all Stripe return parameters after verified activation", () => {
    expect(trialReturnPath({
      pathname: "/trial-success",
      search: "?setup_intent=seti_fixture&setup_intent_client_secret=private_fixture&redirect_status=succeeded&ref=welcome",
      hash: "",
    }, true)).toBe("/trial-success?ref=welcome");
  });

  it("extracts readable API errors", () => {
    expect(trialErrorMessage(new Error('400: {"message":"Your card needs confirmation."}')))
      .toBe("Your card needs confirmation.");
  });
});
