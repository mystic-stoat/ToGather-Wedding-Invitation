// src/components/MobileNav.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Mobile / tablet navigation shared by every host page that uses <Sidebar />.
//
// Below the lg breakpoint (<1024px) the desktop sidebar is hidden, so this
// renders a top bar with a menu button. The button opens the SAME Sidebar
// component (variant="drawer") in a slide-out drawer built on the project's
// Radix Sheet, which provides focus trapping, Escape to close, closing on
// overlay click, and returning focus to the menu button.
//
// Usage: place it as the first child of the page's <main>:
//   <MobileNav invitation={invitation} onLogout={handleLogout} />
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Menu, LogOut } from "lucide-react";
import Logo from "@/assets/logo.svg";
import Sidebar from "@/components/Sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Matches Tailwind's `lg` breakpoint, where the desktop sidebar takes over.
const DESKTOP_QUERY = "(min-width: 1024px)";

const MobileNav = ({ invitation, onLogout }) => {
  const [open, setOpen] = useState(false);

  // If the window grows to desktop width while the drawer is open, close it —
  // the persistent sidebar is visible at that size.
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => { if (e.matches) setOpen(false); };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 bg-card border-b border-border px-3 sm:px-6 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <SheetTrigger asChild>
            <button type="button"
              aria-label="Open navigation menu"
              className="h-11 w-11 flex items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Menu size={22} />
            </button>
          </SheetTrigger>
          <img src={Logo} alt="" className="h-7 w-auto flex-shrink-0" />
          <span className="font-heading text-lg font-semibold text-foreground truncate">ToGather</span>
        </div>
        <button type="button" onClick={onLogout}
          className="h-11 flex items-center gap-1.5 px-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <LogOut size={15} /> Log out
        </button>
      </div>

      <SheetContent side="left" aria-describedby={undefined}
        className={[
          "w-72 max-w-[85vw] p-0 bg-sidebar border-r-0 overflow-y-auto",
          // Enlarge the Sheet's built-in close (X) button into a 40px touch target.
          "[&>button:last-child]:right-2 [&>button:last-child]:top-3",
          "[&>button:last-child]:h-10 [&>button:last-child]:w-10",
          "[&>button:last-child]:flex [&>button:last-child]:items-center [&>button:last-child]:justify-center",
          "[&>button:last-child]:rounded-lg [&>button:last-child]:opacity-100",
          "[&>button:last-child]:data-[state=open]:bg-transparent [&>button:last-child]:hover:bg-card/60",
          "[&>button:last-child>svg]:h-5 [&>button:last-child>svg]:w-5",
        ].join(" ")}>
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <Sidebar variant="drawer" invitation={invitation} onLogout={onLogout} onNavigate={close} />
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
