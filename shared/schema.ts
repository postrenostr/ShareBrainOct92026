import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, real, json, varchar, index, unique, primaryKey, uuid, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Updated users table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(), // Replit user ID is a string
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  handle: varchar("handle").unique(), // User-chosen display name/handle
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  trialStartDate: timestamp("trial_start_date"),
  trialEndDate: timestamp("trial_end_date"),
  subscriptionStatus: varchar("subscription_status").default("trial"), // trial, active, cancelled, expired
  // GitHub integration fields
  githubUsername: varchar("github_username"), // Developer's GitHub username
  githubAccessToken: varchar("github_access_token"), // GitHub OAuth token (encrypted)
  githubConnectedAt: timestamp("github_connected_at"), // When GitHub was connected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Changed to varchar to match Replit user IDs
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  model: text("model").notNull().default("meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(2048),
  systemPrompt: text("system_prompt"),
  sampleUser: text("sample_user"),
  sampleAgent: text("sample_agent"),
  status: text("status").notNull().default("draft"), // draft, active, testing, inactive
  isTemplate: boolean("is_template").notNull().default(false),
  uses: integer("uses").notNull().default(0),
  rating: real("rating").notNull().default(0),
  voiceEnabled: boolean("voice_enabled").notNull().default(false),
  voiceModel: text("voice_model").default("tts-1"),
  voiceType: text("voice_type").default("alloy"),
  imageEnabled: boolean("image_enabled").notNull().default(false),
  imageModel: text("image_model").default("dall-e-3"),
  imageQuality: text("image_quality").default("standard"), // standard, hd
  isMasterAgent: boolean("is_master_agent").notNull().default(false),
  isPersonal: boolean("is_personal").notNull().default(false),
  isPrivate: boolean("is_private").notNull().default(false), // Private agents are not accessible via API
  isPubliclyVisible: boolean("is_publicly_visible").notNull().default(true), // Agent appears in public directory
  hasSharedMemory: boolean("has_shared_memory").notNull().default(false), // Agent learns from all users collectively
  hasFriendsMemory: boolean("has_friends_memory").notNull().default(false), // Agent learns from friend group only
  triggerKeywords: text("trigger_keywords"), // Comma-separated keywords for master agent triggering
  documentSearchMode: text("document_search_mode").notNull().default("documents_memory_and_general"), // documents_and_memory_only, documents_memory_and_general, memory_only
  hasOnboardingQuestions: boolean("has_onboarding_questions").notNull().default(false), // Agent has custom onboarding questions for new users
  onboardingQuestions: json("onboarding_questions"), // JSON array of questions for new users
  requiresSignup: boolean("requires_signup").notNull().default(false), // Agent requires user to sign up before usage
  signupFields: json("signup_fields"), // JSON array of fields to collect during signup
  isCommunityAgent: boolean("is_community_agent").notNull().default(false), // All messages publicly visible with AI summaries
  // Invite Brain System fields (Phase 1 implementation)
  isInviteBrain: boolean("is_invite_brain").notNull().default(false), // Agent is an invite-only brain
  inviteBrainType: varchar("invite_brain_type"), // 'private_invite', 'public_invite'
  // Self-Editing Agent System fields
  isScriptEditable: boolean("is_script_editable").notNull().default(true), // Allow in-chat script editing
  isSystemAgent: boolean("is_system_agent").notNull().default(false), // System-created agents that shouldn't be editable by users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vocabulary Image Cache System
export const vocabularyImages = pgTable("vocabulary_images", {
  id: serial("id").primaryKey(),
  word: varchar("word", { length: 100 }).notNull().unique(),
  normalizedWord: varchar("normalized_word", { length: 100 }).notNull(), // Lowercase, trimmed version for searching
  imageUrl: text("image_url").notNull(),
  promptUsed: text("prompt_used").notNull(),
  lessonNumber: integer("lesson_number"), // Which lesson (1-50) this word appears in
  wordPosition: integer("word_position"), // Position within the lesson (1-10)
  generationStatus: varchar("generation_status").notNull().default("pending"), // pending, generating, completed, failed
  generationAttempts: integer("generation_attempts").notNull().default(0),
  lastAttemptError: text("last_attempt_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
},
(table) => [
  index("idx_vocabulary_normalized_word").on(table.normalizedWord),
  index("idx_vocabulary_lesson_number").on(table.lessonNumber),
  index("idx_vocabulary_generation_status").on(table.generationStatus),
]);

// Vocabulary Generation Queue for batch processing
export const vocabularyGenerationQueue = pgTable("vocabulary_generation_queue", {
  id: serial("id").primaryKey(),
  word: varchar("word", { length: 100 }).notNull(),
  priority: integer("priority").notNull().default(1), // Higher numbers = higher priority
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  error: text("error"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
},
(table) => [
  index("idx_queue_status").on(table.status),
  index("idx_queue_priority").on(table.priority),
]);

// Type exports for vocabulary image system
export type VocabularyImage = typeof vocabularyImages.$inferSelect;
export type InsertVocabularyImage = typeof vocabularyImages.$inferInsert;
export type VocabularyGenerationQueue = typeof vocabularyGenerationQueue.$inferSelect;
export type InsertVocabularyGenerationQueue = typeof vocabularyGenerationQueue.$inferInsert;

// Type exports for audio caching system
export type VocabularyAudio = typeof vocabularyAudio.$inferSelect;
export type InsertVocabularyAudio = typeof vocabularyAudio.$inferInsert;
export type LessonCache = typeof lessonCache.$inferSelect;
export type InsertLessonCache = typeof lessonCache.$inferInsert;
export type AudioGenerationQueue = typeof audioGenerationQueue.$inferSelect;
export type InsertAudioGenerationQueue = typeof audioGenerationQueue.$inferInsert;

// Agent Script History table for tracking all script changes
export const agentScriptHistory = pgTable("agent_script_history", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(), // User who made the change
  previousScript: text("previous_script"), // Previous system prompt
  newScript: text("new_script"), // New system prompt
  changeReason: text("change_reason"), // Optional reason for change
  scriptVersion: integer("script_version").notNull(), // Version number
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Advertising System Tables
export const advertisements = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Advertiser's user ID
  title: text("title").notNull(),
  description: text("description").notNull(),
  website: text("website"),
  phoneNumber: text("phone_number"),
  email: text("email"),
  address: text("address"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  twitterUrl: text("twitter_url"),
  linkedinUrl: text("linkedin_url"),
  keywords: text("keywords").notNull(), // Comma-separated keywords
  targetAgentIds: text("target_agent_ids"), // Comma-separated agent IDs
  isActive: boolean("is_active").notNull().default(true),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adSubscriptions = pgTable("ad_subscriptions", {
  id: serial("id").primaryKey(),
  advertisementId: integer("advertisement_id").notNull(),
  userId: varchar("user_id").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  status: text("status").notNull().default("active"), // active, cancelled, expired
  monthlyRate: real("monthly_rate").notNull().default(10.00),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adImpressions = pgTable("ad_impressions", {
  id: serial("id").primaryKey(),
  advertisementId: integer("advertisement_id").notNull(),
  userId: varchar("user_id"), // User who saw the ad
  agentId: integer("agent_id"), // Agent where ad was shown
  keyword: text("keyword"), // Keyword that triggered the ad
  timestamp: timestamp("timestamp").defaultNow(),
});

export const adClicks = pgTable("ad_clicks", {
  id: serial("id").primaryKey(),
  advertisementId: integer("advertisement_id").notNull(),
  userId: varchar("user_id"), // User who clicked the ad
  agentId: integer("agent_id"), // Agent where ad was clicked
  keyword: text("keyword"), // Keyword that triggered the ad
  timestamp: timestamp("timestamp").defaultNow(),
});

// LLM.txt System Tables
export const llmTxtConfigs = pgTable("llm_txt_configs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(),
  citationFormat: text("citation_format").notNull(),
  allowedMethods: json("allowed_methods").notNull(), // JSON array of allowed interaction methods
  rateLimit: integer("rate_limit").notNull().default(100),
  accessLevel: text("access_level").notNull().default("public"), // public, authenticated, paid
  pricePerRequest: real("price_per_request").notNull().default(0),
  customRules: text("custom_rules"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentApiKeys = pgTable("agent_api_keys", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  keyName: text("key_name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  accessLevel: text("access_level").notNull().default("read"), // read, write, admin
  rateLimit: integer("rate_limit").notNull().default(1000),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentApiUsage = pgTable("agent_api_usage", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  apiKeyId: integer("api_key_id").notNull(),
  requestorAgentId: integer("requestor_agent_id"),
  method: text("method").notNull(),
  endpoint: text("endpoint").notNull(),
  responseCode: integer("response_code").notNull(),
  tokensUsed: integer("tokens_used").notNull().default(0),
  cost: real("cost").notNull().default(0),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  userId: varchar("user_id").notNull(), // Changed to varchar to match Replit user IDs
  title: text("title").notNull(),
  currentActiveAgentId: integer("current_active_agent_id"), // For master agent conversations
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  metadata: json("metadata"), // response time, tokens used, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Unified messages for the new chat system
export const unifiedMessages = pgTable("unified_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: varchar("sender_id"), // User ID who sent the message
  senderAgentId: integer("sender_agent_id"), // Agent ID who sent the message
  senderType: text("sender_type").notNull(), // 'user' or 'agent'
  content: text("content").notNull(),
  messageType: text("message_type").default("text"), // text, image, file, system
  replyToId: integer("reply_to_id"), // For threaded replies
  metadata: json("metadata"), // response time, tokens used, read status, etc.
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for display (ak-12345678...)
  name: text("name").notNull(),
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const agentCreationManuals = pgTable("agent_creation_manuals", {
  id: serial("id").primaryKey(),
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  domainQuestions: text("domain_questions"),
  enthusiastQuestions: text("enthusiast_questions"),
  contentStructure: text("content_structure"),
  qualityBenchmarks: text("quality_benchmarks"),
  exampleAgent: varchar("example_agent", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatInvitations = pgTable("chat_invitations", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  invitedUserId: varchar("invited_user_id").notNull(),
  invitedByUserId: varchar("invited_by_user_id").notNull(),
  agentId: integer("agent_id"), // The agent in the conversation
  status: varchar("status").notNull().default("pending"), // pending, accepted, declined
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// A/B Testing System for Sign-up Questions
export const signupQuestionSets = pgTable("signup_question_sets", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  questions: json("questions").notNull(), // Array of question objects
  isActive: boolean("is_active").notNull().default(true),
  weight: integer("weight").notNull().default(1), // For weighted random selection
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const signupTestSessions = pgTable("signup_test_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  questionSetId: integer("question_set_id").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  totalQuestions: integer("total_questions").notNull(),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  completionRate: real("completion_rate").notNull().default(0),
  timeToComplete: integer("time_to_complete"), // in seconds
  abandonedAt: timestamp("abandoned_at"),
  abandonedOnStep: integer("abandoned_on_step"),
});

export const signupQuestionResponses = pgTable("signup_question_responses", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  questionId: varchar("question_id").notNull(),
  questionText: text("question_text").notNull(),
  response: text("response"),
  responseTime: integer("response_time"), // in seconds
  isSkipped: boolean("is_skipped").notNull().default(false),
  stepNumber: integer("step_number").notNull(),
  answeredAt: timestamp("answered_at").notNull().defaultNow(),
});

// Friend relationships table
export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id").notNull(), // User who sent friend request
  addresseeId: varchar("addressee_id").notNull(), // User who received friend request
  status: text("status").notNull().default("pending"), // pending, accepted, declined, blocked
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Friend requests table for handle-based invitations
export const friendRequests = pgTable("friend_requests", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull(),
  receiverId: varchar("receiver_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Updated contacts table to handle both users and agents
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  contactUserId: varchar("contact_user_id"), // For human friends
  agentId: integer("agent_id"), // For AI agents
  contactType: text("contact_type").notNull(), // 'user' or 'agent'
  displayName: text("display_name"), // Custom display name for the contact
  isOnline: boolean("is_online").default(false), // Online status
  lastSeen: timestamp("last_seen"),
  conversationId: integer("conversation_id"), // Link to specific conversation for group chats
  hasNewMessage: boolean("has_new_message").notNull().default(false), // Red "New Chat" indicator
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Updated conversations to support both user-to-user and user-to-agent chats
export const unifiedConversations = pgTable("unified_conversations", {
  id: serial("id").primaryKey(),
  title: text("title"),
  type: text("type").notNull(), // 'direct', 'group', 'agent'
  createdBy: varchar("created_by").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastMessageId: integer("last_message_id"),
  lastActivity: timestamp("last_activity").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Participants in unified conversations - matches actual database structure
export const conversationParticipants = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  contactId: integer("contact_id").notNull(),
  userId: varchar("user_id"), // For human participants  
  agentId: integer("agent_id"), // For AI participants
  participantType: text("participant_type").notNull(), // 'user' or 'agent'
  role: text("role").default("member"), // member, admin, owner
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastRead: timestamp("last_read"),
});

// RAG System: Prompt embeddings for semantic search
export const promptEmbeddings = pgTable("prompt_embeddings", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  userId: varchar("user_id").notNull(),
  promptType: text("prompt_type").notNull(), // 'system', 'sample_user', 'sample_agent'
  promptText: text("prompt_text").notNull(),
  embedding: text("embedding").notNull(), // JSON string of embedding vector
  tokens: integer("tokens").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// RAG System: Prompt analytics and performance tracking
export const promptAnalytics = pgTable("prompt_analytics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  userId: varchar("user_id").notNull(),
  promptType: text("prompt_type").notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  avgRating: real("avg_rating").default(0),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// RAG System: Document storage for agent knowledge base
export const agentDocuments = pgTable("agent_documents", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  userId: varchar("user_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // 'pdf', 'txt', 'docx', 'md', etc.
  fileSize: integer("file_size").notNull(), // in bytes
  fileContent: text("file_content").notNull(), // extracted text content
  embedding: text("embedding").notNull(), // JSON string of document embedding
  chunks: json("chunks").notNull(), // Array of text chunks with their embeddings
  metadata: json("metadata"), // Additional file metadata
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// RAG System: Document chunks for fine-grained search
export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  agentId: integer("agent_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  chunkText: text("chunk_text").notNull(),
  embedding: text("embedding").notNull(), // JSON string of chunk embedding
  tokens: integer("tokens").notNull(),
  metadata: json("metadata"), // Chunk-specific metadata (page number, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});


// Business Listings System
export const agentListings = pgTable("agent_listings", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  businessName: text("business_name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // bar, restaurant, hotel, etc.
  contactEmail: text("contact_email").notNull(),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("US"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  hours: json("hours"), // Operating hours object
  priceRange: text("price_range"), // $, $$, $$$, $$$$
  specialOffers: text("special_offers"), // Happy hour details, promotions
  amenities: text("amenities").array(), // WiFi, Parking, Pet Friendly, etc.
  images: text("images").array(), // Image URLs
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  submittedBy: text("submitted_by"), // Email of submitter
  moderatedBy: text("moderated_by"), // Admin who approved/rejected
  moderationNotes: text("moderation_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Personal memories table for Personal Agents
export const personalMemories = pgTable("personal_memories", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  agentId: integer("agent_id").notNull(),
  memoryKey: varchar("memory_key", { length: 100 }).notNull(),
  memoryValue: text("memory_value").notNull(),
  originalStatement: text("original_statement"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Friends memories for friend-group shared agents
export const friendsMemories = pgTable("friends_memories", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  contributorId: varchar("contributor_id").notNull(), // User who added this memory
  memoryKey: varchar("memory_key", { length: 100 }).notNull(),
  memoryValue: text("memory_value").notNull(),
  originalStatement: text("original_statement"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Shared memories for collaborative learning agents
export const sharedMemories = pgTable("shared_memories", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  contributorId: varchar("contributor_id").notNull(), // User who added this memory
  memoryKey: varchar("memory_key", { length: 100 }).notNull(),
  memoryValue: text("memory_value").notNull(),
  originalStatement: text("original_statement"),
  isVerified: boolean("is_verified").notNull().default(false), // For future moderation
  upvotes: integer("upvotes").notNull().default(0), // Community validation
  downvotes: integer("downvotes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ===============================================
// INVITE BRAIN SYSTEM TABLES (Phase 1)
// ===============================================

// Invite brain instances - creates exclusive member-only AI brains
export const inviteBrains = pgTable("invite_brains", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(), // Reference to the underlying agent
  creatorId: varchar("creator_id").notNull(), // User who created this invite brain
  brainType: varchar("brain_type").notNull(), // 'private_invite', 'public_invite'
  accessModel: varchar("access_model").notNull(), // 'invite_only', 'request_to_join', 'paid_access'
  name: varchar("name").notNull(),
  description: text("description"),
  memberLimit: integer("member_limit"), // Maximum number of members (optional)
  isActive: boolean("is_active").notNull().default(true),
  // Payment configuration (placeholder for future implementation)
  isPaid: boolean("is_paid").notNull().default(false),
  accessFee: real("access_fee").default(0),
  subscriptionType: varchar("subscription_type"), // 'one_time', 'monthly', 'yearly'
  currency: varchar("currency").default("USD"),
  // Role configuration
  enableContributors: boolean("enable_contributors").notNull().default(true),
  enableViewers: boolean("enable_viewers").notNull().default(true),
  defaultRole: varchar("default_role").notNull().default("contributor"), // 'contributor', 'viewer'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Brain memberships - manages who has access to each invite brain
export const brainMemberships = pgTable("brain_memberships", {
  id: serial("id").primaryKey(),
  brainId: integer("brain_id").notNull(), // Reference to invite_brains
  userId: varchar("user_id").notNull(), // Member user ID
  role: varchar("role").notNull(), // 'creator', 'contributor', 'viewer'
  status: varchar("status").notNull().default("active"), // 'active', 'pending', 'suspended', 'banned'
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  invitedBy: varchar("invited_by"), // User ID who sent the invitation
  // Payment tracking (placeholder for future implementation)
  paymentStatus: varchar("payment_status"), // 'paid', 'pending', 'failed', 'refunded'
  subscriptionId: varchar("subscription_id"), // Stripe subscription ID
  paidAt: timestamp("paid_at"), // When payment was completed
}, (table) => [
  // Ensure unique membership per brain per user
  unique().on(table.brainId, table.userId)
]);

// Brain invitations - manages invitation and join request system
export const brainInvitations = pgTable("brain_invitations", {
  id: serial("id").primaryKey(),
  brainId: integer("brain_id").notNull(), // Reference to invite_brains
  inviterId: varchar("inviter_id").notNull(), // User who sent invitation or null for join requests
  inviteeEmail: varchar("invitee_email"), // Email address for direct invitations
  inviteeUsername: varchar("invitee_username"), // Username for platform user invitations
  inviteeUserId: varchar("invitee_user_id"), // User ID if platform user is known
  invitationType: varchar("invitation_type").notNull(), // 'direct_invite', 'join_request'
  status: varchar("status").notNull().default("pending"), // 'pending', 'accepted', 'declined', 'expired'
  role: varchar("role").notNull().default("contributor"), // Intended role for invitee
  message: text("message"), // Optional invitation message
  expiresAt: timestamp("expires_at"), // When invitation expires
  respondedAt: timestamp("responded_at"), // When invitation was accepted/declined
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invite brain memories - isolated memory storage for invite brains
export const inviteBrainMemories = pgTable("invite_brain_memories", {
  id: serial("id").primaryKey(),
  brainId: integer("brain_id").notNull(), // Reference to invite_brains
  contributorId: varchar("contributor_id").notNull(), // User who created this memory
  memoryKey: varchar("memory_key", { length: 100 }).notNull(),
  memoryValue: text("memory_value").notNull(),
  originalStatement: text("original_statement"),
  memoryCategory: varchar("memory_category").notNull(), // Classification of memory type
  contributorRole: varchar("contributor_role").notNull(), // Role of contributor when memory was created
  isVerified: boolean("is_verified").notNull().default(false), // For future moderation
  upvotes: integer("upvotes").notNull().default(0), // Member validation
  downvotes: integer("downvotes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Index for efficient brain-specific memory queries
  index("idx_invite_brain_memories_brain_id").on(table.brainId),
  index("idx_invite_brain_memories_contributor").on(table.contributorId)
]);

// Brain payments - payment tracking for paid invite brains (placeholder for future)
export const brainPayments = pgTable("brain_payments", {
  id: serial("id").primaryKey(),
  brainId: integer("brain_id").notNull(), // Reference to invite_brains
  userId: varchar("user_id").notNull(), // User who made payment
  amount: real("amount").notNull(),
  currency: varchar("currency").notNull().default("USD"),
  paymentStatus: varchar("payment_status").notNull(), // 'pending', 'completed', 'failed', 'refunded'
  paymentMethod: varchar("payment_method"), // 'stripe', 'paypal', etc.
  stripePaymentId: varchar("stripe_payment_id"), // External payment system ID
  stripeSubscriptionId: varchar("stripe_subscription_id"), // For recurring payments
  subscriptionPeriod: varchar("subscription_period"), // 'monthly', 'yearly', 'one_time'
  paidAt: timestamp("paid_at"), // When payment was completed
  refundedAt: timestamp("refunded_at"), // When payment was refunded
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Brain Modifications - AI-powered agent modifications system
export const brainModifications = pgTable("brain_modifications", {
  id: serial("id").primaryKey(),
  brainId: integer("brain_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(), // User who requested the modification
  instruction: text("instruction").notNull(), // User's natural language instruction
  aiProvider: varchar("ai_provider", { length: 20 }).notNull(), // 'claude', 'gpt4', 'codex'
  modificationScope: varchar("modification_scope", { length: 20 }).notNull(), // 'content', 'system_prompt', 'code', 'structure'
  status: varchar("status", { length: 20 }).notNull().default("pending_review"), // pending_review, applied, rejected, failed
  proposedChanges: json("proposed_changes").notNull(), // AI-generated changes in structured format
  previewContent: text("preview_content").notNull(), // Human-readable summary of changes
  estimatedImpact: text("estimated_impact").notNull(), // AI assessment of modification impact
  appliedAt: timestamp("applied_at"), // When the modification was applied
  rejectedAt: timestamp("rejected_at"), // When the modification was rejected
  rejectionReason: text("rejection_reason"), // Reason for rejection
  gitCommitHash: varchar("git_commit_hash", { length: 40 }), // Associated git commit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Brain Versions - Version control for brain configurations
export const brainVersions = pgTable("brain_versions", {
  id: serial("id").primaryKey(),
  brainId: integer("brain_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  description: text("description").notNull(), // Description of this version
  brainSnapshot: json("brain_snapshot").notNull(), // Complete brain configuration at this point
  gitCommitHash: varchar("git_commit_hash", { length: 40 }), // Associated git commit
  createdBy: varchar("created_by"), // User who created this version
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique().on(table.brainId, table.versionNumber), // Unique version numbers per brain
  index("idx_brain_versions_brain_id").on(table.brainId)
]);

// Agent workspaces for custom development with Replit integration
export const agentWorkspaces = pgTable("agent_workspaces", {
  id: varchar("id").primaryKey(), // UUID for workspace identification
  userId: varchar("user_id").notNull(), // Owner of the workspace
  agentId: integer("agent_id"), // Reference to the source agent
  name: varchar("name").notNull(),
  description: text("description"),
  code: text("code").notNull(), // JavaScript code for the agent
  systemPrompt: text("system_prompt").notNull(),
  memoryType: varchar("memory_type").notNull().default("personal"), // personal, friends, global
  status: varchar("status").notNull().default("development"), // development, testing, deployed
  replitUrl: varchar("replit_url"), // URL to the Replit workspace
  replitProjectId: varchar("replit_project_id"), // Replit project ID
  websiteSlug: varchar("website_slug").unique(), // Clean URL slug for agent websites
  deployedAgentId: integer("deployed_agent_id"), // Reference to deployed agent
  isPublic: boolean("is_public").notNull().default(false), // Whether workspace is public
  version: integer("version").notNull().default(1), // Version tracking
  lastTestResults: json("last_test_results"), // Store test results
  // Git integration fields
  githubRepoUrl: varchar("github_repo_url"), // Full GitHub repository URL
  githubRepoName: varchar("github_repo_name"), // Repository name (e.g., "sharebrain-agent-username")
  githubUsername: varchar("github_username"), // Developer's GitHub username
  gitBranch: varchar("git_branch").default("main"), // Current Git branch
  lastGitSync: timestamp("last_git_sync"), // Last time Git was synced
  gitCommitHash: varchar("git_commit_hash"), // Latest commit hash
  gitSyncStatus: varchar("git_sync_status").default("pending"), // pending, synced, error
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Agent signup data shared with agent creators
export const agentSignups = pgTable("agent_signups", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  userId: varchar("user_id").notNull(), // User who signed up
  signupData: json("signup_data").notNull(), // User's signup information
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueUserAgent: unique().on(table.agentId, table.userId), // Prevent duplicate signups
}));

// Community Agent Public Messages
export const communityMessages = pgTable("community_messages", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  userId: varchar("user_id"), // Null for agent messages
  userHandle: varchar("user_handle"), // Display name for the user
  agentName: varchar("agent_name"), // Display name for the agent
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  messageType: text("message_type").default("text"), // text, image, system
  metadata: json("metadata"), // response time, tokens used, etc.
  isVisible: boolean("is_visible").notNull().default(true), // For moderation
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Community Agent AI Summaries
export const communitySummaries = pgTable("community_summaries", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  summaryType: text("summary_type").notNull(), // 'daily', 'weekly', 'topic', 'monthly'
  summaryPeriod: text("summary_period").notNull(), // '2025-01-18', '2025-W03', 'topic-ai-safety'
  title: text("title").notNull(),
  content: text("content").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  userCount: integer("user_count").notNull().default(0),
  keyTopics: json("key_topics"), // Array of extracted topics
  metadata: json("metadata"), // AI analysis metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AIsays system tables for interactive AI knowledge curation
export const aiSaysResponses = pgTable("aisays_responses", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  aiAnswer: text("ai_answer").notNull(),
  aiProvider: text("ai_provider"),
  confidenceScore: real("confidence_score"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiSaysInteractions = pgTable("aisays_interactions", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => aiSaysResponses.id, { onDelete: "cascade" }),
  userId: varchar("user_id"),
  interactionType: text("interaction_type").notNull(), // 'agree', 'flag', 'edit'
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiSaysCuratedKnowledge = pgTable("aisays_curated_knowledge", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  verifiedAnswer: text("verified_answer").notNull(),
  sourceResponseIds: json("source_response_ids").$type<number[]>().default([]),
  confidenceLevel: real("confidence_level"),
  curatorNotes: text("curator_notes"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

// Language Learning Lesson Cache System
export const vocabularyAudio = pgTable("vocabulary_audio", {
  id: serial("id").primaryKey(),
  word: varchar("word", { length: 100 }).notNull(),
  language: varchar("language", { length: 10 }).notNull().default("en"), // Language code
  voice: varchar("voice", { length: 20 }).notNull().default("alloy"), // TTS voice type
  audioUrl: text("audio_url").notNull(), // URL to cached audio file
  duration: real("duration"), // Audio duration in seconds
  fileSize: integer("file_size"), // Audio file size in bytes
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // Ensure unique audio cache per word/language/voice combination
  unique().on(table.word, table.language, table.voice),
  index("idx_vocabulary_audio_word").on(table.word),
  index("idx_vocabulary_audio_language").on(table.language)
]);

// Cached lesson content and audio for language teaching agents
export const lessonCache = pgTable("lesson_cache", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 10 }).notNull(), // Target language (es, fr, de, etc.)
  lessonNumber: integer("lesson_number").notNull(), // Lesson 1-50
  lessonTitle: varchar("lesson_title", { length: 200 }).notNull(),
  lessonContent: text("lesson_content").notNull(), // Pre-generated lesson text
  vocabularyWords: json("vocabulary_words").notNull(), // Array of {word, translation} objects
  fullLessonAudioUrl: text("full_lesson_audio_url"), // Complete lesson narration
  lessonAudioDuration: real("lesson_audio_duration"), // Full audio duration in seconds
  voice: varchar("voice", { length: 20 }).notNull().default("alloy"), // TTS voice consistency
  contentHash: varchar("content_hash", { length: 64 }).notNull(), // SHA256 of content for cache validation
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Ensure unique lesson cache per language/lesson/voice combination
  unique().on(table.language, table.lessonNumber, table.voice),
  index("idx_lesson_cache_language").on(table.language),
  index("idx_lesson_cache_lesson_number").on(table.lessonNumber)
]);

// Audio generation queue for batch processing
export const audioGenerationQueue = pgTable("audio_generation_queue", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(), // 'word', 'lesson'
  targetId: varchar("target_id", { length: 100 }).notNull(), // word or lesson identifier
  language: varchar("language", { length: 10 }).notNull(),
  voice: varchar("voice", { length: 20 }).notNull().default("alloy"),
  content: text("content").notNull(), // Text content to generate audio for
  priority: integer("priority").notNull().default(1), // 1=high, 2=medium, 3=low
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, processing, completed, failed
  attempts: integer("attempts").notNull().default(0),
  errorMessage: text("error_message"),
  generatedAudioUrl: text("generated_audio_url"), // Result URL when completed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_audio_queue_status").on(table.status),
  index("idx_audio_queue_priority").on(table.priority),
  index("idx_audio_queue_type").on(table.type)
]);

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  uses: true,
  rating: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().optional(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFriendRequestSchema = createInsertSchema(friendRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunityMessageSchema = createInsertSchema(communityMessages).omit({
  id: true,
  createdAt: true,
});

export const insertCommunitySummarySchema = createInsertSchema(communitySummaries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiSaysResponseSchema = createInsertSchema(aiSaysResponses).omit({
  id: true,
  createdAt: true,
});

export const insertAiSaysInteractionSchema = createInsertSchema(aiSaysInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertAiSaysCuratedKnowledgeSchema = createInsertSchema(aiSaysCuratedKnowledge).omit({
  id: true,
  lastUpdated: true,
});



export const insertBrainModificationSchema = createInsertSchema(brainModifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBrainVersionSchema = createInsertSchema(brainVersions).omit({
  id: true,
  createdAt: true,
});

// Type exports for brain modification system
export type BrainModification = typeof brainModifications.$inferSelect;
export type InsertBrainModification = z.infer<typeof insertBrainModificationSchema>;
export type BrainVersion = typeof brainVersions.$inferSelect;
export type InsertBrainVersion = z.infer<typeof insertBrainVersionSchema>;

// Advertising system schemas
export const insertAdvertisementSchema = createInsertSchema(advertisements).omit({
  id: true,
  impressions: true,
  clicks: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdSubscriptionSchema = createInsertSchema(adSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdImpressionSchema = createInsertSchema(adImpressions).omit({
  id: true,
  timestamp: true,
});

export const insertAdClickSchema = createInsertSchema(adClicks).omit({
  id: true,
  timestamp: true,
});

// A/B Testing schemas
export const insertSignupQuestionSetSchema = createInsertSchema(signupQuestionSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSignupTestSessionSchema = createInsertSchema(signupTestSessions).omit({
  id: true,
  startedAt: true,
});

export const insertSignupQuestionResponseSchema = createInsertSchema(signupQuestionResponses).omit({
  id: true,
  answeredAt: true,
});

export const insertUnifiedConversationSchema = createInsertSchema(unifiedConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUnifiedMessageSchema = createInsertSchema(unifiedMessages).omit({
  id: true,
  createdAt: true,
});

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({
  id: true,
  joinedAt: true,
});

export const insertAgentListingSchema = createInsertSchema(agentListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  businessName: z.string().min(1, "Business name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  contactEmail: z.string().email("Valid email is required"),
  category: z.string().min(1, "Category is required"),
});

export const insertPersonalMemorySchema = createInsertSchema(personalMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFriendsMemorySchema = createInsertSchema(friendsMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSharedMemorySchema = createInsertSchema(sharedMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Invite Brain System schemas
export const insertInviteBrainSchema = createInsertSchema(inviteBrains).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Brain name is required"),
  brainType: z.enum(["private_invite", "public_invite"]),
  accessModel: z.enum(["invite_only", "request_to_join", "paid_access"]),
  defaultRole: z.enum(["contributor", "viewer"]),
});

export const insertBrainMembershipSchema = createInsertSchema(brainMemberships).omit({
  id: true,
  joinedAt: true,
}).extend({
  role: z.enum(["creator", "contributor", "viewer"]),
  status: z.enum(["active", "pending", "suspended", "banned"]),
});

export const insertBrainInvitationSchema = createInsertSchema(brainInvitations).omit({
  id: true,
  createdAt: true,
}).extend({
  invitationType: z.enum(["direct_invite", "join_request"]),
  status: z.enum(["pending", "accepted", "declined", "expired"]),
  role: z.enum(["contributor", "viewer"]),
});

export const insertInviteBrainMemorySchema = createInsertSchema(inviteBrainMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  contributorRole: z.enum(["creator", "contributor", "viewer"]),
});

export const insertBrainPaymentSchema = createInsertSchema(brainPayments).omit({
  id: true,
  createdAt: true,
});

// ==========================================
// AGENT ORCHESTRATION SYSTEM TABLES
// ==========================================

// Agent capabilities and specializations for intelligent routing
export const agentCapabilities = pgTable("agent_capabilities", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // e.g., "language_catalan", "cooking_italian", "travel_europe"
  subCategory: text("sub_category"), // e.g., "grammar", "pronunciation", "vocabulary"
  specialtyKeywords: text("specialty_keywords").notNull(), // Comma-separated keywords for matching
  capabilities: json("capabilities").notNull(), // JSON array of specific capabilities
  proficiencyLevel: integer("proficiency_level").notNull().default(5), // 1-10 skill level
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent rankings and performance metrics
export const agentRankings = pgTable("agent_rankings", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // Same categories as agentCapabilities
  qualityScore: real("quality_score").notNull().default(5.0), // 1-10 algorithm-calculated quality
  userPreferenceScore: real("user_preference_score").notNull().default(5.0), // User feedback score
  totalUses: integer("total_uses").notNull().default(0),
  averageRating: real("average_rating").notNull().default(0),
  responseTime: real("response_time").notNull().default(0), // Average response time in seconds
  continuationRate: real("continuation_rate").notNull().default(0), // % of conversations that continue
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User preferences for specific agents in categories
export const userAgentPreferences = pgTable("user_agent_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // e.g., "language_catalan"
  preferredAgentId: integer("preferred_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  confidence: real("confidence").notNull().default(1.0), // How confident we are in this preference (0-1)
  selectionCount: integer("selection_count").notNull().default(1), // How many times user chose this agent
  lastSelected: timestamp("last_selected").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agent-to-agent interactions and orchestration logs
export const agentInteractions = pgTable("agent_interactions", {
  id: serial("id").primaryKey(),
  initiatingAgentId: integer("initiating_agent_id").references(() => agents.id, { onDelete: "cascade" }),
  targetAgentId: integer("target_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  queryText: text("query_text").notNull(), // The original user query
  routingReason: text("routing_reason"), // Why this agent was selected
  responseQuality: real("response_quality"), // User feedback on response (1-5)
  continuedConversation: boolean("continued_conversation").notNull().default(false),
  responseTime: real("response_time"), // Time to generate response
  createdAt: timestamp("created_at").defaultNow(),
});

// Intent detection and routing logs
export const intentDetectionLogs = pgTable("intent_detection_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  queryText: text("query_text").notNull(),
  detectedIntent: text("detected_intent"), // e.g., "language_translation", "recipe_request"
  detectedCategory: text("detected_category"), // e.g., "language_catalan", "cooking_italian"
  confidence: real("confidence").notNull().default(0), // AI confidence in detection (0-1)
  selectedAgentId: integer("selected_agent_id").references(() => agents.id, { onDelete: "cascade" }),
  wasCorrect: boolean("was_correct"), // User feedback on routing accuracy
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgentWorkspaceSchema = createInsertSchema(agentWorkspaces).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertAgentSignupSchema = createInsertSchema(agentSignups).omit({
  id: true,
  createdAt: true,
});

export const insertChatInvitationSchema = createInsertSchema(chatInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Agent Orchestration System schemas
export const insertAgentCapabilitySchema = createInsertSchema(agentCapabilities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  category: z.string().min(1, "Category is required"),
  specialtyKeywords: z.string().min(1, "Specialty keywords are required"),
  capabilities: z.array(z.string()).min(1, "At least one capability is required"),
  proficiencyLevel: z.number().min(1).max(10),
});

export const insertAgentRankingSchema = createInsertSchema(agentRankings).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
}).extend({
  category: z.string().min(1, "Category is required"),
  qualityScore: z.number().min(1).max(10),
  userPreferenceScore: z.number().min(1).max(10),
});

export const insertUserAgentPreferenceSchema = createInsertSchema(userAgentPreferences).omit({
  id: true,
  createdAt: true,
  lastSelected: true,
}).extend({
  category: z.string().min(1, "Category is required"),
  confidence: z.number().min(0).max(1),
});

export const insertAgentInteractionSchema = createInsertSchema(agentInteractions).omit({
  id: true,
  createdAt: true,
}).extend({
  queryText: z.string().min(1, "Query text is required"),
});

export const insertIntentDetectionLogSchema = createInsertSchema(intentDetectionLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  queryText: z.string().min(1, "Query text is required"),
  confidence: z.number().min(0).max(1),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type CommunityMessage = typeof communityMessages.$inferSelect;
export type InsertCommunityMessage = z.infer<typeof insertCommunityMessageSchema>;
export type CommunitySummary = typeof communitySummaries.$inferSelect;
export type InsertCommunitySummary = z.infer<typeof insertCommunitySummarySchema>;

export type Agent = typeof agents.$inferSelect & {
  websiteUrl?: string | null;
  websiteSlug?: string | null;
};
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;

// Unified Chat System Types
export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;

export type FriendRequest = typeof friendRequests.$inferSelect;
export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;

export type UnifiedConversation = typeof unifiedConversations.$inferSelect;
export type InsertUnifiedConversation = z.infer<typeof insertUnifiedConversationSchema>;

export type UnifiedMessage = typeof unifiedMessages.$inferSelect;  
export type InsertUnifiedMessage = z.infer<typeof insertUnifiedMessageSchema>;

// API Key Types
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// Agent Creation Manual Types
export type AgentCreationManual = typeof agentCreationManuals.$inferSelect;
export type InsertAgentCreationManual = typeof agentCreationManuals.$inferInsert;

// RAG System Types
export type PromptEmbedding = typeof promptEmbeddings.$inferSelect;
export type InsertPromptEmbedding = typeof promptEmbeddings.$inferInsert;

// Agent Workspace Types
export type AgentWorkspace = typeof agentWorkspaces.$inferSelect;

// Advertising system types
export type Advertisement = typeof advertisements.$inferSelect;
export type AdSubscription = typeof adSubscriptions.$inferSelect;
export type AdImpression = typeof adImpressions.$inferSelect;
export type AdClick = typeof adClicks.$inferSelect;

export type InsertAdvertisement = z.infer<typeof insertAdvertisementSchema>;
export type InsertAdSubscription = z.infer<typeof insertAdSubscriptionSchema>;
export type InsertAdImpression = z.infer<typeof insertAdImpressionSchema>;
export type InsertAdClick = z.infer<typeof insertAdClickSchema>;
export type InsertAgentWorkspace = z.infer<typeof insertAgentWorkspaceSchema>;

export type AgentSignup = typeof agentSignups.$inferSelect;
export type InsertAgentSignup = z.infer<typeof insertAgentSignupSchema>;

export type ChatInvitation = typeof chatInvitations.$inferSelect;
export type InsertChatInvitation = z.infer<typeof insertChatInvitationSchema>;

export type PromptAnalytics = typeof promptAnalytics.$inferSelect;
export type InsertPromptAnalytics = typeof promptAnalytics.$inferInsert;

export type AgentDocument = typeof agentDocuments.$inferSelect;
export type InsertAgentDocument = typeof agentDocuments.$inferInsert;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

// Listings System Types
export type AgentListing = typeof agentListings.$inferSelect;
export type InsertAgentListing = z.infer<typeof insertAgentListingSchema>;

export type PersonalMemory = typeof personalMemories.$inferSelect;
export type InsertPersonalMemory = z.infer<typeof insertPersonalMemorySchema>;
export type FriendsMemory = typeof friendsMemories.$inferSelect;
export type InsertFriendsMemory = z.infer<typeof insertFriendsMemorySchema>;
export type SharedMemory = typeof sharedMemories.$inferSelect;
export type InsertSharedMemory = z.infer<typeof insertSharedMemorySchema>;

// Agent Orchestration System Types
export type AgentCapability = typeof agentCapabilities.$inferSelect;
export type InsertAgentCapability = z.infer<typeof insertAgentCapabilitySchema>;

export type AgentRanking = typeof agentRankings.$inferSelect;
export type InsertAgentRanking = z.infer<typeof insertAgentRankingSchema>;

export type UserAgentPreference = typeof userAgentPreferences.$inferSelect;
export type InsertUserAgentPreference = z.infer<typeof insertUserAgentPreferenceSchema>;

export type AgentInteraction = typeof agentInteractions.$inferSelect;
export type InsertAgentInteraction = z.infer<typeof insertAgentInteractionSchema>;

export type IntentDetectionLog = typeof intentDetectionLogs.$inferSelect;
export type InsertIntentDetectionLog = z.infer<typeof insertIntentDetectionLogSchema>;

export type AiSaysResponse = typeof aiSaysResponses.$inferSelect;
export type InsertAiSaysResponse = z.infer<typeof insertAiSaysResponseSchema>;
export type AiSaysInteraction = typeof aiSaysInteractions.$inferSelect;
export type InsertAiSaysInteraction = z.infer<typeof insertAiSaysInteractionSchema>;
export type AiSaysCuratedKnowledge = typeof aiSaysCuratedKnowledge.$inferSelect;
export type InsertAiSaysCuratedKnowledge = z.infer<typeof insertAiSaysCuratedKnowledgeSchema>;

// Invite Brain System types
export type InviteBrain = typeof inviteBrains.$inferSelect;
export type InsertInviteBrain = z.infer<typeof insertInviteBrainSchema>;

export type BrainMembership = typeof brainMemberships.$inferSelect;
export type InsertBrainMembership = z.infer<typeof insertBrainMembershipSchema>;

export type BrainInvitation = typeof brainInvitations.$inferSelect;
export type InsertBrainInvitation = z.infer<typeof insertBrainInvitationSchema>;

export type InviteBrainMemory = typeof inviteBrainMemories.$inferSelect;
export type InsertInviteBrainMemory = z.infer<typeof insertInviteBrainMemorySchema>;

export type BrainPayment = typeof brainPayments.$inferSelect;
export type InsertBrainPayment = z.infer<typeof insertBrainPaymentSchema>;

// Agent Script History types
export type AgentScriptHistory = typeof agentScriptHistory.$inferSelect;
export const insertAgentScriptHistorySchema = createInsertSchema(agentScriptHistory);
export type InsertAgentScriptHistory = z.infer<typeof insertAgentScriptHistorySchema>;

// Separate fixed lessons for the 10words language agents. Existing teacher caches are untouched.
export const tenWordsLessons = pgTable("ten_words_lessons", {
  language: varchar("language", { length: 10 }).notNull(),
  lessonNumber: integer("lesson_number").notNull(),
  words: json("words").$type<string[]>().notNull(),
  sentences: json("sentences").$type<string[]>().notNull(),
  audioBase64: text("audio_base64"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.language, table.lessonNumber] })]);

// Dedicated 10words clients: only hashes are stored; credentials are returned once.
export const tenWordsApiClients = pgTable("ten_words_api_clients", {
  id: uuid("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 11 }).notNull(),
  scopes: text("scopes").array().notNull(),
  rateLimit: integer("rate_limit").notNull().default(120),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().default(sql`date_trunc('minute',now())`),
  windowCount: integer("window_count").notNull().default(0),
  usageCount: bigint("usage_count", { mode: "number" }).notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
