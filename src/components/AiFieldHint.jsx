// src/components/AiFieldHint.jsx
// A small sparkle next to a field the Wedding Assistant can change. Hovering
// (or focusing) it opens a bubble that points the couple to the assistant.
// A hover card rather than a tooltip, so the link inside can be clicked.

import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

const AiFieldHint = ({ className = "" }) => (
  <HoverCard openDelay={100} closeDelay={150}>
    <HoverCardTrigger asChild>
      <button
        type="button"
        aria-label="The Wedding Assistant can change this"
        className={`inline-flex items-center align-middle text-primary hover:opacity-80 ${className}`}
      >
        <Sparkles size={14} aria-hidden="true" />
      </button>
    </HoverCardTrigger>
    <HoverCardContent className="w-60 text-xs normal-case tracking-normal font-normal">
      <p className="text-foreground">The Wedding Assistant can fill this in or change it for you.</p>
      <Link to="/wedding-assistant" className="mt-2 inline-block font-semibold text-primary underline">
        Ask the Wedding Assistant
      </Link>
    </HoverCardContent>
  </HoverCard>
);

export default AiFieldHint;
