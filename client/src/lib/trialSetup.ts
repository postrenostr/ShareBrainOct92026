import { apiRequest, queryClient } from "./queryClient";
import type { Stripe, StripeElements } from "@stripe/stripe-js";

export function getStripeKeyMode(key: string): "live" | "test" | undefined {
  if (key.startsWith("pk_live_")) return "live";
  if (key.startsWith("pk_test_")) return "test";
  return undefined;
}

export function trialErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unable to finish trial signup. Please try again.";
  const jsonStart = error.message.indexOf("{");
  if (jsonStart !== -1) {
    try {
      const details = JSON.parse(error.message.slice(jsonStart));
      if (typeof details.message === "string") return details.message;
    } catch {
      return "Unable to finish trial signup. Please try again.";
    }
  }
  return error.message || "Unable to finish trial signup. Please try again.";
}

export async function completeTrialSetup(setupIntentId: string) {
  const response = await apiRequest("POST", "/api/complete-trial-setup", { setupIntentId });
  const result = await response.json();
  if (result.success !== true || result.subscriptionStatus !== "trial") {
    throw new Error("Your trial could not be activated.");
  }
  await refreshTrialAccess();
  return result;
}

export async function confirmTrialPayment(
  stripe: Pick<Stripe, "confirmSetup">,
  elements: StripeElements,
  returnUrl: string,
) {
  const result = await stripe.confirmSetup({
    elements,
    confirmParams: { return_url: returnUrl },
    redirect: "if_required",
  });
  if (result.error) throw new Error(result.error.message || "Your card could not be saved.");
  if (!result.setupIntent) throw new Error("Payment method confirmation has not completed.");
  return completeTrialSetup(result.setupIntent.id);
}

export function trialReturnPath(
  location: Pick<Location, "pathname" | "search" | "hash">,
  activated = false,
) {
  const parameters = new URLSearchParams(location.search);
  parameters.delete("setup_intent_client_secret");
  if (activated) {
    parameters.delete("setup_intent");
    parameters.delete("redirect_status");
  }
  const query = parameters.toString();
  return location.pathname + (query ? `?${query}` : "") + location.hash;
}

export async function refreshTrialAccess() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/user/subscription-status"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/user/trial-status"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }),
  ]);
}

export function hasActiveTrial(status: {
  isTrialActive?: boolean;
  needsSubscription?: boolean;
  subscriptionStatus?: string;
}) {
  return status.isTrialActive === true &&
    status.needsSubscription === false &&
    status.subscriptionStatus === "trial";
}
