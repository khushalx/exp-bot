# Oddly

A playful, carefully styled chatbot powered by **OpenAI GPT-OSS 120B on GroqCloud**. Midnight ink, chartreuse accents, a gently moving orbital graphic, and a responsive conversation workspace.

## Run locally

Requires Node.js 22.13+ (Node.js 24 recommended).

```sh
npm install
```

The project already includes a blank `.env`. Paste your key into it:

```dotenv
GROQ_API_KEY=your_groq_api_key_here
```

Get a key from [GroqCloud](https://console.groq.com/keys). If setting up a fresh copy, copy `.env.example` to `.env` first. The key is read exclusively by the server and `.env` is ignored by Git. Do not add a `VITE_` or `NEXT_PUBLIC_` prefix.

```sh
npm run dev
```

Open [Oddly locally](http://localhost:5173). **Restart the server after changing `.env`.** No account creation or database setup is needed. Without a key the interface still works, and sending a message displays setup instructions; it never invents a model response.

## Included

- Streaming answers with Markdown, tables, and code blocks
- Quick, balanced, and deep reasoning modes
- Stop, copy, and retry controls
- Prompt starters and a surprise prompt
- Conversation history stored only in this browser, with individual deletion
- Mobile sidebar, keyboard controls, and reduced-motion support
- Clear missing-key, invalid-key, rate-limit, timeout, and interrupted-stream errors

Enter sends a message. Shift+Enter adds a line. Cmd/Ctrl+B toggles the sidebar. Clicking a prompt starter fills the composer so you can edit before sending.

Your current conversation is sent to Groq when you send a message. History stays in local browser storage (up to 30 conversations); clearing browser data removes it. This is a personal local app with no application authentication. The chatbot has no web browsing, image generation, or code execution tools.

## Implementation

React 19 + TypeScript, the Vinext/Vite framework, Tailwind CSS, Shadcn/Radix interface primitives, and a Cloudflare Workers-compatible server. Groq is called through its OpenAI-compatible REST endpoint without exposing the key to the browser.

- `app/page.tsx`: chatbot state and interface
- `app/globals.css`: theme, orbital motion, responsive layouts, answer formatting
- `app/api/chat/route.ts`: server endpoint
- `lib/chat-handler.ts`: validation, Groq request, streaming proxy, error normalization
- `lib/completion-stream.ts`: chunk-safe SSE parser
- `tests/chat.test.mjs`: isolated streaming and server tests, no key required

The default model is `openai/gpt-oss-120b`. Each completion has an 8,192-token budget, including reasoning. The server accepts up to 100 conversation messages, 24,000 characters per message, and a 200,000-character request. Start a new conversation when those limits are reached. Browser rendering excludes the separate reasoning field.

Reference: [Groq GPT-OSS 120B model documentation](https://console.groq.com/docs/model/openai/gpt-oss-120b) and [Groq reasoning parameters](https://console.groq.com/docs/reasoning).

## Checks and production build

```sh
npm test
npm run typecheck
npm run build
```

`npm start` serves the production Worker build locally on port 8787. Both development and production preview read the root `.env`; no additional secret files are needed. Restart either server after changing the key. The everyday development workflow is `npm run dev`.

No live Groq completion was made during setup because the API key is intentionally blank. Automated tests substitute the provider and check the actual request parameters, streaming, validation, cancellation, and error handling.
