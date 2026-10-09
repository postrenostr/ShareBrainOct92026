import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, CreditCard, Shield, Zap, Calendar, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { confirmTrialPayment, getStripeKeyMode, trialErrorMessage } from "@/lib/trialSetup";
import { LogoutButton } from "@/components/LogoutButton";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const TrialSignupForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentLoadError, setPaymentLoadError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !paymentReady) {
      return;
    }

    setIsProcessing(true);

    try {
      await confirmTrialPayment(stripe, elements, window.location.origin + "/trial-success");
      toast({
        title: "Trial Started!",
        description: "Your payment method is saved and your 14-day trial is active.",
      });
      setLocation("/trial-success");
    } catch (error) {
      toast({
        title: "Trial signup could not finish",
        description: trialErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Badge className="mb-4 bg-white text-black">Welcome to ShareBrain!</Badge>
          <h1 className="text-4xl font-bold text-white mb-2">
            Start Your Free Trial
          </h1>
          <p className="text-lg text-white">
            Get full access to all features for 14 days, completely free
          </p>
        </div>

        <Card className="mb-6 bg-gray-900 border-white">
          <CardHeader className="text-center bg-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Calendar className="h-5 w-5 text-white" />
              <Badge variant="secondary" className="bg-white text-black">
                14-Day Free Trial
              </Badge>
            </div>
            <CardTitle className="text-2xl text-white">No charge for 14 days</CardTitle>
            <p className="text-white mt-2">
              You will be charged <strong>$10/month</strong> after your free trial ends.
              <br />
              <span className="text-green-400 font-medium">Cancel anytime before then - no questions asked.</span>
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-white">Unlimited AI Agents</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-white">Voice Integration & TTS</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-white">Full API Access</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-white">Personal Memory System</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-white">Document Upload & RAG</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-white">Template Library</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-white">Priority Support</span>
                </div>
                <div className="flex items-center space-x-3">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <span className="line-through text-gray-400">$10/month fee</span>
                </div>
              </div>
            </div>

            <Alert className="mb-6 border-white bg-gray-800">
              <Zap className="h-4 w-4 text-white" />
              <AlertDescription>
                <strong className="text-white">What happens next?</strong>
                <p className="text-white mt-1">
                  1. Secure your payment method (no charge today)<br />
                  2. Enjoy 14 days of full access to ShareBrain<br />
                  3. Get charged $10/month only after your trial ends<br />
                  4. Cancel anytime before then to avoid any charges
                </p>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Payment Method
                </label>
                <PaymentElement
                  onReady={() => setPaymentReady(true)}
                  onLoadError={({ error }) => {
                    setPaymentReady(false);
                    setPaymentLoadError(error.message || "The payment form could not load.");
                  }}
                />
              </div>
              {paymentLoadError && (
                <Alert variant="destructive">
                  <AlertDescription>{paymentLoadError}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                disabled={!stripe || !elements || !paymentReady || !!paymentLoadError || isProcessing}
                className="w-full"
                size="lg"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {isProcessing ? 'Starting Trial...' : !paymentReady && !paymentLoadError
                  ? 'Loading payment form...' : 'Start Free Trial (No Charge Today)'}
              </Button>
            </form>

            <div className="flex items-center justify-center space-x-2 mt-4 text-sm text-white">
              <Shield className="h-4 w-4" />
              <span>Secure payment processing by Stripe • Cancel anytime</span>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-white">
          <p>
            By continuing, you agree to our Terms of Service and Privacy Policy.
            <br />
            Questions? Contact us at support@sharebrain.me
          </p>
          <div className="mt-4">
            <LogoutButton className="text-sm" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function TrialSignup() {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    // Create setup intent for trial signup
    apiRequest("POST", "/api/create-setup-intent")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.clientSecret !== "string" || !data.clientSecret) {
          throw new Error("Stripe did not return a payment form. Please try again.");
        }
        if (typeof data.livemode === "boolean" &&
          getStripeKeyMode(import.meta.env.VITE_STRIPE_PUBLIC_KEY) !== (data.livemode ? "live" : "test")) {
          throw new Error("The Stripe public and private keys use different modes. The site owner must configure matching keys and republish.");
        }
        setClientSecret(data.clientSecret);
        setIsLoading(false);
      })
      .catch((error) => {
        setSetupError(trialErrorMessage(error));
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>
            {setupError || "Unable to start trial signup. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Make SURE to wrap the form in <Elements> which provides the stripe context.
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <TrialSignupForm />
    </Elements>
  );
}