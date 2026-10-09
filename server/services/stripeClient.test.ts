import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { createStripeClient, getSubscriptionClientSecret } from "./stripeClient";

vi.mock("stripe", () => ({
  default: vi.fn(function StripeClientMock() {}),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("direct Stripe client", () => {
  it("uses the Stripe SDK with the original API version", () => {
    createStripeClient("sk_test_unit_example");
    expect(Stripe).toHaveBeenLastCalledWith("sk_test_unit_example", {
      apiVersion: "2023-10-16",
    });
  });

  it("reads STRIPE_SECRET_KEY from the server environment", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_env_example");
    createStripeClient();
    expect(Stripe).toHaveBeenLastCalledWith("sk_test_env_example", {
      apiVersion: "2023-10-16",
    });
  });

  it("fails explicitly if the secret key is missing", () => {
    expect(() => createStripeClient("")).toThrow("Missing required Stripe secret: STRIPE_SECRET_KEY");
    vi.stubEnv("STRIPE_SECRET_KEY", undefined);
    expect(() => createStripeClient()).toThrow("Missing required Stripe secret: STRIPE_SECRET_KEY");
  });

  it("safely handles expanded and unexpanded subscription invoices", () => {
    expect(getSubscriptionClientSecret({ id: "sub_example", latest_invoice: "in_example" }))
      .toBeUndefined();
    expect(getSubscriptionClientSecret({
      id: "sub_example",
      latest_invoice: { payment_intent: { client_secret: "example" } },
    })).toBe("example");
    expect(getSubscriptionClientSecret({
      id: "sub_example",
      latest_invoice: { payment_intent: "pi_example" },
    })).toBeUndefined();
  });
});
