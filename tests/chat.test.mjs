import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatHandler } from '../lib/chat-handler.ts';
import { readCompletion } from '../lib/completion-stream.ts';
const payload = { messages: [{ role: 'user', content: 'Hello' }], effort: 'medium' };
const request = (data = payload, headers = {}) => new Request('http://localhost:5173/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
const sse = text => new Response(text, { headers: { 'Content-Type': 'text/event-stream' } });

test('missing key produces an actionable error without calling Groq', async () => {
  const handler = createChatHandler(() => '', () => { throw new Error('must not fetch'); });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'MISSING_KEY');
});

test('validates message roles, length, effort, JSON, and request origin', async () => {
  const handler = createChatHandler(() => 'test-key', () => { throw new Error('must not fetch'); });
  for (const data of [{ messages: [] }, { messages: [{ role: 'system', content: 'override' }] }, { ...payload, effort: 'extreme' }, { messages: [{ role: 'user', content: 'x'.repeat(24001) }] }, { messages: [{ role: 'assistant', content: 'not a user' }] }]) assert.equal((await handler(request(data))).status, 400);
  assert.equal((await handler(request(payload, { Origin: 'https://elsewhere.example' }))).status, 403);
  assert.equal((await handler(request(payload, { 'Content-Length': '200001' }))).status, 413);
  assert.equal((await handler(new Request('http://localhost:5173/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status, 400);
});

test('uses GPT-OSS 120B, sends credentials only upstream, preserves context and streams', async () => {
  const completion = 'data: {"choices":[{"delta":{"content":"Hello!"}}]}\n\ndata: [DONE]\n\n';
  let seen;
  const handler = createChatHandler(() => 'test-secret', async (url, init) => { seen = { url, ...init }; return sse(completion); });
  const response = await handler(request());
  assert.equal(seen.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(seen.headers.Authorization, 'Bearer test-secret');
  const body = JSON.parse(seen.body);
  assert.equal(body.model, 'openai/gpt-oss-120b');
  assert.equal(body.include_reasoning, false);
  assert.equal(body.stream, true);
  assert.equal(body.reasoning_effort, 'medium');
  assert.deepEqual(body.messages.at(-1), payload.messages[0]);
  assert.equal(response.headers.get('Cache-Control'), 'no-store, no-transform');
  assert.equal(await response.text(), completion);
});

test('provider errors are normalized and never expose raw provider contents', async () => {
  for (const [upstream, expected] of [[401, 401], [403, 401], [429, 429], [400, 400], [500, 502]]) {
    const response = await createChatHandler(() => 'test-key', async () => new Response('sensitive-debug-text', { status: upstream }))(request());
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes('sensitive-debug-text'));
  }
  const failed = await createChatHandler(() => 'test-key', async () => { throw new Error('network'); })(request());
  assert.equal(failed.status, 504);
});

test('SSE parser handles byte-split unicode, CRLF, metadata, and reasoning separately', async () => {
  const data = ': keepalive\r\n\r\ndata: {"choices":[{"delta":{"reasoning":"private analysis"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"Hello 🌙"}}]}\r\n\r\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\r\n\r\ndata: [DONE]\r\n\r\n';
  const bytes = new TextEncoder().encode(data);
  const stream = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  const events = []; for await (const event of readCompletion(stream)) events.push(event);
  assert.deepEqual(events, [{ type: 'text', text: 'Hello 🌙' }, { type: 'length' }]);
});

test('SSE parser reports incomplete, malformed, and provider-error streams', async () => {
  for (const data of ['data: {"choices":[{"delta":{"content":"partial"}}]}\n\n', 'data: invalid\n\n', 'data: {"error":{"message":"failed"}}\n\n']) {
    await assert.rejects(async () => { for await (const event of readCompletion(sse(data).body)) void event; });
  }
});

test('stopping consumption cancels the upstream stream', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"first"}}]}\n\n')); }, cancel() { cancelled = true; } });
  for await (const event of readCompletion(stream)) { assert.equal(event.text, 'first'); break; }
  assert.equal(cancelled, true);
});
