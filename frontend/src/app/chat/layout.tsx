"use client";

import { useAuth } from "@/contexts/auth-context";
import { fetchApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, LogOut, FileText, Menu, X, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login");
    }
  }, [isAuthLoading, user, router]);

  const { data: conversations = [], isLoading: isChatsLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => fetchApi("/chats/"),
    enabled: !!user,
  });

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!isAuthLoading && !user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center px-4 border-b border-white/5"
        style={{ background: "rgba(10,10,20,0.95)", backdropFilter: "blur(20px)" }}>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="mr-3 w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">DocWhisper</span>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-300 ease-out border-r border-white/6 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ background: "rgba(12,12,22,0.98)" }}
      >
        {/* Logo */}
        <div className="hidden md:flex items-center gap-2.5 px-5 h-16 border-b border-white/6 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">DocWhisper</span>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pt-16 md:pt-4 pb-3">
          <Link href="/chat/new" onClick={() => setIsMobileMenuOpen(false)}>
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200 group">
              <div className="w-5 h-5 rounded-md bg-white/10 group-hover:bg-white/15 flex items-center justify-center transition-all">
                <Plus className="w-3 h-3" />
              </div>
              New conversation
            </button>
          </Link>
        </div>

        {/* Conversations List */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-white/10">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-3 py-2 mb-1">
            Recent
          </p>
          {isChatsLoading ? (
            <div className="space-y-1.5 px-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-9 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <MessageSquare className="w-6 h-6 text-white/20 mx-auto mb-2" />
              <p className="text-xs text-white/30">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = pathname === `/chat/${conv.id}`;
              return (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-150 ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-violet-400" : "text-white/30"}`} />
                  <span className="truncate flex-1 text-[13px]">{conv.title || "New Chat"}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  )}
                </Link>
              );
            })
          )}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-white/6 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all group cursor-default">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500/30 to-indigo-600/30 border border-violet-500/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-violet-300">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <span className="text-xs text-white/50 truncate flex-1">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/70 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {children}
      </div>
    </div>
  );
}