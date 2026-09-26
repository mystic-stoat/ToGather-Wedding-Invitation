import { Link } from "react-router-dom";
import {
  LayoutDashboard, Heart, Users, Gift, MapPin,
  CalendarCheck, Mail, Smartphone, ChevronRight,
  LogOut
} from "lucide-react";
import Logo from "@/assets/logo.svg";
import { useLocation } from "react-router-dom";

// ── Sidebar ───────────────────────────────────────────────────────────────────
// Same sidebar as Dashboard for consistent navigation
const Sidebar = ({ invitation, onLogout }) => {
  // grab our location rq
  const location = useLocation();

  const groomFirst  = invitation?.groomName?.first || "";
  const brideFirst  = invitation?.brideName?.first || "";
  const coupleNames = groomFirst && brideFirst ? `${groomFirst} & ${brideFirst}` : null;
  const weddingDate = invitation?.weddingDate
    ? new Date(invitation.weddingDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : null;

  const NavItem = ({ to, icon: Icon, label, active }) => (
    <Link to={to}
      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-full text-sm transition-colors ${
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}>
      <Icon size={14} />
      {label}
      {active && <ChevronRight size={14} className="ml-auto" />}
    </Link>
  );

  return (
    <aside className="hidden lg:flex flex-col w-52 min-h-screen bg-sidebar border-r border-border/50 px-3 py-6 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1 px-1">

        <img src={Logo} className="h-8 w-auto"/>

        <span className="font-heading text-lg font-semibold text-foreground">ToGather</span>
      </div>
      <p className="text-xs text-muted-foreground px-1 mb-8">Plan the day. Share the joy.</p>

      <nav className="flex-1 space-y-4">
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2.5 mb-1.5">Overview</p>
          <NavItem to="/dashboard"   icon={LayoutDashboard} label="Dashboard" active={location.pathname === "/dashboard"}/>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2.5 mb-1.5">Planning</p>
          <div className="space-y-0.5">
            <NavItem to="/wedding-details" icon={Heart}        label="Wedding Details"  active={location.pathname === "/wedding-details"} />
            <NavItem to="/guest-list"      icon={Users}        label="Guest List"       active={location.pathname === "/guest-list"}/>
            <NavItem to="/dashboard"       icon={Gift}         label="Registry"         active={location.pathname === "/gift-registry"}/>
            <NavItem to="/dashboard"       icon={MapPin}       label="Travel & Stay"    active={location.pathname === "/travel-and-stay"}/>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2.5 mb-1.5">Invitations</p>
          <div className="space-y-0.5">
            <NavItem to="/dashboard"         icon={CalendarCheck} label="Save the Date"     active={location.pathname === "/save-the-date"}/>
            <NavItem to="/dashboard"         icon={Mail}          label="Paper Invitations" active={location.pathname === "/paper-invitation"}/>
            <NavItem to="/create-invitation" icon={Smartphone}    label="Mobile Invitation" active={location.pathname === "/create-invitation"}/>
          </div>
        </div>
      </nav>

      <div className="space-y-3 mt-6">
        {coupleNames && (
          <div className="bg-sidebar-accent rounded-xl px-3 py-3 border border-primary/15">
            <p className="text-sm font-semibold text-foreground">{coupleNames}</p>
            {weddingDate && <p className="text-xs text-muted-foreground mt-0.5">{weddingDate}</p>}
          </div>
        )}
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut size={15} /> Log out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
