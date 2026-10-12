import { useState } from "react";
import { X } from "lucide-react";
import Sidebar from "@/components/Sidebar";

const MobileNav = ({ invitation, onLogout, open, onOpenChange }) => {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-sidebar transform transition-transform duration-300 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-end p-3">
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close navigation"
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <X size={22} />
          </button>
        </div>
        <Sidebar
          invitation={invitation}
          onLogout={onLogout}
          variant="drawer"
          onNavigate={() => onOpenChange(false)}
        />
      </div>
    </>
  );
};

export default MobileNav;
