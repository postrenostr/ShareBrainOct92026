import { ReplitConnectors } from "@replit/connectors-sdk";
import type Stripe from "stripe";

// Preserve Stripe's form encoding and the API version used by the imported app.
function encodeParameters(parameters: object): URLSearchParams {
  const body = new URLSearchParams();
  function append(key: string, value: unknown) {
    if (value === undefined) return;
    if (value === null) {
      body.append(key, "");
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${key}[${index}]`, item));
    } else if (typeof value === "object") {
      Object.entries(value).forEach(([name, item]) => append(`${key}[${name}]`, item));
    } else {
      body.append(key, String(value));
    }
  }
  Object.entries(parameters).forEach(([key, value]) => append(key, value));
  return body;
}

interface SubscriptionResult {
  id: string;
  latest_invoice?: string | {
    payment_intent?: string | { client_secret: string | null } | null;
  } | null;
}

export function createStripeClient(
  connectors: Pick<ReplitConnectors, "proxy"> = new ReplitConnectors(),
) {
  async function request<T>(method: string, path: string, parameters?: object): Promise<T> {
    const response = await connectors.proxy("stripe", path, {
      method,
      headers: {
        "Stripe-Version": "2023-10-16",
        ...(parameters ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      ...(parameters ? { body: encodeParameters(parameters).toString() } : {}),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || `Stripe request failed (${response.status})`);
    }
    return result as T;
  }

  return {
    paymentIntents: {
      create: (parameters: Stripe.PaymentIntentCreateParams) =>
        request<Stripe.PaymentIntent>("POST", "/v1/payment_intents", parameters),
    },
    customers: {
      create: (parameters: Stripe.CustomerCreateParams) =>
        request<Stripe.Customer>("POST", "/v1/customers", parameters),
    },
    setupIntents: {
      create: (parameters: Stripe.SetupIntentCreateParams) =>
        request<Stripe.SetupIntent>("POST", "/v1/setup_intents", parameters),
    },
    subscriptions: {
      cancel: (id: string) =>
        request<SubscriptionResult>("DELETE", `/v1/subscriptions/${encodeURIComponent(id)}`),
      retrieve: (id: string) =>
        request<SubscriptionResult>("GET", `/v1/subscriptions/${encodeURIComponent(id)}`),
      // Keep the imported application's legacy request shape and API version.
      create: (parameters: object) =>
        request<SubscriptionResult>("POST", "/v1/subscriptions", parameters),
    },
  };
}

export const stripe = createStripeClient();

export function getSubscriptionClientSecret(subscription: SubscriptionResult) {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") return undefined;
  const intent = invoice.payment_intent;
  return intent && typeof intent !== "string" ? intent.client_secret : undefined;
}
