import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto flex items-center justify-between h-16 px-6">
        <a href="/" className="font-heading text-2xl font-bold tracking-tight text-foreground">
          ToGather
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Planning</a>
          <Link to="/create-invitation" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Invitations</Link>
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Log in</Link>
          <Link to="/signup"><Button variant="hero" size="default">Get started</Button></Link>
        </div>

        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-background border-b border-border animate-fade-in">
          <div className="flex flex-col gap-4 p-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground" onClick={() => setOpen(false)}>Planning</a>
            <Link to="/create-invitation" className="text-sm font-medium text-muted-foreground" onClick={() => setOpen(false)}>Invitations</Link>
            <Link to="/login" className="text-sm font-medium text-muted-foreground" onClick={() => setOpen(false)}>Log in</Link>
            <Link to="/signup" onClick={() => setOpen(false)}><Button variant="hero" size="default">Get started</Button></Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
