// src/pages/WeddingAssistant.jsx
// AI Wedding Assistant chat interface.
//
// One continuous conversation between the host and Claude. This page only
// WRITES the user's message and LISTENS for new messages. It never calls the
// Claude API: a Cloud Function (functions/index.js) fires when a user message
// is created, talks to Claude, and writes the reply back as a new message
// document, which the live listener below picks up. Voice integration will be
// connected separately.

import { useState, useEffect, useRef } from "react";
import { Send, Mic } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getInvitationByUser,
  subscribeToMessages,
  sendUserMessage,
  retryUserMessage,
  clearMessages,
  messageText,
} from "@/lib/firestore";
import Sidebar from "@/components/Sidebar";
import { useNavigate } from "react-router-dom";
import ChatBubble from "@/components/ChatBubble";

// Optional starter prompts. Leave empty for now: nothing renders when empty.
// If you add strings here later, each one shows up as a button that sends
// that text as a normal message, exactly as if the user had typed it.
const STARTER_PROMPTS = [];

const WeddingAssistant = () => {
  const { user, logout } = useAuth();

  const navigate = useNavigate();

  // chat state: `messages` is the live copy of betrothed/{uid}/messages
  const [messages, setMessages] = useState([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const bottomRef = useRef(null);

  // page state
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);

  // ── Derived chat state ─────────────────────────────────────────────────────
  // There is no separate "loading" flag for the API call: if the newest user
  // message is still "pending", the Cloud Function hasn't replied yet.
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const replyPending = lastUserMessage?.status === "pending";
  // the function sets status "error" on the user message when it can't reply
  const failedMessage = lastUserMessage?.status === "error" ? lastUserMessage : null;

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadData();

    // live listener: fires with the saved history, then again for every new doc
    const unsubscribe = subscribeToMessages(
      user.uid,
      (docs) => {
        setMessages(docs);
        setChatLoaded(true);
      },
      (err) => {
        console.error("messages listener error", err);
        setError("Couldn't load your chat. Please refresh and try again.");
      }
    );

    // stop listening when the page unmounts or the user changes
    return unsubscribe;
  }, [user]);

  // keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, replyPending]);

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

  // ── Sending ────────────────────────────────────────────────────────────────
  // The write IS the request: no API call here, the Cloud Function takes over.
  const sendMessage = async (text) => {
    setError(null);
    try {
      await sendUserMessage(user.uid, text);
      return true;
    } catch (err) {
      console.error("send message error", err);
      setError("Couldn't send your message. Please try again.");
      return false;
    }
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();

    // Do nothing if the box is empty, a reply is pending, or the chat isn't loaded yet.
    if (!trimmedMessage || replyPending || !chatLoaded) return;

    setMessage("");
    const sent = await sendMessage(trimmedMessage);
    // put the text back so a failed send isn't lost
    if (!sent) setMessage(trimmedMessage);
  };

  // re-sends a message the function failed to answer (see retryUserMessage)
  const handleRetry = async () => {
    if (!failedMessage) return;
    setError(null);
    try {
      await retryUserMessage(user.uid, failedMessage);
    } catch (err) {
      console.error("retry error", err);
      setError("Couldn't retry. Please try again.");
    }
  };

  // wipes every saved message; the listener then empties the screen on its own
  const handleClearChat = async () => {
    try {
      await clearMessages(user.uid);
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
                disabled={replyPending || !chatLoaded}
                className="ml-auto p-2 rounded-lg border-2 hover:bg-muted disabled:opacity-50"
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
              {STARTER_PROMPTS.length > 0 && messages.length === 0 && (
                <div className="flex flex-wrap gap-3">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      disabled={replyPending || !chatLoaded}
                      className="border rounded-full px-4 py-2 hover:bg-muted transition disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Full conversation history (user + Claude), streamed from Firestore */}
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={messageText(msg)}
                  isUser={msg.role === "user"}
                />
              ))}

              {/* Waiting on the Cloud Function: newest user message is still "pending" */}
              {replyPending && (
                <ChatBubble message="Thinking…" isUser={false} />
              )}

              {/* The function couldn't reply: offer a retry */}
              {failedMessage && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-destructive">
                    ⚠️ {failedMessage.errorMessage || "The assistant couldn't reply."}
                  </p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="text-sm border rounded-full px-3 py-1 hover:bg-muted"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Client-side errors (send, load, clear) */}
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
                disabled={replyPending || !chatLoaded}
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
                disabled={replyPending || !chatLoaded}
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
