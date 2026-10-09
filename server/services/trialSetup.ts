import type { RequestHandler } from "express";
import type Stripe from "stripe";
import type { User } from "../../shared/schema";

type TrialUser = Pick<User, "id" | "stripeCustomerId" | "subscriptionStatus" | "trialStartDate" | "trialEndDate">;

interface TrialDependencies {
  storage: {
    getUser(id: string): Promise<TrialUser | undefined>;
    updateUser(id: string, updates: Partial<TrialUser>): Promise<TrialUser | undefined>;
  };
  stripe: {
    setupIntents: {
      retrieve(id: string): Promise<Stripe.SetupIntent>;
    };
  };
  now?: () => Date;
}

class TrialSetupError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function createCompleteTrialSetupHandler({
  storage,
  stripe,
  now = () => new Date(),
}: TrialDependencies): RequestHandler {
  return async (req, res) => {
    try {
      const userId = (req.user as { id?: string } | undefined)?.id;
      if (!userId) throw new TrialSetupError(401, "Sign in before starting a trial.");

      const setupIntentId = req.body?.setupIntentId;
      if (typeof setupIntentId !== "string" || !/^seti_[a-zA-Z0-9_]+$/.test(setupIntentId)) {
        throw new TrialSetupError(400, "Confirm your payment method before starting the trial.");
      }

      const user = await storage.getUser(userId);
      if (!user) throw new TrialSetupError(404, "User not found.");
      if (!user.stripeCustomerId) {
        throw new TrialSetupError(400, "No payment method setup was found for this account.");
      }

      const intent = await stripe.setupIntents.retrieve(setupIntentId);
      const customerId = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
      if (
        customerId !== user.stripeCustomerId ||
        intent.metadata.userId !== user.id ||
        intent.metadata.purpose !== "trial_signup"
      ) {
        throw new TrialSetupError(403, "This payment method setup does not belong to your trial.");
      }
      if (intent.status !== "succeeded" || !intent.payment_method) {
        throw new TrialSetupError(400, "Your payment method has not been confirmed yet.");
      }
      if (user.subscriptionStatus === "active") {
        throw new TrialSetupError(409, "You already have an active subscription.");
      }

      const startedAt = now();
      let trialUser = user;
      if (user.trialStartDate) {
        if (
          user.subscriptionStatus !== "trial" ||
          !user.trialEndDate ||
          new Date(user.trialEndDate).getTime() <= startedAt.getTime()
        ) {
          throw new TrialSetupError(409, "Your previous trial has ended. A subscription is required.");
        }
      } else {
        const endsAt = new Date(startedAt);
        endsAt.setDate(endsAt.getDate() + 14);
        const updated = await storage.updateUser(user.id, {
          trialStartDate: startedAt,
          trialEndDate: endsAt,
          subscriptionStatus: "trial",
        });
        if (!updated) throw new TrialSetupError(500, "Unable to activate your trial. Please try again.");
        trialUser = updated;
      }

      res.json({
        success: true,
        message: "Your trial is active.",
        subscriptionStatus: trialUser.subscriptionStatus,
        trialStartDate: trialUser.trialStartDate,
        trialEndDate: trialUser.trialEndDate,
      });
    } catch (error) {
      if (error instanceof TrialSetupError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      // Do not log Stripe objects, client secrets, or complete user records.
      console.error("Trial activation could not be verified.");
      res.status(500).json({ message: "Unable to verify and activate your trial. Please try again." });
    }
  };
}
