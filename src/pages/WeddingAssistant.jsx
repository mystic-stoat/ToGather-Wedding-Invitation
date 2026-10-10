// src/pages/WeddingAssistant.jsx
// AI Wedding Assistant chat interface.
//
// Provides a conversational interface for helping hosts enter and update
// wedding information. LLM, Firestore, and voice integration will be
// connected separately after the interface and conversation flow are reviewed.

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

// Claude Config
const CLAUDE_MODEL = "claude-haiku-5-5"
const MAX_HISTORY = 20; // last n messages

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_CONSOLE_API;


const weddingQuestions = [
  "when the wedding is (date)",
  "where the celebration will be (location)",
  "what time guets should arrive"
];

// The system prompt is how we give Claude its "job" and the section context.
const buildSystemPrompt = (section) =>
  `You are a warm, concise wedding planning assistant helping a host enter details for their wedding invitation website.
${section ? `The host chose to work on: "${section}".` : ""}
${
  section === "Wedding Details"
    ? `Collect these, one question at a time, in order: ${weddingQuestions.join("; ")}. When you have all three, briefly confirm them back.`
    : "Ask one friendly question at a time to collect what is needed for this section."
}
Keep replies to 1-3 sentences.`;



const WeddingAssistant = () => {
  const { user, userProfile, logout } = useAuth();

  const navigate = useNavigate();

  // chat vars
  const [conversationId, setConversationId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [error, setError] = useState(null)
  const bottomRef = useRef(null);

  const [loading, setLoading]  = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [message, setMessage] = useState("");
  const [selectedSection, setSelectedSection] = useState(null);
  const [weddingStep, setWeddingStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const weddingQuestions = [
    "Wonderful! 💍 First things first — when are you two planning to tie the knot?",
    "Perfect! Where will the celebration be taking place?",
    "Lovely! What time should everyone arrive?",
  ];


  const claudeApiGet = async (history, section) => {
    // current history sliced by N
    let recent = history.slice(-MAX_HISTORY);

    // require first message from user
    while (recent.length && recent[0].role !== "user") recent = recent.slice(1);

    // send our info to claude get response
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
        system: buildSystemPrompt(section),
        messages: recent,
      }),
    });
    if(!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Request failed (${response.status})`);
    }

    // return our data 
    const data = await response.json();
    return data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
  }

  // useEffect load invitation data on mount
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: "smooth"});
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

  // adds user message, go to claude, get claude response
  const sendMessage = async(text, section = selectedSection, convId = conversationId) => {
    // load our new data in, conversation only updates on render tho, so don't use that
    const next = [...conversation, {role: "user", content: text}];
    setConversation(next);
    setError(null);
    setApiLoading(true);
    
    // hit dat persist
    const persist = (role, content) =>
      saveMessage(user.uid, convId, role, content, section).catch((e) =>
        console.error("save message error:", e)
      );

    await persist("user", text);
  
    try {
      const reply = await claudeApiGet(next, section);
      setConversation((current) => [...current, { role: "assistant", content: reply }]);
      persist("assistant", reply);
    } catch (err) {
      console.error("Claude API error", err);
      setError(err.message || "Something went wrong, Please try again.");
    } finally {
      setApiLoading(false);
    }
  }

    // Handles the user's answer and advances to the next wedding question.
  const handleSend = () => {
    const trimmedMessage = message.trim();

    // Do nothing if the message box is empty.
    if (!trimmedMessage || apiLoading || !conversationId) return;

    sendMessage(trimmedMessage, selectedSection, conversationId);
    // Clear the input after sending.
    setMessage("");
  };

  // starts the wedding plan conversation, loading history if it exists
  const startSection = async (section) => {
    setSelectedSection(section);
    setError(null);
    try {
      const convId = await getOrCreateConversation(user.uid, section);
      setConversationId(convId);
      // grab out history
      const history = await loadConversationHistory(user.uid, convId);
      if (history.length > 0) {
        setConversation(history);
      } else {
        setConversation([]); // set it to mty
        await sendMessage(section,section,convId); // start it out
      }
    } catch (err) {
      console.error("start section error", err);
      setError("Couldn't load this chat. Please try again.");
    }
  };

  const handleClearChat = () => {
    try {
      if (conversationId) {
        clearConversationMessages(user.uid, conversationId);
      }
    } catch (err) {
      console.error("clear chat error", err);
    }
    setConversation([]);
    setSelectedSection(null);
    setConversationId(null);
    setError(null);
    setMessage("");
  };


  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  }

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
 
              {/* Opening assistant message */}
              <ChatBubble message="Let's begin planning! What would you like to work on?" isUser={false} />
 
              {/* Show section choices until the user selects one */}
              {!selectedSection && (
                <div className="flex flex-wrap gap-3">
                  {["Wedding Details", "Guest List", "Invitations", "Gift Registry"].map((section) => (
                    <button
                      key={section}
                      onClick={() => startSection(section)}
                      className="border rounded-full px-4 py-2 hover:bg-muted transition"
                    >
                      {section}
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
                placeholder={conversationId ? "Message your wedding assistant..." : "Pick a section above to begin"}
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
