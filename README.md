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

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Shadcn/Radix interface primitives, and Node.js API routes. Groq is called through its OpenAI-compatible REST endpoint without exposing the key to the browser. The standard Next.js build supports Vercel; the original Vinext/Cloudflare starter tooling is no longer used by the application scripts.

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

`npm start` serves the production Next.js build locally on port 5173. Stop the development server first because both use the same port. Both commands read the root `.env`; no additional secret files are needed. Restart either server after changing the key.

## Deploy to Vercel

1. Push these changes to the repository connected to Vercel.
2. Use the repository directory containing this `package.json` as the project's Root Directory. The checked-in `vercel.json` selects **Next.js**, `npm ci`, `npm run build`, and `.next` output.
3. In Vercel Project Settings → Environment Variables, add `GROQ_API_KEY` for Production (and Preview if you use preview deployments). A local `.env` is ignored by Git and is not automatically sent to Vercel. Never prefix this secret with `NEXT_PUBLIC_`.
4. Deploy the new commit. If retrying a previous failure, use the updated commit and disable the existing build cache for that deployment.

The previous build command used Vinext, which emitted `dist/` rather than Next.js's `.next/routes-manifest.json`. Changing only the output folder could not make the Cloudflare server compatible with Vercel. The application now uses `next build` and reads its key from `process.env` in Node.js routes. The chat function allows up to 120 seconds for a streaming reply.



No live Groq completion was made during setup because the API key is intentionally blank. Automated tests substitute the provider and check the actual request parameters, streaming, validation, cancellation, and error handling.
