import { apiRequest, queryClient } from "./queryClient";

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
  if (result.success !== true) throw new Error("Your trial could not be activated.");
  await refreshTrialAccess();
  return result;
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
