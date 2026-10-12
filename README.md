<img width="1672" height="941" alt="MuseSpark App Tutorial" src="https://github.com/user-attachments/assets/79585d78-3fc4-4673-936e-cd7c14fa04dc" />


# 🤖 MuseSpark

⚡ MuseSpark — AI creativity engine. Sparks ideas, not clicks.

A universal React Native application for **MuseSpark** and AI companion **Cooper** — an autonomous AI agent for recurring tasks, workflows, and goals.

Built with **Expo (SDK 57)**, **React Native 0.86**, **Expo Router**, and **TypeScript**.

---

## ✨ Features

- **Google Sign-In Authentication:** Beautiful onboarding screen with official 4-color SVG Google sign-in button.
- **Header & 3D Character Mascot:** Sticky top header featuring Cooper's 3D portrait, floating name pill, 2-line menu with unread indicator dot, and 3-dots action sheet.
- **AI Chat With Connected Tools:** Cooper can answer normally, use Browserbase browser sessions, and call connected Composio tools for workspace workflows.
- **Stadium Floating Dock:** Bottom capsule dock switching between **Chat**, **Feed**, **Ideas**, **Tasks**, and **Settings**.
- **Slide-in Session Drawer:** Main chat shortcut, searchable side chat history with unread indicators, and bottom compose toolbar.
- **Agent Personalization Modal:** Live preview editor for agent name, role subtitle, 5 emblem icons, and 6 aura theme colors.
- **Autonomous Tasks & Goals:** Recurring schedules are saved in Supabase, can be run manually, and are executed by the `agent-run` Edge Function dispatcher.
- **Settings & Connectors:** Tool connection management for Composio-backed apps such as Gmail, Slack, and Google Calendar.

---

## 📚 Complete Codebase Documentation

For an exhaustive, file-by-file breakdown explaining the architecture, dependencies, data flow, and documented code snippets for every file, see:

👉 [**`docs/CODEBASE_EXPLANATION.md`**](./docs/CODEBASE_EXPLANATION.md)

Useful implementation docs:

- [Scheduled AI Agent Tasks](./docs/scheduled-agent-tasks.md)
- [Composio Tools Setup](./docs/COMPOSIO_TOOLS_SETUP.md)
- [Edge Function: Composio + Browserbase](./supabase/functions/agent-run/README.md)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
# Start Expo Metro bundler
npm run start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in Web browser
npm run web
```

### 3. Type Checking
```bash
npx tsc --noEmit
```

## 🚀 Running in OpenCode Editor

Open the repository root in OpenCode. It reads the project conventions from [`AGENTS.md`](./AGENTS.md); no OpenCode plugin, workspace file, or VS Code task runner is required.

In the integrated terminal, run:

```bash
npm install
npm run opencode:start
```

The command starts the Expo web development server on localhost (port `8081` by default). Open `http://localhost:8081/chat` for the chat route. Expo serves the web app and its development API routes; there is no separate local backend process to launch. Web output uses server mode so the app's API routes are included in production builds. Deploy the server bundle to a host that supports Expo Router server output. If port `8081` is already occupied, Expo will report or select an available port—use the URL printed in the terminal.

The app shell can be previewed without credentials, but integrations cannot be enabled with placeholder values. Copy `.env.example` to `.env` and fill in only the credentials for features you want to use:

- **Google sign-in and Supabase-backed data:** set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the supported legacy `EXPO_PUBLIC_SUPABASE_KEY`); configure Google OAuth in the Supabase project as well.
- **AI chat and schedule intent:** set the server-only `OPENAI_API_KEY`. `OPENAI_AGENT_MODEL` and `OPENAI_SCHEDULE_MODEL` are optional model overrides.
- **Connected app tools:** sign in with Google, set the server-only `COMPOSIO_API_KEY`, and apply the Supabase schema migration so connection records can be saved; see [Composio Tools Setup](./docs/COMPOSIO_TOOLS_SETUP.md). Connect actions are disabled until a user is signed in.
- **Browser automation:** set `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` (and `OPENAI_API_KEY`).
- **Privileged local API operations:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are optional server-only settings. The service-role key bypasses row-level security and must never be exposed to the client.

The app database tables are defined in [`supabase/migrations/20261010162000_musespark_app_schema.sql`](./supabase/migrations/20261010162000_musespark_app_schema.sql). Run this migration in the SQL Editor of the Supabase project configured in `.env` before using tools, chat history, profiles, or scheduled tasks. Creating tables requires database/SQL Editor access; the publishable key cannot apply migrations. The migration seeds the initial Gmail, Slack, and Google Calendar tool catalog. If the `tools` table is missing, the Tools screen displays a bundled read-only catalog and migration instructions; connections remain disabled until the migration is applied.

Scheduled background tasks run in Supabase Edge Functions, not in the editor. Configure their secrets and database schema in Supabase using the [scheduled tasks guide](./docs/scheduled-agent-tasks.md) and [Edge Function setup](./supabase/functions/agent-run/README.md). Never add provider secrets to `EXPO_PUBLIC_` variables.

The app deep-link scheme is now `musespark`. Update the allowed redirect URLs in Supabase Auth/Google OAuth for installed-app sign-in; web sign-in continues to use the current web origin.

PowerShell users can create the local environment file with:

```powershell
Copy-Item .env.example .env
```

The `.vscode/` directory contains optional editor settings and extension recommendations only; it does not contain app startup tasks. VS Code users can use the same `npm run opencode:start` command or the existing `npm run web` command.

Run `npm run lint` and `npx tsc --noEmit` to check the project.

---

## 🛠️ Tech Stack

- **Framework:** [Expo](https://docs.expo.dev/) (SDK 57)
- **Runtime:** React Native 0.86.3 / React 19.2.3
- **Router:** [Expo Router](https://docs.expo.dev/router/introduction/) (File-based in `src/app/`)
- **Icons:** `@hugeicons/react-native` & `@hugeicons/core-free-icons`
- **Vectors:** `react-native-svg`
- **Safe Area:** `react-native-safe-area-context`
