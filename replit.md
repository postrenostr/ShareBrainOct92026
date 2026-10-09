# ShareBrain - AI Agent Platform

## Overview
ShareBrain is a full-stack web application designed for the creation, management, and testing of AI agents. It offers a platform for users to build custom AI agents with configurable parameters, test them in an interactive environment, and access a library of pre-built agent templates. The platform aims to provide comprehensive AI solutions, from automated customer support and content creation to interactive language learning and intelligent personal assistance. ShareBrain integrates advanced AI capabilities like conversational agent creation, real-time audio caching for instant playback, and robust memory systems to deliver a seamless and intelligent user experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

The application employs a modern full-stack architecture with a clear separation of concerns between the frontend and backend.

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Components**: Shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with a custom design system (black and white theme)
- **State Management**: TanStack Query (React Query) for server state management
- **Build Tool**: Vite for rapid development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for persistent storage
- **AI Integration**: OpenAI GPT-4o and Together AI (Llama 3.1 70B) for agent responses
- **Session Management**: Express sessions with PostgreSQL store
- **Development**: Hot Module Replacement via Vite middleware

### Database Design
A PostgreSQL database is used for persistent storage of:
- **Users**: Authentication and profile information
- **Agents**: Configurations (model, temperature, prompts)
- **Conversations**: Chat sessions
- **Messages**: Individual messages within conversations
- **Templates**: Pre-built agent templates
- **Memories**: Personal, Friends, Global, and Invite Brain memories
- **Workspaces**: Agent code and development projects
- **Community Messages**: Public messages and AI summaries for community agents
- **LLM.txt Configurations**: Agent communication protocol settings
- **API Keys**: For external integrations and usage tracking
- **Agent Documents**: For Retrieval-Augmented Generation (RAG)
- **Business Listings**: For location-based services
- **Brain Modifications**: AI-powered agent modification requests and history
- **Brain Versions**: Complete version control system for agent configurations

### Key Features
- **Agent Management System**: Creation, configuration, and management of custom AI agents with various parameters and categories. Includes conversational agent creation.
- **AI-Powered Brain Modification System**: Revolutionary natural language interface for modifying AI agents using Claude, GPT-4, or Codex. Users can request complex changes like "create 50 Spanish lessons with 20 words each" and have AI assistants generate and apply modifications with full version control and GitHub integration.
- **Interactive Messenger System**: Real-time chat for user-to-agent and user-to-user communication, including multi-participant conversations, contact management, and voice-enabled chat with TTS.
- **Template Library & Automatic Agent Generation**: Library of pre-built templates, supporting automatic bulk creation of specialized agents and data-driven agent generation.
- **Dashboard and Analytics**: User and agent performance metrics, usage analytics, and activity monitoring.
- **Memory System**: Three-tier memory architecture (Personal, Friends, Global Brains) for contextual and persistent AI interactions, powered by Llama 3.1 70B. Also includes isolated memory for "Invite Brains."
- **Website Generation System**: AI-powered generation of comprehensive agent companion websites with custom, SEO-friendly URLs and rich content.
- **Agent Builder (Codex Integration)**: A comprehensive platform for custom AI agent development with JavaScript, including code editing, system prompt definition, testing, debugging, and one-click deployment.
- **GitHub Integration**: Bidirectional synchronization between ShareBrain workspaces and GitHub repositories, facilitating collaborative development and version control. Enhanced with automatic commits for AI-generated modifications.
- **Community Agent System**: Public message feeds and AI summaries for community-driven agents.
- **Language Agent Management System**: Formalized procedures and a universal 500-word curriculum for managing 100+ language teaching agents with dynamic level progression, visual vocabulary, and audio caching.
- **Universal Brain System**: Auto-distribution of core AI agents (e.g., AI Friend Chat, ShareBrain Restaurant) to all users.
- **LLM.txt System**: Standardized protocol for AI-to-AI communication and agent discovery, including access control and revenue generation mechanisms.
- **Unified Discord Bot System**: Access to all ShareBrain agents via Discord slash commands.
- **Authentication System**: Google OAuth 2.0 for secure user authentication and session management.
- **Design System**: Consistent black and white theme (`#000000` and `#ffffff`) applied across the entire application for a unified UI/UX.

## External Dependencies
- **@replit/connectors-sdk**: Authenticated access to the connected Stripe account.
- **@neondatabase/serverless**: PostgreSQL database connectivity.
- **drizzle-orm**: Type-safe ORM for database operations.
- **@tanstack/react-query**: For server state management.
- **@radix-ui/**: Accessible UI component primitives.
- **react-hook-form**: Form handling with validation.
- **zod**: Runtime type validation.
- **OpenAI API**: For GPT-4o models and Text-to-Speech (TTS-1) functionality.
- **Together AI**: For Llama 3.1 70B and 8B models.
- **Stripe**: For payment processing and subscription management.
- **GitHub API**: For repository management and code synchronization.
- **Discord API**: For unified Discord bot integration.
- **Shopify API**: For Shopify app integration (merchant configuration, storefront widget, product data access).
- **esbuild**: For production bundling.
- **tsx**: For TypeScript execution in development.
- **drizzle-kit**: For database schema management and migrations.

## Running this import on Replit

- Run the existing `Start application` workflow (`npm run dev`). Express serves the React/Vite app on `0.0.0.0:5000`, with proxied hosts allowed.
- Development uses a fresh PostgreSQL database, not a copy of the original ShareBrain production data. Its tables were initialized from `shared/schema.ts` using `npm run db:push`.
- `generate-agents-batch.sql` was imported once and contains four starter music tutor templates. Do not rerun it without checking for duplicates.
- The old SQL migrations do not cover the full current schema; do not replay them on this initialized database.
- Required Secrets: `OPENAI_API_KEY`, `TOGETHER_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET`. The database connection is runtime-managed.
- Required configuration: `GOOGLE_CLIENT_ID`, `GOOGLE_CALLBACK_URL`, and `VITE_STRIPE_PUBLIC_KEY`. Register the callback URL (ending in `/api/auth/google/callback`) as an authorized redirect URI in the Google OAuth application.
- Stripe server requests use the attached Stripe connection; no `STRIPE_SECRET_KEY` is needed. The browser publishable key must belong to that same account and mode.
- For schema changes on the development database, use `npm run db:push`. Build with `npm run build`; start a built app with `npm run start`.