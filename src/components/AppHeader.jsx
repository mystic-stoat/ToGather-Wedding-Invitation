import { Link, useLocation } from "react-router-dom";
import { ChevronDown, User } from "lucide-react";
const AppHeader = ({
  showNav = true
}) => {
  const location = useLocation();
  return <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-heading text-2xl font-bold text-foreground tracking-tight">
            ToGather
          </Link>
          {showNav && <nav className="hidden md:flex items-center gap-6">
              <Link to="/dashboard" className={`text-sm font-medium transition-colors flex items-center gap-1 ${location.pathname === "/dashboard" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                Planning <ChevronDown size={14} />
              </Link>
              <Link to="/create-invitation" className={`text-sm font-medium transition-colors flex items-center gap-1 ${location.pathname === "/create-invitation" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                Invitations <ChevronDown size={14} />
              </Link>
            </nav>}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
            Your account
          </Link>
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <User size={16} className="text-muted-foreground" />
          </div>
        </div>
      </div>
    </header>;
};
export default AppHeader;
