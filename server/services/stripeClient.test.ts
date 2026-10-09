import { describe, expect, it, vi } from "vitest";
import { createStripeClient, getSubscriptionClientSecret } from "./stripeClient";

describe("connected Stripe client", () => {
  it("preserves nested Stripe form parameters and the imported API version", async () => {
    const proxy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "seti_example" })));
    const client = createStripeClient({ proxy });
    await client.setupIntents.create({
      customer: "cus_example",
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { userId: "example" },
    });
    const [connector, path, options] = proxy.mock.calls[0];
    expect(connector).toBe("stripe");
    expect(path).toBe("/v1/setup_intents");
    expect(options.method).toBe("POST");
    expect(options.headers["Stripe-Version"]).toBe("2023-10-16");
    const body = new URLSearchParams(options.body);
    expect(body.get("payment_method_types[0]")).toBe("card");
    expect(body.get("metadata[userId]")).toBe("example");
    expect(body.get("customer")).toBe("cus_example");
  });

  it("uses DELETE and escapes identifiers when cancelling a subscription", async () => {
    const proxy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "sub_example" })));
    await createStripeClient({ proxy }).subscriptions.cancel("sub/example");
    expect(proxy.mock.calls[0][1]).toBe("/v1/subscriptions/sub%2Fexample");
    expect(proxy.mock.calls[0][2].method).toBe("DELETE");
  });

  it("reports upstream errors instead of returning a successful result", async () => {
    const proxy = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "Request rejected" } }),
      { status: 400 },
    ));
    await expect(createStripeClient({ proxy }).subscriptions.retrieve("sub_example"))
      .rejects.toThrow("Request rejected");
  });

  it("safely handles expanded and unexpanded subscription invoices", () => {
    expect(getSubscriptionClientSecret({ id: "sub_example", latest_invoice: "in_example" }))
      .toBeUndefined();
    expect(getSubscriptionClientSecret({
      id: "sub_example",
      latest_invoice: { payment_intent: { client_secret: "example" } },
    })).toBe("example");
  });
});
