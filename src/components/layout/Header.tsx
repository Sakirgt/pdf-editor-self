"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  User,
  LogIn,
  LogOut,
  Sparkles,
  ChevronDown,
  Layers,
  Heart,
  FileCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { TOOLS } from "@/lib/tools";
import { getGuestEditCount, getUserEditCount, GUEST_EDIT_LIMIT } from "@/lib/userStats";

interface HeaderProps {
  userEmail: string | null;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ userEmail, onOpenAuth }) => {
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [editCount, setEditCount] = useState<number>(0);

  const loadCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const count = await getUserEditCount(user.id);
        setEditCount(count);
      } else {
        setEditCount(getGuestEditCount());
      }
    } catch {
      setEditCount(getGuestEditCount());
    }
  };

  useEffect(() => {
    loadCounts();

    const handleCountChange = () => {
      loadCounts();
    };

    window.addEventListener("edit-count-changed", handleCountChange);
    return () => {
      window.removeEventListener("edit-count-changed", handleCountChange);
    };
  }, [userEmail]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setEditCount(getGuestEditCount());
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 h-16 flex items-center justify-between select-none">
      {/* Brand / Logo */}
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/20 group-hover:scale-105 transition-transform">
            <span className="font-extrabold text-sm flex items-center gap-0.5">
              i<Heart size={14} className="fill-white" />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-white group-hover:text-red-400 transition-colors">
              iLove<span className="text-red-500">PDF</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-medium -mt-1 tracking-wider uppercase">
              DocuConvert
            </span>
          </div>
        </Link>

        {/* Desktop Quick Nav */}
        <nav className="hidden md:flex items-center space-x-1">
          {/* All Tools Dropdown */}
          <div className="relative">
            <button
              onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
              onBlur={() => setTimeout(() => setToolsDropdownOpen(false), 200)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              <span>Convert Tools</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${toolsDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {toolsDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-2 z-50 animate-fade-in">
                <div className="text-[10px] uppercase font-bold text-zinc-500 px-3 py-1.5 tracking-wider">
                  Popular Tools
                </div>
                {TOOLS.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tool/${tool.slug}`}
                    className="flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full ${tool.color.text.replace("text-", "bg-")}`} />
                    <span>{tool.shortTitle}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/tool/edit-pdf"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            Edit PDF Online
          </Link>
          <Link
            href="/tool/pdf-to-word"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            PDF to Word
          </Link>
        </nav>
      </div>

      {/* Supabase User Profile & Auth */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {userEmail ? (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <User size={13} className="text-zinc-400 shrink-0" />
              <span className="max-w-[95px] sm:max-w-[150px] truncate font-medium">{userEmail}</span>
              <span className="ml-1 px-2 py-0.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-[10px] tracking-wide whitespace-nowrap flex items-center gap-1">
                <FileCheck size={11} />
                <span>{editCount} {editCount === 1 ? "PDF" : "PDFs"}</span>
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Free guest edits badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
              <span>Free Edits:</span>
              <span className={`font-bold ${editCount >= GUEST_EDIT_LIMIT ? "text-red-400 font-extrabold" : "text-emerald-400"}`}>
                {Math.max(0, GUEST_EDIT_LIMIT - editCount)} left
              </span>
            </div>
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md shadow-red-500/20 transition-all cursor-pointer"
            >
              <LogIn size={14} />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
