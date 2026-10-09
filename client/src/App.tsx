import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Agents from "@/pages/agents";
import CreateAgent from "@/pages/create-agent";
import CreateAgentWithTrial from "@/components/create-agent-with-trial";
import CreatePersonalAgent from "@/pages/create-personal-agent";
import CreateBusinessAgent from "@/pages/create-business-agent";
import ChooseHandle from "@/pages/choose-handle";
import TestingLab from "@/pages/testing-lab";
import AgentLibrary from "@/pages/agent-library";
import BrainDirectory from "@/pages/agent-directory";
import TTSTest from "@/pages/tts-test";
import APIPortal from "@/pages/api-portal";
import Contacts from "@/pages/contacts";
import Conversations from "@/pages/conversations";
import Landing from "@/pages/landing";
import Checkout from "@/pages/checkout";
import TrialSignup from "@/pages/trial-signup";
import TrialSuccess from "@/pages/trial-success";
import Subscribe from "@/pages/subscribe";
import AgentChat from "@/pages/agent-chat";
import AgentDocuments from "@/pages/agent-documents";
import ChatDemo from "@/pages/chat-demo";
import AgentProfile from "@/pages/agent-profile";
import UrlComparison from "@/pages/url-comparison";
import MasterAgentSimple from "@/pages/master-agent-simple";
import MasterAgentGPT from "@/pages/master-agent-gpt";
import MasterAgentLlama70B from "@/pages/master-agent-llama-70b";
import MasterAgentLlama8B from "@/pages/master-agent-llama-8b";
import BusinessListing from "@/pages/business-listing";
import TacosChat from "@/pages/tacos-chat";
import PersonalAssistant from "@/pages/personal-assistant";
import UnifiedChat from "@/pages/unified-chat";
import ProfileSettings from "@/pages/profile-settings";
import FriendRequests from "@/pages/friend-requests";
import Settings from "@/pages/settings";
import JsonTest from "@/pages/json-test";
import EasyAgents from "@/pages/easy-agents";
import AdminFeatures from "@/pages/admin-features";
import AgentBuilder from "@/pages/agent-builder";
import BrainModifier from "@/pages/brain-modifier";
import Websites from "@/pages/websites";
import WebsiteViewer from "@/pages/website-viewer";
import CommunityAgent from "@/pages/CommunityAgent";
import AdvancedAgents from "@/pages/advanced-agents";
import AgentCreationManual from "@/pages/agent-creation-manual";
import Advertisements from "@/pages/advertisements";
import CreateAdvertisement from "@/pages/create-advertisement";
import ABTestingDashboard from "@/pages/ab-testing-dashboard";
import GitManager from "@/pages/git-manager";
import AdminPanel from "@/pages/admin-panel";
import TechnicalDocs from "@/pages/technical-docs";
import AdminProtected from "@/components/AdminProtected";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import Test from "@/pages/test";
import { MemoryTest } from "@/components/MemoryTest";
import ShopifyAgent from "@/pages/ShopifyAgent";
import InviteBrains from "@/pages/invite-brains";
import BrainInvitations from "@/pages/brain-invitations";
import AgentRouter from "@/pages/agent-router";
import PublicBrainChat from "@/pages/public-brain-chat";
import VocabularyCacheAdmin from "@/pages/vocabulary-cache-admin";
import CreationAgents from "@/pages/CreationAgents";
import AiSays from "@/pages/aisays";
import TenWords from "@/pages/ten-words";
import Sidebar from "@/components/sidebar";
import MobileHeader from "@/components/mobile-header";
import { useState } from "react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useHandleSetup } from "@/hooks/useHandleSetup";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { data: trialStatus, isLoading: isTrialStatusLoading } = useTrialStatus();
  const { needsHandleSetup, isLoading: isHandleLoading } = useHandleSetup();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/agent/:slug" component={AgentProfile} />
          <Route path="/url-comparison" component={UrlComparison} />
          <Route path="/advertisements" component={Advertisements} />
          <Route path="/directory" component={BrainDirectory} />
          <Route path="/chat/:id" component={AgentChat} />
          <Route component={Landing} />
        </Switch>
      ) : isTrialStatusLoading || isHandleLoading ? (
        // Show loading while checking trial status and handle setup
        <div className="h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
        </div>
      ) : needsHandleSetup ? (
        // Force handle setup if needed
        <Switch>
          <Route path="/choose-handle" component={ChooseHandle} />
          <Route component={ChooseHandle} />
        </Switch>
      ) : (
        <Switch>
          <Route path="/trial-signup" component={TrialSignup} />
          <Route path="/trial-success" component={TrialSuccess} />
          <Route path="/chat" component={UnifiedChat} />
          <Route>
            {() => (
              <div className="h-screen flex bg-background">
                {/* Mobile Header - only shown on mobile */}
                <div className="lg:hidden fixed top-0 left-0 right-0 z-30">
                  <MobileHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
                </div>
                
                {/* Sidebar */}
                <Sidebar 
                  isOpen={sidebarOpen} 
                  onToggle={() => setSidebarOpen(false)} 
                />
                
                {/* Main Content */}
                <div className="flex-1 flex flex-col pt-16 lg:pt-0">
                  <Switch>
                    <Route path="/10words" component={TenWords} />
                    <Route path="/10words/:language" component={TenWords} />
                    <Route path="/test/10words" component={TenWords} />
                    <Route path="/test/10words/:language" component={TenWords} />
                    {/* Test Environment Routes */}
                    <Route path="/test" component={BrainDirectory} />
                    <Route path="/test/agents" component={Agents} />
                    <Route path="/test/easy-agents" component={EasyAgents} />
                    <Route path="/test/create-agent">
                      {() => (
                        <SubscriptionGuard feature="agent creation">
                          <CreateAgentWithTrial />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/test/choose-handle" component={ChooseHandle} />
                    <Route path="/test/create-personal-agent">
                      {() => (
                        <SubscriptionGuard feature="personal agent creation">
                          <CreatePersonalAgent />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/test/create-business-agent">
                      {() => (
                        <SubscriptionGuard feature="business agent creation">
                          <CreateBusinessAgent />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/test/edit-agent/:id">
                      {() => (
                        <SubscriptionGuard feature="agent editing">
                          <CreateAgentWithTrial />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/test/chat/:id" component={AgentChat} />
                    <Route path="/test/community/:id" component={CommunityAgent} />
                    <Route path="/test/advanced-agents">
                      {() => (
                        <SubscriptionGuard feature="advanced agents">
                          <AdvancedAgents />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/test/tacos/:id" component={TacosChat} />
                    <Route path="/test/agents/:id/documents" component={AgentDocuments} />
                    <Route path="/test/chat-demo" component={ChatDemo} />
                    <Route path="/test/url-comparison" component={UrlComparison} />
                    <Route path="/test/testing" component={TestingLab} />
                    <Route path="/test/library" component={AgentLibrary} />
                    <Route path="/test/directory" component={BrainDirectory} />
                    <Route path="/test/contacts" component={Contacts} />
                    <Route path="/test/conversations" component={Conversations} />
                    <Route path="/test/unified-chat/:id" component={UnifiedChat} />
                    <Route path="/test/master-agent" component={MasterAgentSimple} />
                    <Route path="/test/master-agent-gpt" component={MasterAgentGPT} />
                    <Route path="/test/master-agent-llama-70b" component={MasterAgentLlama70B} />
                    <Route path="/test/master-agent-llama-8b" component={MasterAgentLlama8B} />
                    <Route path="/test/api-portal" component={APIPortal} />
                    <Route path="/test/tts-test" component={TTSTest} />
                    <Route path="/test/json-test" component={JsonTest} />
                    <Route path="/test/checkout" component={Checkout} />
                    <Route path="/test/subscribe" component={Subscribe} />
                    <Route path="/test/business-listing" component={BusinessListing} />
                    <Route path="/test/personal-assistant" component={PersonalAssistant} />
                    <Route path="/test/profile-settings" component={ProfileSettings} />
                    <Route path="/test/friend-requests" component={FriendRequests} />
                    <Route path="/test/settings" component={Settings} />
                    <Route path="/test/admin-features" component={AdminFeatures} />
                    <Route path="/test/agent-builder">
                      {() => (
                        <SubscriptionGuard feature="agent builder">
                          <AgentBuilder />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/test/websites" component={Websites} />
                    <Route path="/test/websites/:id" component={WebsiteViewer} />
                    <Route path="/test/agent-creation-manual" component={AgentCreationManual} />
                    <Route path="/test/advertisements" component={Advertisements} />
                    <Route path="/test/create-advertisement" component={CreateAdvertisement} />
                    <Route path="/test/ab-testing-dashboard" component={ABTestingDashboard} />
                    <Route path="/test/admin" component={AdminPanel} />
                    <Route path="/test/admin/git-manager">
                      {() => (
                        <AdminProtected>
                          <GitManager />
                        </AdminProtected>
                      )}
                    </Route>
                    <Route path="/test/admin/technical-docs">
                      {() => (
                        <AdminProtected>
                          <TechnicalDocs />
                        </AdminProtected>
                      )}
                    </Route>
                    <Route path="/test/git-manager">
                      {() => (
                        <AdminProtected>
                          <GitManager />
                        </AdminProtected>
                      )}
                    </Route>
                    <Route path="/test/memory-test" component={MemoryTest} />
                    <Route path="/test/shopify-agent" component={ShopifyAgent} />
                    <Route path="/test/invite-brains" component={InviteBrains} />
                    <Route path="/test/brain-invitations" component={BrainInvitations} />
                    <Route path="/test/agent-router" component={AgentRouter} />
                    <Route path="/test/vocabulary-cache-admin" component={VocabularyCacheAdmin} />
                    <Route path="/test/aisays" component={AiSays} />
                    
                    {/* Test Environment - Main Application Routes */}
                    <Route path="/test/agents" component={Agents} />
                    <Route path="/test/easy-agents" component={EasyAgents} />
                    <Route path="/test/create-agent" component={CreateAgentWithTrial} />
                    <Route path="/test/choose-handle" component={ChooseHandle} />
                    <Route path="/test/create-personal-agent" component={CreatePersonalAgent} />
                    <Route path="/test/create-business-agent" component={CreateBusinessAgent} />
                    <Route path="/test/edit-agent/:id" component={CreateAgentWithTrial} />
                    <Route path="/test/chat/:id" component={AgentChat} />
                    <Route path="/test/community/:id" component={CommunityAgent} />
                    <Route path="/test/advanced-agents" component={AdvancedAgents} />
                    <Route path="/test/testing" component={TestingLab} />
                    <Route path="/test/library" component={AgentLibrary} />
                    <Route path="/test/directory" component={BrainDirectory} />
                    <Route path="/test/contacts" component={Contacts} />
                    <Route path="/test/conversations" component={Conversations} />
                    <Route path="/test/unified-chat/:id" component={UnifiedChat} />
                    <Route path="/test/master-agent" component={MasterAgentSimple} />
                    <Route path="/test/api-portal" component={APIPortal} />
                    <Route path="/test/tts-test" component={TTSTest} />
                    <Route path="/test/checkout" component={Checkout} />
                    <Route path="/test/subscribe" component={Subscribe} />
                    <Route path="/test/business-listing" component={BusinessListing} />
                    <Route path="/test/personal-assistant" component={PersonalAssistant} />
                    <Route path="/test/profile-settings" component={ProfileSettings} />
                    <Route path="/test/friend-requests" component={FriendRequests} />
                    <Route path="/test/settings" component={Settings} />
                    <Route path="/test/admin-features" component={AdminFeatures} />
                    <Route path="/test/agent-builder" component={AgentBuilder} />
                    <Route path="/test/websites" component={Websites} />
                    <Route path="/test/websites/:id" component={WebsiteViewer} />
                    <Route path="/test/advertisements" component={Advertisements} />
                    <Route path="/test/create-advertisement" component={CreateAdvertisement} />
                    <Route path="/test/ab-testing-dashboard" component={ABTestingDashboard} />
                    <Route path="/test/admin" component={AdminPanel} />
                    <Route path="/test/admin/git-manager">
                      {() => (
                        <AdminProtected>
                          <GitManager />
                        </AdminProtected>
                      )}
                    </Route>
                    
                    {/* Production Environment Routes */}
                    <Route path="/" component={BrainDirectory} />
                    <Route path="/agents" component={Agents} />
                    <Route path="/easy-agents" component={EasyAgents} />
                    <Route path="/create-agent">
                      {() => (
                        <SubscriptionGuard feature="agent creation">
                          <CreateAgentWithTrial />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/creation-agents" component={CreationAgents} />
                    <Route path="/choose-handle" component={ChooseHandle} />
                    <Route path="/create-personal-agent">
                      {() => (
                        <SubscriptionGuard feature="personal agent creation">
                          <CreatePersonalAgent />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/create-business-agent">
                      {() => (
                        <SubscriptionGuard feature="business agent creation">
                          <CreateBusinessAgent />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/edit-agent/:id">
                      {() => (
                        <SubscriptionGuard feature="agent editing">
                          <CreateAgentWithTrial />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/chat/:id" component={AgentChat} />
                    <Route path="/community/:id" component={CommunityAgent} />
                    <Route path="/advanced-agents">
                      {() => (
                        <SubscriptionGuard feature="advanced agents">
                          <AdvancedAgents />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/tacos/:id" component={TacosChat} />
                    <Route path="/agents/:id/documents" component={AgentDocuments} />
                    <Route path="/chat-demo" component={ChatDemo} />
                    <Route path="/url-comparison" component={UrlComparison} />
                    <Route path="/testing" component={TestingLab} />
                    <Route path="/library" component={AgentLibrary} />
                    <Route path="/directory" component={BrainDirectory} />
                    <Route path="/contacts" component={Contacts} />
                    <Route path="/conversations" component={Conversations} />
                    <Route path="/unified-chat/:id" component={UnifiedChat} />
                    <Route path="/master-agent" component={MasterAgentSimple} />
                    <Route path="/master-agent-gpt" component={MasterAgentGPT} />
                    <Route path="/master-agent-llama-70b" component={MasterAgentLlama70B} />
                    <Route path="/master-agent-llama-8b" component={MasterAgentLlama8B} />
                    <Route path="/api-portal" component={APIPortal} />
                    <Route path="/tts-test" component={TTSTest} />
                    <Route path="/json-test" component={JsonTest} />
                    <Route path="/checkout" component={Checkout} />
                    <Route path="/subscribe" component={Subscribe} />
                    <Route path="/business-listing" component={BusinessListing} />
                    <Route path="/personal-assistant" component={PersonalAssistant} />
                    <Route path="/profile-settings" component={ProfileSettings} />
                    <Route path="/friend-requests" component={FriendRequests} />
                    <Route path="/settings" component={Settings} />
                    <Route path="/admin-features" component={AdminFeatures} />
                    <Route path="/agent-builder">
                      {() => (
                        <SubscriptionGuard feature="agent builder">
                          <AgentBuilder />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/brain-modifier/:id">
                      {() => (
                        <SubscriptionGuard feature="brain modification">
                          <BrainModifier />
                        </SubscriptionGuard>
                      )}
                    </Route>
                    <Route path="/websites" component={Websites} />
                    <Route path="/websites/:id" component={WebsiteViewer} />
                    <Route path="/agent-creation-manual" component={AgentCreationManual} />
                    <Route path="/advertisements" component={Advertisements} />
                    <Route path="/create-advertisement" component={CreateAdvertisement} />
                    <Route path="/ab-testing-dashboard" component={ABTestingDashboard} />
                    <Route path="/admin" component={AdminPanel} />
                    <Route path="/admin/git-manager">
                      {() => (
                        <AdminProtected>
                          <GitManager />
                        </AdminProtected>
                      )}
                    </Route>
                    <Route path="/admin/technical-docs">
                      {() => (
                        <AdminProtected>
                          <TechnicalDocs />
                        </AdminProtected>
                      )}
                    </Route>
                    <Route path="/git-manager">
                      {() => (
                        <AdminProtected>
                          <GitManager />
                        </AdminProtected>
                      )}
                    </Route>
                    <Route path="/test" component={Test} />
                    <Route path="/memory-test" component={MemoryTest} />
                    <Route path="/shopify-agent" component={ShopifyAgent} />
                    <Route path="/invite-brains" component={InviteBrains} />
                    <Route path="/brain-invitations" component={BrainInvitations} />
                    <Route path="/agent-router" component={AgentRouter} />
                    <Route path="/vocabulary-cache-admin" component={VocabularyCacheAdmin} />
                    <Route path="/aisays" component={AiSays} />
                    
                    {/* Public Brain Chat Routes - Must be last before NotFound */}
                    <Route path="/:slug" component={PublicBrainChat} />
                    <Route component={NotFound} />
                  </Switch>
                </div>
              </div>
            )}
          </Route>
        </Switch>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
