import React from "react";
import { Link, useLocation } from "wouter";
import { Bot, Home, Plus, BookOpen, FlaskRound, User, Volume2, Code, Users, List, LogOut, Zap, Store, MessageCircle, Settings, Menu, X, Heart, MoreHorizontal, ChevronDown, ChevronUp, Briefcase, Sparkles, Globe, Megaphone, BarChart3, ShoppingBag, Brain } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useState } from "react";

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ isOpen = true, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false); // Hidden by default
  const [showDevMode, setShowDevMode] = useState(false); // Hidden by default
  const [accessCode, setAccessCode] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  
  const MORE_SECTION_PASSWORD = "SHAREBRAIN_MORE_2025";
  
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: unreadCount } = useQuery({
    queryKey: ["/api/chat-invitations/unread-count"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: newMessageCount } = useQuery({
    queryKey: ["/api/contacts/new-message-count"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Primary navigation items (hidden behind password-protected "More" section)
  const primaryNavItems = [
    { 
      path: "/contacts", 
      icon: Users, 
      label: "Contacts", 
      name: "contacts",
      badge: newMessageCount && newMessageCount.count > 0 ? newMessageCount.count : null
    },
    { path: "/agents", icon: Bot, label: "My Brains", name: "agents" },
    { path: "/easy-agents", icon: Sparkles, label: "Easy Brains", name: "easy-agents" },
    { path: "/create-agent", icon: Plus, label: "Create Brain", name: "create" },
    { path: "/directory", icon: BookOpen, label: "Brain Directory", name: "directory" },
    { path: "/settings", icon: Settings, label: "Settings", name: "settings" },
  ];

  // Secondary navigation items (also hidden behind "More")
  const secondaryNavItems = [
    { path: "/advanced-agents", icon: Zap, label: "Advanced Brains", name: "advanced-agents" },
    { path: "/advertisements", icon: Megaphone, label: "Advertisements", name: "advertisements" },
    { path: "/ab-testing-dashboard", icon: BarChart3, label: "A/B Testing", name: "ab-testing-dashboard" },
    { path: "/conversations", icon: MessageCircle, label: "Conversations", name: "conversations" },
    { path: "/create-personal-agent", icon: Heart, label: "Create Personal Brain", name: "create-personal-agent", special: true },
    { path: "/create-business-agent", icon: Briefcase, label: "Create Business Brain", name: "create-business-agent", special: true },
    { path: "/websites", icon: Globe, label: "Brain Websites", name: "websites" },
    { path: "/chat", icon: MessageCircle, label: "Chat", name: "chat", special: true },
    { path: "/", icon: Home, label: "Dashboard", name: "dashboard" },
    { path: "/master-agent", icon: Zap, label: "Master Brain", name: "master-agent" },
    { path: "/business-listing", icon: Store, label: "Business Listing", name: "business-listing" },
    { path: "/library", icon: BookOpen, label: "Brain Library", name: "library" },
    { path: "/testing", icon: FlaskRound, label: "Testing Lab", name: "testing" },
    { path: "/api-portal", icon: Code, label: "API Portal", name: "api-portal" },
    { path: "/tts-test", icon: Volume2, label: "TTS Test", name: "tts-test" },
    { path: "/shopify-agent", icon: ShoppingBag, label: "Shopify Brain", name: "shopify-agent", special: true },
    { path: "/invite-brains", icon: Heart, label: "Invite Brains", name: "invite-brains", special: true },
    { path: "/creation-agents", icon: Bot, label: "Creation Agents", name: "creation-agents", special: true },
    { path: "/brain-invitations", icon: User, label: "Brain Invitations", name: "brain-invitations", special: true },
    { path: "/agent-router", icon: Brain, label: "Agent Router", name: "agent-router", special: true },
    { path: "/vocabulary-cache-admin", icon: Brain, label: "Vocabulary Cache", name: "vocabulary-cache-admin", special: true },
    { path: "/aisays", icon: Sparkles, label: "AiSays", name: "aisays", special: true },
  ];

  // Test environment detection for routing only
  const [isTestEnvironment, setIsTestEnvironment] = React.useState(false);
  
  React.useEffect(() => {
    const checkTestEnvironment = () => {
      const path = window.location.pathname;
      setIsTestEnvironment(path.startsWith('/test'));
    };
    
    checkTestEnvironment();
    // Also check on location changes
    const interval = setInterval(checkTestEnvironment, 100);
    return () => clearInterval(interval);
  }, [location]);
  
  // Helper function to create test-environment aware paths
  const getPath = (path: string) => {
    // If we're in test environment and path doesn't already have /test prefix, add it
    if (isTestEnvironment && !path.startsWith('/test')) {
      return `/test${path}`;
    }
    return path;
  };

  const isActive = (path: string) => {
    const fullPath = getPath(path);
    if (fullPath === "/" && location === "/") return true;
    if (fullPath !== "/" && location.startsWith(fullPath)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:relative lg:translate-x-0 z-50
        w-64 bg-background border-r border-border flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        h-screen
      `}>
      {/* Logo & Brand */}
      <div className="px-6 py-6 pb-10 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div>
              <h1 className="text-xl font-bold text-white">ShareBrain</h1>
              <p className="text-xs text-white">AI Agent Platform</p>
            </div>
          </div>
          
          {/* Mobile Sign Out Button */}
          <div className="lg:hidden">
            <button
              onClick={() => window.location.href = '/api/logout'}
              className="px-3 py-2 rounded-lg text-foreground hover:bg-muted transition-colors text-sm"
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <Link href={getPath("/10words")} onClick={onToggle}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-colors ${isActive("/10words") ? "bg-muted text-white" : "text-white hover:bg-muted"}`}>
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          <span>10words</span>
        </Link>
        {/* More Button */}
        <div className="pt-2 border-t border-border mt-4">
          <button
            onClick={() => {
              if (showMore) {
                setShowMore(false);
              } else {
                setShowPasswordPrompt(true);
              }
            }}
            className="w-full flex items-center px-3 py-2 rounded-lg font-medium text-white hover:bg-muted transition-colors"
          >
            <span>More</span>
            <span className="ml-auto text-xs">{showMore ? '▲' : '▼'}</span>
          </button>
        </div>

        {/* Password Prompt */}
        {showPasswordPrompt && (
          <div className="pt-2 px-3">
            <div className="bg-muted border border-border rounded-lg p-3">
              <div className="text-sm text-white mb-2">Enter access code:</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-white"
                placeholder="Access code"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (password === MORE_SECTION_PASSWORD) {
                      setShowMore(true);
                      setShowPasswordPrompt(false);
                      setPassword("");
                    } else {
                      setPassword("");
                    }
                  }
                }}
              />
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={() => {
                    if (password === MORE_SECTION_PASSWORD) {
                      setShowMore(true);
                      setShowPasswordPrompt(false);
                      setPassword("");
                    } else {
                      setPassword("");
                    }
                  }}
                  className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/80"
                >
                  Access
                </button>
                <button
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPassword("");
                  }}
                  className="px-2 py-1 text-xs bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Primary and Secondary Navigation Items (revealed after password) */}
        {showMore && (
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              {primaryNavItems.map((item) => {
                const active = isActive(item.path);
                const href = getPath(item.path);

                return (
                  <Link key={item.path} href={href}>
                    <div
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                        active
                          ? (item.special
                              ? "bg-gradient-to-r from-purple-500 to-blue-600 text-white"
                              : "bg-primary text-primary-foreground")
                          : (item.special
                              ? "text-purple-400 hover:bg-muted"
                              : "text-foreground hover:bg-muted")
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      {isTestEnvironment && (
                        <span className="text-xs text-yellow-300 ml-auto">{href}</span>
                      )}
                      {item.name === "contacts" && newMessageCount?.count > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center">
                          {newMessageCount.count}
                        </span>
                      )}
                      {item.special && (
                        <span className="ml-auto text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-border pt-2">
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const href = getPath(item.path);

                return (
                  <Link key={item.path} href={href}>
                    <div
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                        active
                          ? (item.special
                              ? "bg-gradient-to-r from-purple-500 to-blue-600 text-white"
                              : "bg-white text-black")
                          : (item.special
                              ? "text-purple-400 hover:bg-muted"
                              : "text-white hover:bg-muted")
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      {item.special && (
                        <span className="ml-auto text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="px-4 py-4 border-t border-white">
        <div className="flex items-center space-x-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <User className="text-black h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              {(user as any)?.firstName || "John"} {(user as any)?.lastName || "Doe"}
            </p>
            <p className="text-xs text-white">
              {(user as any)?.email || "john@example.com"}
            </p>
          </div>
        </div>
        
        {/* Desktop Sign Out Button */}
        <button
          onClick={() => window.location.href = '/api/logout'}
          className="hidden lg:flex w-full items-center space-x-3 px-3 py-2 rounded-lg font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
      </div>
    </>
  );
}
