"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { AuthModal } from "@/components/auth/AuthModal";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { TOOLS } from "@/lib/tools";
import { ToolCategory } from "@/types";
import { supabase } from "@/lib/supabase/client";
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cloud,
  FileCheck2,
  Sparkles,
  Heart,
} from "lucide-react";

export default function Home() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Check Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const filteredTools = TOOLS.filter((tool) => {
    const matchesCategory =
      activeCategory === "all" || tool.category === activeCategory;
    const matchesSearch =
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.shortTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.outputFormatName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-red-500 selection:text-white">
      {/* Navigation Header */}
      <Header userEmail={userEmail} onOpenAuth={() => setIsAuthOpen(true)} />

      {/* Hero Section */}
      <section className="relative pt-12 pb-8 sm:pt-20 sm:pb-12 px-4 sm:px-8 flex flex-col items-center text-center overflow-hidden border-b border-zinc-850">
        {/* Glow ambient backdrops */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-red-600/15 via-rose-600/10 to-transparent blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-3xl flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 mb-6 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-zinc-200">The Modern Document Converter Utility</span>
            <span className="text-zinc-500">|</span>
            <span className="text-red-400 font-semibold">100% Free & Fast</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Every tool you need to <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-red-500 via-rose-400 to-amber-300 bg-clip-text text-transparent">
              convert documents
            </span>{" "}
            in one place
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mb-8 leading-relaxed">
            Edit PDFs directly with pixel-perfect visual precision, or convert PDFs to Word documents with zero formatting loss. 100% free, fast, and secure.
          </p>

          {/* Search & Category Filter Bar */}
          <div className="w-full max-w-xl flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative w-full">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools (e.g., Edit PDF, PDF to Word)..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500 transition-all shadow-lg shadow-black/40"
              />
            </div>

            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 max-w-fit mx-auto">
              <button
                onClick={() => {
                  setActiveCategory("all");
                  setSearchQuery("");
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  searchQuery === ""
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                All Tools ({TOOLS.length})
              </button>
              <button
                onClick={() => {
                  setActiveCategory("all");
                  setSearchQuery("edit");
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  searchQuery.toLowerCase() === "edit"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                Edit PDF Online
              </button>
              <button
                onClick={() => {
                  setActiveCategory("all");
                  setSearchQuery("word");
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  searchQuery.toLowerCase() === "word"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                PDF to Word
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tool Cards Grid */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Popular Document Utilities
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select a tool below to open the editor or converter
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-medium">
            Showing {filteredTools.length} {filteredTools.length === 1 ? "tool" : "tools"}
          </span>
        </div>

        {filteredTools.length === 0 ? (
          <div className="w-full py-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800">
            <p className="text-zinc-400 text-sm">No conversion tools found matching &quot;{searchQuery}&quot;</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
              className="mt-3 text-xs text-red-400 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6">
            {filteredTools.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tool/${tool.slug}`}
                className="group relative flex flex-col p-6 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 hover:-translate-y-1"
              >
                {/* Header row in card */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${tool.color.bg} ${tool.color.text} border ${tool.color.border} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300`}
                  >
                    <ToolIcon name={tool.icon} size={24} />
                  </div>

                  {tool.badge && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm">
                      {tool.badge}
                    </span>
                  )}
                </div>

                {/* Title & description */}
                <h3 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors mb-2">
                  {tool.title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-6 flex-1">
                  {tool.description}
                </p>

                {/* Footer in card */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/60">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400">
                    <span className="text-zinc-300">{tool.inputFormats.join(", ").toUpperCase()}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-white bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {tool.outputFormat.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-semibold text-red-400 group-hover:translate-x-1 transition-transform">
                    <span>Convert Now</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Feature Value Props */}
      <section className="w-full bg-zinc-900/40 border-t border-zinc-800 py-12 px-4 sm:px-8 mt-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Instant Cloud Conversion</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Powered by high-speed cloud APIs to deliver document conversions in under 5 seconds with original layouts intact.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">100% Safe & Confidential</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your privacy is paramount. Uploaded documents are converted securely and automatically erased after processing.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Cloud size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Supabase Cloud Sync</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sign in with your account to securely store your converted files and access your document conversion history anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-800/80 py-6 px-4 text-center text-xs text-zinc-500">
        <p>© 2026 iLovePDF DocuConvert. Built with Next.js, Tailwind CSS, Supabase, and ConvertAPI.</p>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(email) => setUserEmail(email)}
      />
    </div>
  );
}
