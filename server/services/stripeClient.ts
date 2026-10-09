import Stripe from "stripe";

interface SubscriptionResult {
  id: string;
  latest_invoice?: unknown;
}

export function createStripeClient(secretKey = process.env.STRIPE_SECRET_KEY) {
  if (!secretKey) {
    throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    // Keep the imported app's API version. SDK types describe a newer version.
    apiVersion: "2023-10-16" as Stripe.StripeConfig["apiVersion"],
  });
}

export const stripe = createStripeClient();

export function getSubscriptionClientSecret(subscription: SubscriptionResult) {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice !== "object" || !("payment_intent" in invoice)) {
    return undefined;
  }
  const intent = invoice.payment_intent;
  if (!intent || typeof intent !== "object" || !("client_secret" in intent)) {
    return undefined;
  }
  return typeof intent.client_secret === "string" || intent.client_secret === null
    ? intent.client_secret
    : undefined;
}
