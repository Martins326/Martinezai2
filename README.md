# Martins AI

Martins AI is a full-stack AI assistant and personal workspace built with React, TypeScript, Vite, and Express. It includes streamed Gemini chat, research grounding, account registration/login, account-scoped cloud snapshots, projects, saved memories, an artifact editor, voice input/output, an image library, Unsplash photo search, and NVIDIA-backed AI image generation/editing.

## Requirements

- Node.js 22 LTS is recommended (Vite 8 requires a modern Node.js release).
- npm.
- A Google Gemini API key for AI chat.
- Optional provider keys for AI image generation and Unsplash photo search.

## First-time setup

1. Install dependencies:

   ```bash
   npm ci





   ## Simulation Studio
   ```

The Simulation Studio is available from the sidebar. It includes four modes:

- AI Think
- Simulation Lab
- Agent Arena
- World Builder

Simulation requests are sent to the authenticated
`POST /api/simulation/run` endpoint, which uses the configured
Gemini model to generate structured scenario analysis.

### Configuration

- Configure `GEMINI_API_KEY` in the server environment.
- Never place provider API keys in frontend code.
- Simulation requests have an initial limit of 8 requests per account
  and 24 per IP per 10-minute window.
- Results are AI-generated scenario analysis, not verified predictions.
- Agent Arena currently generates specialist perspectives in one model
  response; it does not yet run independent parallel agents.
- Persistent, account-specific simulation history and independent
  multi-agent orchestration are planned future improvements.


# Martins AI

Martins AI is a full-stack AI assistant and personal workspace
built with React, TypeScript, Vite, and Express. It includes
streamed Gemini chat, account registration and login,
account-scoped storage, projects, saved memories, an artifact
editor, voice input/output, an image library, and AI image
generation/editing.

## Requirements

- Node.js 22 LTS or another version supported by Vite 8.
- npm.
- A Google Gemini API key for AI chat and Simulation Studio.
- Optional provider keys for image generation and photo search.

## First-time setup

1. Install dependencies:

   ```bash
   npm ci




   ## Plugin Studio

Plugin Studio provides a built-in tool runtime, not a third-party plugin marketplace.

Open **Plugins** in the app to enable tools for normal chats or test them in the playground.

### Available plugins

- **Calculation helper:** Evaluates mathematical expressions on the server using a dedicated expression parser.
- **Code reviewer:** Reviews code for bugs, security issues, edge cases, and maintainability.
- **Writing editor:** Improves text while preserving its intended meaning.
- **Document assistant:** Summarizes supplied text and identifies key points and action items.
- **Research assistant:** Uses Google Search grounding when available.
- **Web grounding:** Uses search grounding for current-information requests.

### Plugin runtime

The runtime is available at:

`POST /api/plugins/run`

The endpoint requires an authenticated user and applies rate limits. It validates plugin IDs and input length.

The calculator executes without an AI request. AI-backed plugins require a valid `GEMINI_API_KEY` configured in the server environment.

Never expose provider API keys in frontend code.

### Playground

The playground lets users run a plugin, inspect the result, view search sources when returned, and continue the task in normal chat.

Running a plugin in the playground does not itself add a message to chat history.

### Calculator tests

Run the calculator unit tests with:

`npm test`