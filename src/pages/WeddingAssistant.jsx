// src/pages/WeddingAssistant.jsx
// AI Wedding Assistant chat interface.
//
// Provides a conversational interface for helping hosts enter and update
// wedding information. LLM, Firestore, and voice integration will be
// connected separately after the interface and conversation flow are reviewed.

import { useState } from "react";
import { Send, Mic } from "lucide-react";

const WeddingAssistant = () => {
  const [message, setMessage] = useState("");
  const [selectedSection, setSelectedSection] = useState(null);
  const [weddingStep, setWeddingStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const weddingQuestions = [
    "Wonderful! 💍 First things first — when are you two planning to tie the knot?",
    "Perfect! Where will the celebration be taking place?",
    "Lovely! What time should everyone arrive?",
  ];
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

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Page header */}
      <header className="border-b bg-background">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold">Wedding Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Let's plan your big day together.
          </p>
        </div>
      </header>

      {/* Conversation */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-5">

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
      </main>

      {/* Message composer */}
      <footer className="border-t bg-background">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 border rounded-2xl px-4 py-2">

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
      </footer>

    </div>
  );
};

export default WeddingAssistant;