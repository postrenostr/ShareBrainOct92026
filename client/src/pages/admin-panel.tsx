import TenWordsHdUpgrade from "@/components/ten-words-hd-upgrade";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Shield, GitBranch, Database, Settings, Users, Activity, FileText, Rocket } from "lucide-react";
import TestDeployButton from "@/components/TestDeployButton";

export default function AdminPanel() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/");
      return;
    }
    
    if (user?.email !== "tom@colorfulranch.com") {
      setLocation("/");
      return;
    }
  }, [isAuthenticated, user, setLocation]);

  if (!isAuthenticated || user?.email !== "tom@colorfulranch.com") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-300">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-gray-300">Welcome, {user.firstName || "Admin"}. Development tools and system management.</p>
        </div>

        <section className="mb-8" aria-label="10words audio administration">
          <TenWordsHdUpgrade />
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Test Deployment */}
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Rocket className="h-5 w-5 text-orange-400" />
                Test Deployment
              </CardTitle>
              <CardDescription className="text-gray-400">
                Deploy current changes to test environment safely
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TestDeployButton 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                variant="default"
              />
            </CardContent>
          </Card>

          {/* Git Manager */}
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-blue-400" />
                Git Manager
              </CardTitle>
              <CardDescription className="text-gray-400">
                Manage Git repositories, branches, and deployments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin/git-manager">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Open Git Manager
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Database Management */}
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-green-400" />
                Database Tools
              </CardTitle>
              <CardDescription className="text-gray-400">
                Database management and analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Technical Documents */}
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Technical Documents
              </CardTitle>
              <CardDescription className="text-gray-400">
                System specifications, startup brains, and technical wiki
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin/technical-docs">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  Open Tech Docs
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-400" />
                System Settings
              </CardTitle>
              <CardDescription className="text-gray-400">
                Platform configuration and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-yellow-400" />
                User Management
              </CardTitle>
              <CardDescription className="text-gray-400">
                Manage users, permissions, and access controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* System Monitoring */}
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-400" />
                System Monitoring
              </CardTitle>
              <CardDescription className="text-gray-400">
                Server health, performance metrics, and logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* Agent Builder */}
          <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-400" />
                Agent Builder
              </CardTitle>
              <CardDescription className="text-gray-400">
                Advanced agent development tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/agent-builder">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  Open Agent Builder
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}