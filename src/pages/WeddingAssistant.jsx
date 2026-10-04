// src/pages/WeddingAssistant.jsx
// AI Wedding Assistant chat interface.
//
// Provides a conversational interface for helping hosts enter and update
// wedding information. LLM, Firestore, and voice integration will be
// connected separately after the interface and conversation flow are reviewed.

import { useState, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInvitationByUser } from "@/lib/firestore";
import Sidebar from "@/components/Sidebar";
import { useNavigate } from "react-router-dom";


const WeddingAssistant = () => {
  const { user, userProfile, logout } = useAuth();

  const navigate = useNavigate();

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

  // useEffect load invitation data on mount
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

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
  }
    // Handles the user's answer and advances to the next wedding question.
  const handleSend = () => {
    const trimmedMessage = message.trim();

    // Do nothing if the message box is empty.
    if (!trimmedMessage) return;

    // For now, only Wedding Details uses the guided question flow.
    if (selectedSection === "Wedding Details") {
      setAnswers((currentAnswers) => [
        ...currentAnswers,
        trimmedMessage,
      ]);

      setWeddingStep((currentStep) => currentStep + 1);
    }

    // Clear the input after sending.
    setMessage("");
  };
  // Starts one of the guided wedding-planning sections.
  const startSection = (section) => {
    setSelectedSection(section);
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
        <div className="max-w-6xl mx-auto h-full flex gap-6"> {/* <== centering wrapper */}
          {/* Conversation section */}
            <div className="flex-1 min-w-0 min-h-0 bg-card rounded-2xl shadow-xl shadow-foreground/5 border border-border/40 p-8 sm:p-10 flex flex-col">
              {/* Section header */}
              <div className="flex mb-6">
                <h1 className="font-heading-3 text-2xl font-semibold text-foreground">
                  Wedding Assistant
                </h1>
                <button className="ml-auto p-2 rounded-lg border-2 hover:bg-muted"> clear chat </button>
              </div>
              {/* chat section */}
              <div className="flex-1 overflow-y-auto min-h-0 mb-6 pr-4 space-y-5">

                {/* Opening assistant message */}
                <div className="flex justify-start">
                  <div className="max-w-lg rounded-2xl rounded-bl-md bg-muted px-5 py-4">
                    <p>
                      Let's begin planning! What would you like to work on?
                    </p>
                  </div>
                </div>

                {/* Show section choices until the user selects one */}
                {!selectedSection && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => startSection("Wedding Details")}
                      className="border rounded-full px-4 py-2 hover:bg-muted transition"
                    >
                      Wedding Details
                    </button>

                    <button
                      onClick={() => startSection("Guest List")}
                      className="border rounded-full px-4 py-2 hover:bg-muted transition"
                    >
                      Guest List
                    </button>

                    <button
                      onClick={() => startSection("Invitations")}
                      className="border rounded-full px-4 py-2 hover:bg-muted transition"
                    >
                      Invitations
                    </button>

                    <button
                      onClick={() => startSection("Gift Registry")}
                      className="border rounded-full px-4 py-2 hover:bg-muted transition"
                    >
                      Gift Registry
                    </button>
                  </div>
                )}

                {/* User's selected section */}
                {selectedSection && (
                  <div className="flex justify-end">
                    <div className="max-w-lg rounded-2xl rounded-br-md bg-primary text-primary-foreground px-5 py-4">
                      <p>{selectedSection}</p>
                    </div>
                  </div>
                )}

                {/* Wedding Details conversation history */}
                {selectedSection === "Wedding Details" && (
                  <>
                    {answers.map((answer, index) => (
                      <div key={index} className="flex flex-col gap-5">

                        {/* Assistant question */}
                        <div className="flex justify-start">
                          <div className="max-w-lg rounded-2xl rounded-bl-md bg-muted px-5 py-4">
                            <p>{weddingQuestions[index]}</p>
                          </div>
                        </div>

                        {/* User answer */}
                        <div className="flex justify-end">
                          <div className="max-w-lg rounded-2xl rounded-br-md bg-primary text-primary-foreground px-5 py-4">
                            <p>{answer}</p>
                          </div>
                        </div>

                      </div>
                    ))}

                    {/* Current unanswered question */}
                    {weddingStep < weddingQuestions.length && (
                      <div className="flex justify-start">
                        <div className="max-w-lg rounded-2xl rounded-bl-md bg-muted px-5 py-4">
                          <p>{weddingQuestions[weddingStep]}</p>
                        </div>
                      </div>
                    )}

                    {/* Wedding Details section completed */}
                    {weddingStep >= weddingQuestions.length && (
                      <div className="flex justify-start">
                        <div className="max-w-lg rounded-2xl rounded-bl-md bg-muted px-5 py-4">
                          <p>
                            Perfect! I've got the basic details for your wedding.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* Message composer */}
              <div className="flex bg-background items-center gap-2 border rounded-2xl px-4 py-2 flex-shrink-0">

                <input
                  type="text"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
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
                  className="p-2 rounded-full hover:bg-muted"
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