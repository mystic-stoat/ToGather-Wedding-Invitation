import React from "react";

const ChatBubble = ({ message, isUser = false }) => {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-lg rounded-2xl px-5 py-4 ${
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md bg-muted'
        }`}
      >
        <p>{message}</p>
      </div>
    </div>
  );
};

export default ChatBubble;