"use client";

import React, { useState } from "react";
import { LogOut } from "lucide-react";

export const LogoutButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={pending}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 text-xs transition-colors disabled:opacity-50"
      title="Log out"
    >
      <LogOut className="w-4 h-4" />
      {!compact && <span className="hidden sm:inline">Log out</span>}
    </button>
  );
};
