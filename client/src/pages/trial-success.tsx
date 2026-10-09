import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { completeTrialSetup, hasActiveTrial, refreshTrialAccess, trialErrorMessage } from "@/lib/trialSetup";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TrialSuccess() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<"checking" | "active" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      setState("checking");
      try {
        const parameters = new URLSearchParams(window.location.search);
        const setupIntentId = parameters.get("setup_intent");
        if (setupIntentId) {
          // Handles cards that require Stripe to redirect for authentication.
          await completeTrialSetup(setupIntentId);
        } else {
          const response = await apiRequest("GET", "/api/user/subscription-status");
          if (!hasActiveTrial(await response.json())) {
            throw new Error("No active trial was found. Complete payment method setup to start your trial.");
          }
          await refreshTrialAccess();
        }
        // Never retain Stripe's client secret in the return-page URL.
        for (const key of ["setup_intent", "setup_intent_client_secret", "redirect_status"]) {
          parameters.delete(key);
        }
        const query = parameters.toString();
        window.history.replaceState(window.history.state, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
        if (!cancelled) setState("active");
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(trialErrorMessage(error));
          setState("error");
        }
      }
    };
    void verify();
    return () => { cancelled = true; };
  }, [attempt]);

  if (state === "checking") {
    return <div className="min-h-screen flex items-center justify-center">Verifying your trial…</div>;
  }
  if (state === "error") {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>
        <Button onClick={() => setAttempt(value => value + 1)}>Retry verification</Button>
        <Button variant="outline" onClick={() => setLocation("/trial-signup")}>Return to trial signup</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Thank You!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
            You've successfully signed up for your free trial
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-gray-900 dark:text-white">
              Welcome to ShareBrain
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center space-x-2 text-green-600 dark:text-green-400">
                <Sparkles className="h-5 w-5" />
                <span className="font-medium">Your 14-day free trial is now active</span>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>What's included:</strong>
                  <br />
                  • Unlimited AI agent creation
                  <br />
                  • Business website analysis
                  <br />
                  • Full API access
                  <br />
                  • Voice-enabled conversations
                </p>
              </div>
            </div>

            <Button 
              onClick={() => setLocation("/")}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Questions? Contact us at support@sharebrain.me
          </p>
        </div>
      </div>
    </div>
  );
}