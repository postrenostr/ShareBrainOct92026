import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { User, ArrowRight, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getHandleSetupDestination } from "@shared/authRedirect";

export default function ChooseHandle() {
  const [, setLocation] = useLocation();
  const [destination] = useState(() => getHandleSetupDestination(window.location));
  const [handle, setHandle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [handleAvailability, setHandleAvailability] = useState<{
    isChecking: boolean;
    isAvailable: boolean | null;
    lastChecked: string;
  }>({
    isChecking: false,
    isAvailable: null,
    lastChecked: ""
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check handle availability with debouncing
  useEffect(() => {
    const checkHandleAvailability = async (handleToCheck: string) => {
      if (!handleToCheck.trim()) {
        setHandleAvailability({
          isChecking: false,
          isAvailable: null,
          lastChecked: ""
        });
        return;
      }

      // Ensure handle starts with @
      let cleanHandle = handleToCheck.trim();
      if (!cleanHandle.startsWith('@')) {
        cleanHandle = '@' + cleanHandle;
      }

      setHandleAvailability(prev => ({
        ...prev,
        isChecking: true
      }));

      try {
        const response = await apiRequest("POST", "/api/user/check-handle", {
          handle: cleanHandle
        });
        const data = await response.json();
        
        setHandleAvailability({
          isChecking: false,
          isAvailable: data.available,
          lastChecked: cleanHandle
        });
      } catch (error) {
        setHandleAvailability({
          isChecking: false,
          isAvailable: null,
          lastChecked: cleanHandle
        });
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      checkHandleAvailability(handle);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [handle]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { handle: string; firstName: string; lastName: string }) => {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: "Username created!",
        description: "Your unique handle has been set successfully.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }),
      ]);
      // Resume the intended page; default onboarding leads to the free directory.
      setLocation(destination);
    },
    onError: (error: any) => {
      toast({
        title: "Username not available",
        description: error.message || "Please try a different username.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!handle.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to continue.",
        variant: "destructive",
      });
      return;
    }

    if (handleAvailability.isChecking) {
      toast({
        title: "Please wait",
        description: "Checking username availability...",
        variant: "destructive",
      });
      return;
    }

    if (handleAvailability.isAvailable === false) {
      toast({
        title: "Username not available",
        description: "Please choose a different username.",
        variant: "destructive",
      });
      return;
    }

    // Ensure handle starts with @
    let cleanHandle = handle.trim();
    if (!cleanHandle.startsWith('@')) {
      cleanHandle = '@' + cleanHandle;
    }

    updateProfileMutation.mutate({
      handle: cleanHandle,
      firstName: firstName.trim(),
      lastName: lastName.trim()
    });
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <User className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Choose Your Unique Username
          </h1>
          <p className="text-gray-300 text-lg">
            This will be how friends add you to chat. You can always find your username on the settings page.
          </p>
        </div>

        {/* Form Card */}
        <Card className="border-gray-700 bg-gray-900 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold text-white">
              Set up your profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-white">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  className="text-base p-3 border-2 border-gray-700 focus:border-white rounded-lg bg-black text-white placeholder-gray-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-white">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  className="text-base p-3 border-2 border-gray-700 focus:border-white rounded-lg bg-black text-white placeholder-gray-400"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="handle" className="text-white">Username</Label>
              <div className="relative">
                <Input
                  id="handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="johndoe (@ will be added automatically)"
                  className={`text-base p-3 border-2 rounded-lg pr-10 bg-black text-white placeholder-gray-400 ${
                    handleAvailability.isAvailable === true 
                      ? 'border-green-500 focus:border-green-500' 
                      : handleAvailability.isAvailable === false 
                      ? 'border-red-500 focus:border-red-500' 
                      : 'border-gray-700 focus:border-white'
                  }`}
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {handleAvailability.isChecking && handle.trim() && (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  )}
                  {!handleAvailability.isChecking && handleAvailability.isAvailable === true && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {!handleAvailability.isChecking && handleAvailability.isAvailable === false && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
              <div className="text-sm">
                <p className="text-gray-400">
                  Friends will be able to find you using @{handle || 'username'}
                </p>
                {handleAvailability.isAvailable === true && handle.trim() && (
                  <p className="text-green-400 font-medium">✓ Username is available</p>
                )}
                {handleAvailability.isAvailable === false && handle.trim() && (
                  <p className="text-red-400 font-medium">✗ Username is already taken</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={
              updateProfileMutation.isPending || 
              !handle.trim() || 
              handleAvailability.isChecking || 
              handleAvailability.isAvailable === false
            }
            className="w-full bg-white text-black hover:bg-gray-200 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {updateProfileMutation.isPending ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full" />
                Creating Username...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Continue to Setup
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="text-center">
          <p className="text-sm text-gray-400">
            You can change your username anytime in Settings
          </p>
        </div>
      </div>
    </div>
  );
}