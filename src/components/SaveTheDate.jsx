// src/components/SaveTheDate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS COMPONENT DOES:
//   The "Save the Date" / "Add to Calendar" action: lets a host or a wedding
//   guest put the wedding date into their own calendar app.
//
//   Two options, always deliberate user actions — nothing is added
//   automatically:
//     - "Google Calendar"        opens a prefilled event in a new tab where
//                                  the guest confirms inside their account
//     - "Download Calendar Event (.ics)"  downloads an RFC 5545 file that
//                                  imports into Apple Calendar, Outlook, etc.
//
//   Event details come from src/lib/saveTheDate.js (all-day event; the
//   ceremony time travels in the description as local venue time).
//
//   variant="app"        — Dashboard / host pages: the existing dropdown-menu
//                          design-system styling. Renders a disabled button
//                          when no valid wedding date exists.
//   variant="invitation" — the guest-facing invitation website: same actions,
//                          expanded inline and colored by the invitation's
//                          Color Theme so it looks like part of the design.
//                          Renders nothing without a valid wedding date.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { CalendarCheck, Calendar, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildCalendarEvent, downloadIcs, googleCalendarUrl } from "@/lib/saveTheDate";

const SaveTheDate = ({
  invitation,
  variant = "app",
  theme,              // resolved invitation theme — required for variant="invitation"
  buttonLabel,        // trigger text — defaults per variant
  triggerClassName,   // extra classes for the app-variant trigger
  triggerStyle,       // extra inline style for the invitation-variant trigger
}) => {
  const event = buildCalendarEvent(invitation);
  const googleUrl = event ? googleCalendarUrl(event) : null;

  // ── App variant — dropdown menu (Dashboard) ────────────────────────────────
  if (variant === "app") {
    const label = buttonLabel || "Save the Date";
    if (!event) {
      // No valid wedding date: keep the row visible but inert, and say why.
      return (
        <button type="button" disabled
          title="Add your wedding date in Wedding Details first"
          className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm text-muted-foreground/60 text-left cursor-not-allowed ${triggerClassName || ""}`}>
          <CalendarCheck size={14} /> {label}
        </button>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={label}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors text-sm text-foreground text-left ${triggerClassName || ""}`}>
            <CalendarCheck size={14} className="text-muted-foreground" /> {label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem asChild>
            <a href={googleUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 cursor-pointer">
              <Calendar size={14} /> Google Calendar
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => downloadIcs(event)} className="cursor-pointer">
            <Download size={14} className="mr-2" /> Download Calendar Event (.ics)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ── Invitation variant — inline expander styled by the Color Theme ─────────
  return (
    <InvitationSaveTheDate event={event} googleUrl={googleUrl} theme={theme}
      buttonLabel={buttonLabel} triggerStyle={triggerStyle} />
  );
};

// Kept separate so the expander's open state lives next to its markup.
const InvitationSaveTheDate = ({ event, googleUrl, theme, buttonLabel, triggerStyle }) => {
  const [open, setOpen] = useState(false);
  if (!event || !theme) return null;

  const btnStyle = { backgroundColor: theme.button, color: theme.buttonLabel };
  const optionStyle = {
    border: `1px solid ${theme.accent}`,
    color: theme.headingText,
    backgroundColor: theme.background,
  };

  return (
    <div className="mt-3">
      <button type="button" className="tg-inv-button" style={{ ...btnStyle, ...triggerStyle }}
        aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {buttonLabel || "Add to Calendar"}
      </button>

      {open && (
        <div className="tg-inv-save-the-date mt-3 flex flex-col sm:flex-row gap-2 justify-center"
          data-testid="save-the-date-options">
          <a href={googleUrl} target="_blank" rel="noopener noreferrer"
            className="tg-inv-body rounded-full px-4 py-2 inline-flex items-center justify-center gap-2"
            style={optionStyle}>
            <Calendar size={14} aria-hidden="true" /> Google Calendar
          </a>
          <button type="button" onClick={() => downloadIcs(event)}
            className="tg-inv-body rounded-full px-4 py-2 inline-flex items-center justify-center gap-2"
            style={optionStyle}>
            <Download size={14} aria-hidden="true" /> Download Calendar Event (.ics)
          </button>
        </div>
      )}
    </div>
  );
};

export default SaveTheDate;
