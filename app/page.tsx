"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUp, ArrowUpRight, Asterisk, Check, Code2, Copy, Feather, Lightbulb, MessageCircle, Plus, RotateCcw, Sparkles, Square, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sidebar, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { readCompletion } from "@/lib/completion-stream";
import { Markdown } from "@/components/markdown";

type Message = { id: string; role: "user" | "assistant"; content: string; interrupted?: boolean };
type Conversation = { id: string; title: string; messages: Message[] };
const prompts = [
  { icon: Lightbulb, label: "Think a little bigger", text: "Dream up a side project", prompt: "Help me dream up an unusual side project I could build in a weekend. Give me three ideas that combine technology with everyday life.", color: "lime" },
  { icon: Feather, label: "Find the right words", text: "Make something worth reading", prompt: "Let's write a tiny story with a big twist. Give me three unexpected opening lines and let me choose one.", color: "peach" },
  { icon: Code2, label: "Build something cool", text: "Turn an idea into code", prompt: "Help me build something playful with JavaScript. Suggest three small interactive experiments, then help me code the one I choose.", color: "lavender" },
];
const surprises = ["What is a strange fact that will change the way I see everyday life?", "Invent a new word for a feeling everyone has but nobody has named.", "If the Moon were a museum, what would its first exhibition be?", "Give me a wonderfully weird creative challenge I can do in ten minutes."];
const fresh = (): Conversation => ({ id: crypto.randomUUID(), title: "New conversation", messages: [] });

function Orbit() {
  return <div className="orbit" aria-hidden="true">
    <div className="orbit-halo" /><div className="orbit-guide guide-one" /><div className="orbit-guide guide-two" />
    <div className="orbit-sculpture">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>
    <span className="orbit-cross cross-one">+</span><span className="orbit-cross cross-two">+</span>
    <span className="orbit-coordinate">LET YOUR MIND WANDER</span>
  </div>;
}

function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [effort, setEffort] = useState("medium");
  const [copied, setCopied] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const { setOpenMobile } = useSidebar();
  const current = conversations.find(c => c.id === currentId);
  const messages = current?.messages ?? [];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("oddly.conversations.v1") ?? "[]");
      if (Array.isArray(saved)) {
        const valid = saved.filter(c => typeof c?.id === "string" && typeof c?.title === "string" && Array.isArray(c.messages) && c.messages.every((m: Message) => typeof m?.id === "string" && ["user", "assistant"].includes(m.role) && typeof m.content === "string")).slice(0, 30);
        setConversations(valid); setCurrentId(valid[0]?.id ?? "");
      }
    } catch { setStorageError(true); }
    setStorageReady(true);
    fetch("/api/status").then(r => r.ok ? r.json() : Promise.reject()).then(data => setConfigured((data as { configured: boolean }).configured)).catch(() => setConfigured(null));
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (!storageReady || busy) return;
    try { localStorage.setItem("oddly.conversations.v1", JSON.stringify(conversations.slice(0, 30))); }
    catch { setStorageError(true); }
  }, [conversations, storageReady, busy]);
  useEffect(() => { if (follow.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [messages, busy, error]);
  useEffect(() => { if (textarea.current) { textarea.current.style.height = "auto"; textarea.current.style.height = Math.min(textarea.current.scrollHeight, 180) + "px"; } }, [input]);

  const updateMessages = (id: string, update: (messages: Message[]) => Message[]) => setConversations(all => all.map(c => c.id === id ? { ...c, messages: update(c.messages) } : c));
  function newChat() {
    if (busy) return;
    setCurrentId(""); setInput(""); setError(""); setOpenMobile(false); textarea.current?.focus();
  }
  async function send(prompt?: string, retry = false) {
    const text = (prompt ?? input).trim();
    if (busy || (!text && !retry)) return;
    let chat = current;
    if (!chat) { chat = fresh(); chat.title = text.slice(0, 50); setConversations(all => [chat!, ...all].slice(0, 30)); setCurrentId(chat.id); }
    const id = chat.id;
    const lastUser = chat.messages.findLastIndex(m => m.role === "user");
    const history: Message[] = retry ? chat.messages.slice(0, lastUser + 1) : [...chat.messages, { id: crypto.randomUUID(), role: "user", content: text }];
    if (!history.length) return;
    const replyId = crypto.randomUUID();
    updateMessages(id, () => [...history, { id: replyId, role: "assistant", content: "" }]);
    setInput(""); setError(""); setBusy(true); follow.current = true;
    const controller = new AbortController(); abort.current = controller;
    let answer = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ messages: history.filter(m => m.content.trim()).map(({ role, content }) => ({ role, content })), effort }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { code?: string; error?: string };
        if (data.code === "MISSING_KEY") { setConfigured(false); setSetupOpen(true); }
        throw new Error(data.error ?? "Something interrupted the connection. Please try again.");
      }
      setConfigured(true);
      for await (const event of readCompletion(response.body!)) {
        if (event.type === "text") { answer += event.text; updateMessages(id, all => all.map(m => m.id === replyId ? { ...m, content: answer } : m)); }
        else if (event.type === "length") setError("This reply reached its length limit. Ask Oddly to continue where it left off.");
      }
      if (!answer.trim()) throw new Error("No answer came through. Try again, or switch to Quick thinking.");
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Connection lost. Please try again.");
      updateMessages(id, all => all.map(m => m.id === replyId ? { ...m, interrupted: true } : m));
    } finally { setBusy(false); abort.current = null; textarea.current?.focus(); }
  }
  async function copy(message: Message) {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); setTimeout(() => setCopied(""), 1800); }
    catch { setError("Could not copy automatically. Select the answer to copy it."); }
  }

  return <>
    <a href="#composer" className="skip-link">Skip to chat</a>
    <Sidebar className="app-sidebar">
      <div className="sidebar-top">
        <button className="brand" onClick={newChat} aria-label="Oddly home" disabled={busy}><Asterisk strokeWidth={2.6} /><span>oddly<span className="brand-period">.</span></span></button>
        <Button onClick={newChat} disabled={busy} className="new-chat"><Plus size={18} /> New conversation <span className="new-chat-plus">↗</span></Button>
      </div>
      <div className="history">
        <div className="section-label">YOUR CONVERSATIONS <span>{String(conversations.length).padStart(2, "0")}</span></div>
        {conversations.length === 0 ? <div className="empty-history"><MessageCircle size={20} /><p>A blank page.<br />So many possibilities.</p><span>Your conversations will live here.</span></div> :
          <nav aria-label="Conversations">{conversations.map(c => <div className={`history-row ${currentId === c.id ? "selected" : ""}`} key={c.id}>
            <button className="history-chat" disabled={busy} onClick={() => { setCurrentId(c.id); setInput(""); setError(""); setOpenMobile(false); follow.current = true; }}><MessageCircle size={15} /><span>{c.title}</span></button>
            <button className="delete-chat" aria-label={`Delete ${c.title}`} title="Delete conversation" disabled={busy} onClick={() => { setConversations(all => all.filter(item => item.id !== c.id)); if (currentId === c.id) newChat(); }}><X size={14} /></button>
          </div>)}</nav>}
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><Asterisk /><p>Leave room for<br /><em>the unexpected.</em></p><span>GOOD THINGS START WITH “WHAT IF”</span></div>
        <div className="local-note"><span className="small-square" /> {storageError ? "History unavailable in this browser" : "Saved in this browser only"}</div>
        <button className="connection" onClick={() => { setSetupOpen(v => !v); setOpenMobile(false); }}><div className="connection-icon"><Zap size={17} /></div><span><strong>Powered by Groq</strong><small>{configured === true ? "API key configured" : configured === false ? "Add your key to connect" : "Connection settings"}</small></span><ArrowUpRight size={16} /></button>
      </div>
    </Sidebar>
    <main className="workspace">
      <header className="topbar"><div className="topbar-left"><SidebarTrigger className="sidebar-toggle" /><span className="workspace-label">YOUR LITTLE CORNER OF THE COSMOS</span><span className="mobile-brand">oddly.</span></div><div className="model-label"><span className="model-glyph">✳</span> GPT-OSS <strong>120B</strong><span className="model-divider" /><span className="model-caption">OPEN MIND. OPEN MODEL.</span></div></header>
      <div className={`chat-stage ${messages.length ? "has-messages" : ""}`}>
        {messages.length === 0 ? <div className="welcome">
          <div className="welcome-hero"><div className="hero-copy"><div className="eyebrow"><span /> A SPACE FOR YOUR NEXT BIG LITTLE IDEA</div><h1>Stay curious.<br />Get <em>oddly</em> inspired<span className="headline-dot">.</span></h1><p>Big questions. Half-baked ideas. Beautiful rabbit holes.<br className="desktop-break" /> Bring your mind. Let’s see where it goes.</p></div><Orbit /></div>
          <div className="starter-heading"><span>A LITTLE SPARK TO GET YOU GOING</span><span>01 — 03</span></div>
          <div className="prompt-grid">{prompts.map(({ icon: Icon, ...p }) => <button className={`prompt-card ${p.color}`} key={p.label} onClick={() => { setInput(p.prompt); textarea.current?.focus(); }}><div className="prompt-top"><Icon size={21} strokeWidth={1.5} /><ArrowUpRight size={16} /></div><span>{p.label}</span><p>{p.text}</p></button>)}</div>
        </div> : <div className="message-scroll" ref={scroller} onScroll={() => { const el = scroller.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}><div className="message-list">
          <div className="conversation-start"><span /> A NEW LINE OF THOUGHT <span /></div>
          {messages.map((message, index) => <article className={`message message-${message.role}`} key={message.id}>
            <div className="message-avatar">{message.role === "assistant" ? <Asterisk size={23} /> : "Y"}</div>
            <div className="message-body"><div className="message-heading">{message.role === "assistant" ? "oddly" : "You"}{message.role === "assistant" && <span>GPT-OSS 120B</span>}</div>
              {message.content ? <div className={`message-content ${busy && index === messages.length - 1 ? "streaming" : ""}`}>{message.role === "assistant" ? <Markdown content={message.content} /> : <p className="user-content">{message.content}</p>}</div> : busy ? <div className="thinking"><span /><span /><span /><em>A thought is taking shape</em></div> : <p className="interrupted">{message.interrupted ? "Reply interrupted. Ready when you are." : "No reply yet."}</p>}
              {message.interrupted && message.content && <p className="interrupted">Reply interrupted</p>}
              {message.role === "assistant" && message.content && !busy && <div className="message-actions"><Button variant="ghost" size="sm" onClick={() => copy(message)} aria-label="Copy answer">{copied === message.id ? <Check /> : <Copy />}{copied === message.id ? "Copied" : "Copy"}</Button>{index === messages.length - 1 && <Button variant="ghost" size="sm" onClick={() => send(undefined, true)}><RotateCcw /> Try again</Button>}</div>}
            </div>
          </article>)}
          <div className="sr-only" role="status" aria-live="polite">{busy ? "Oddly is responding." : messages.at(-1)?.role === "assistant" ? "Response finished." : ""}</div>
        </div></div>}
        <div className="composer-region">
          {setupOpen && <div className="setup-note"><div><strong>Your next conversation is one key away.</strong><p>Add <code>GROQ_API_KEY</code> to <code>.env</code> locally, or to your Vercel environment variables. Then restart or redeploy.</p><a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get a Groq API key <ArrowUpRight size={13} /></a></div><Button size="icon-sm" variant="ghost" aria-label="Close connection instructions" onClick={() => setSetupOpen(false)}><X /></Button></div>}
          {error && <div className="error-note" role="alert"><p>{error}</p><div>{messages.length > 0 && !busy && <Button size="sm" variant="ghost" onClick={() => send(undefined, true)}><RotateCcw /> Retry</Button>}<Button variant="ghost" size="icon-sm" onClick={() => setError("")} aria-label="Dismiss error"><X /></Button></div></div>}
          <form className={`composer ${busy ? "composer-busy" : ""}`} onSubmit={e => { e.preventDefault(); send(); }}>
            <label htmlFor="composer" className="sr-only">Message Oddly</label>
            <Textarea ref={textarea} id="composer" value={input} onChange={e => setInput(e.target.value)} placeholder={messages.length ? "Follow that thought…" : "What’s on your wonderfully weird mind?"} maxLength={24000} rows={2} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
            <div className="composer-toolbar"><div className="composer-tools"><Sparkles size={15} /><NativeSelect className="effort-select" aria-label="Thinking effort" value={effort} disabled={busy} onChange={e => setEffort(e.target.value)}><NativeSelectOption value="low">Quick thinking</NativeSelectOption><NativeSelectOption value="medium">Balanced thinking</NativeSelectOption><NativeSelectOption value="high">Deep thinking</NativeSelectOption></NativeSelect></div><div className="composer-send"><span className="enter-hint">{busy ? "FOLLOWING THE THREAD" : "ENTER TO SEND"}</span><Tooltip><TooltipTrigger asChild>{busy ? <Button className="send-button stop-button" type="button" onClick={() => abort.current?.abort()} aria-label="Stop generating"><Square size={17} fill="currentColor" /></Button> : <Button className="send-button" type="submit" disabled={!input.trim()} aria-label="Send message"><ArrowUp size={21} /></Button>}</TooltipTrigger><TooltipContent>{busy ? "Stop generating" : "Send message"}</TooltipContent></Tooltip></div></div>
          </form>
          <div className="composer-footer"><span>A little artificial. A lot of possibility.</span><span>AI can make mistakes. Stay curious.</span></div>
          {messages.length === 0 && <button className="surprise-button" onClick={() => { setInput(surprises[Math.floor(Math.random() * surprises.length)]); textarea.current?.focus(); }}><span>Or, take the scenic route.</span> Surprise me <span className="surprise-star">✳</span></button>}
        </div>
      </div>
      <footer className="workspace-footer"><span>ODDLY / A GOOD PLACE TO WONDER</span><span>MADE FOR THE WANDERING MIND <Asterisk size={14} /></span></footer>
    </main>
  </>;
}
export default function Home() { return <SidebarProvider style={{ "--sidebar-width": "244px" } as CSSProperties}><ChatApp /></SidebarProvider>; }
