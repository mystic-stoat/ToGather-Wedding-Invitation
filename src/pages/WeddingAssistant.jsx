// src/pages/WeddingAssistant.jsx
// AI Wedding Assistant chat interface.
//
// One continuous conversation between the host and Claude. There are no
// sections or preloaded flows: the only context Claude receives is the chat
// history itself. Voice integration will be connected separately.

import { useState, useEffect, useRef } from "react";
import { Send, Mic } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getInvitationByUser,
  getOrCreateConversation,
  saveMessage,
  loadConversationHistory,
  clearConversationMessages,
} from "@/lib/firestore";
import Sidebar from "@/components/Sidebar";
import { useNavigate } from "react-router-dom";
import ChatBubble from "@/components/ChatBubble";

// ── Claude config ────────────────────────────────────────────────────────────
const CLAUDE_MODEL = "claude-haiku-5-5";
const MAX_HISTORY = 20; // last n messages sent to Claude

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_CONSOLE_API;

// The system prompt is how we give Claude its "job".
const SYSTEM_PROMPT = `You are a warm, concise wedding planning assistant helping a host enter details for their wedding invitation website.
Ask one friendly question at a time to collect what is needed (for example the wedding date, the location, and what time guests should arrive).
Keep replies to 1-3 sentences.`;

// Optional starter prompts. Leave empty for now: nothing renders when empty.
// If you add strings here later, each one shows up as a button that sends
// that text as a normal message, exactly as if the user had typed it.
const STARTER_PROMPTS = [];

const WeddingAssistant = () => {
  const { user, logout } = useAuth();

  const navigate = useNavigate();

  // chat state
  const [conversationId, setConversationId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const bottomRef = useRef(null);

  // page state
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);

  // ── Claude API ─────────────────────────────────────────────────────────────
  const claudeApiGet = async (history) => {
    // current history sliced by N
    let recent = history.slice(-MAX_HISTORY);

    // the API requires the first message to be from the user
    while (recent.length && recent[0].role !== "user") recent = recent.slice(1);

    // send our info to claude, get response
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        // required for calls made directly from a browser
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: recent,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Request failed (${response.status})`);
    }

    // return our data
    const data = await response.json();
    return data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  };

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadData();
    initChat();
  }, [user]);

  // keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, apiLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const inv = await getInvitationByUser(user.uid);
      setInvitation(inv);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // find/create the single conversation and load its saved history
  const initChat = async () => {
    try {
      const convId = await getOrCreateConversation(user.uid);
      setConversationId(convId);
      const history = await loadConversationHistory(user.uid, convId);
      setConversation(history);
    } catch (err) {
      console.error("init chat error", err);
      setError("Couldn't load your chat. Please refresh and try again.");
    }
  };

  // ── Sending ────────────────────────────────────────────────────────────────
  // adds the user message, gets Claude's reply, saves both
  const sendMessage = async (text) => {
    // build from the current array: state only updates on render, so don't read it back
    const next = [...conversation, { role: "user", content: text }];
    setConversation(next);
    setError(null);
    setApiLoading(true);

    // save to Firestore without letting a save failure break the chat
    const persist = (role, content) =>
      saveMessage(user.uid, conversationId, role, content).catch((e) =>
        console.error("save message error:", e)
      );

    await persist("user", text);

    try {
      const reply = await claudeApiGet(next);
      setConversation((current) => [...current, { role: "assistant", content: reply }]);
      persist("assistant", reply);
    } catch (err) {
      console.error("Claude API error", err);
      setError(err.message || "Something went wrong, Please try again.");
    } finally {
      setApiLoading(false);
    }
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();

    // Do nothing if the box is empty, a reply is pending, or the chat isn't loaded yet.
    if (!trimmedMessage || apiLoading || !conversationId) return;

    sendMessage(trimmedMessage);
    setMessage("");
  };

  // wipes the saved messages but keeps the same conversation, so the input stays usable
  const handleClearChat = async () => {
    if (!conversationId) return;
    try {
      await clearConversationMessages(user.uid, conversationId);
      setConversation([]);
      setError(null);
      setMessage("");
    } catch (err) {
      console.error("clear chat error", err);
      setError("Couldn't clear the chat. Please try again.");
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const StatusCard = ({ label, value, isComplete }) => (
    <div className={`rounded-lg p-4 border transition-colors ${isComplete
        ? 'bg-accent border-primary/20 border-l-4 border-l-primary'
        : 'bg-muted/30 border-border/40'
      }`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {isComplete && <span className="text-primary text-lg">✓</span>}
      </div>
      <p className={`text-sm mt-1 font-medium ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
        {value}
      </p>
    </div>
  );

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* sidebar to integrate with the rest of the web app */}
      <Sidebar invitation={invitation} onLogout={handleLogout} />

      {/* Main chat bot and review columns */}
      <main className="flex-1 min-w-0 min-h-0 px-6 lg:px-10 py-8">
        <div className="max-w-6xl mx-auto h-full flex gap-6">
          {/* Conversation section */}
          <div className="flex-1 min-w-0 min-h-0 bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/40 p-8 sm:p-10 flex flex-col">
            {/* Section header */}
            <div className="flex mb-6">
              <h1 className="font-heading-3 text-2xl font-semibold text-foreground">
                Wedding Assistant
              </h1>
              <button
                type="button"
                onClick={handleClearChat}
                className="ml-auto p-2 rounded-lg border-2 hover:bg-muted"
              >
                clear chat
              </button>
            </div>

            {/* chat section */}
            <div className="flex-1 overflow-y-auto min-h-0 mb-6 pr-4 space-y-5">

              {/* Greeting (UI only, not saved to the conversation) */}
              <ChatBubble
                message="Hi! I'm your wedding assistant. Tell me what you'd like help with and we'll get started."
                isUser={false}
              />

              {/* Optional starter prompts: renders nothing while STARTER_PROMPTS is empty */}
              {STARTER_PROMPTS.length > 0 && conversation.length === 0 && (
                <div className="flex flex-wrap gap-3">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      disabled={apiLoading || !conversationId}
                      className="border rounded-full px-4 py-2 hover:bg-muted transition disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Full conversation history (user + Claude) */}
              {conversation.map((msg, index) => (
                <ChatBubble
                  key={index}
                  message={msg.content}
                  isUser={msg.role === "user"}
                />
              ))}

              {/* Loading indicator while waiting on the API */}
              {apiLoading && (
                <ChatBubble message="Thinking…" isUser={false} />
              )}

              {/* Error message */}
              {error && (
                <p className="text-sm text-destructive">⚠️ {error}</p>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Message composer */}
            <div className="flex bg-background items-center gap-2 border rounded-2xl px-4 py-2 flex-shrink-0">

              <input
                type="text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSend();
                }}
                disabled={apiLoading || !conversationId}
                placeholder="Message your wedding assistant..."
                className="flex-1 bg-transparent outline-none py-2"
              />

              {/* Voice button - UI only for now */}
              <button
                type="button"
                className="p-2 rounded-full hover:bg-muted"
                aria-label="Talk to wedding assistant"
              >
                <Mic size={20} />
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={apiLoading || !conversationId}
                className="p-2 rounded-full hover:bg-muted disabled:opacity-50"
                aria-label="Send message"
              >
                <Send size={20} />
              </button>

            </div>

          </div>

          {/*Review Changes Column*/}
          <div className="w-96 shrink-0 self-start max-h-full overflow-y-auto bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/40 p-8 sm:p-10 space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Wedding Details</h2>

            {/* Status cards go here */}
            <StatusCard label="Date" />
            <StatusCard label="Location" />
            <StatusCard label="Time" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default WeddingAssistant;