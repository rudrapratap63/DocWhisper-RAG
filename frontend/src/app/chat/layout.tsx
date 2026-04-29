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
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center px-4 border-b border-border"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)" }}>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="mr-3 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-secondary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm tracking-tight">DocWhisper</span>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-300 ease-out border-r border-border ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ background: "var(--sidebar)" }}
      >
        {/* Logo */}
        <div className="hidden md:flex items-center gap-2.5 px-5 h-16 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-secondary-foreground" />
          </div>
          <span className="font-bold text-foreground tracking-tight">DocWhisper</span>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pt-16 md:pt-4 pb-3">
          <Link href="/chat/new" onClick={() => setIsMobileMenuOpen(false)}>
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:text-foreground border border-border hover:border-secondary/30 hover:bg-secondary/5 transition-all duration-200 group">
              <div className="w-5 h-5 rounded-md bg-muted group-hover:bg-secondary/10 flex items-center justify-center transition-all">
                <Plus className="w-3 h-3" />
              </div>
              New conversation
            </button>
          </Link>
        </div>

        {/* Conversations List */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2 mb-1">
            Recent
          </p>
          {isChatsLoading ? (
            <div className="space-y-1.5 px-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground/60">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = pathname === `/chat/${conv.id}`;
              return (
                <Link
                  key={conv.id}
                  href={`/chat/${conv.id}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 ${
                    isActive
                      ? "bg-secondary/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-secondary" : "text-muted-foreground/50"}`} />
                  <span className="truncate flex-1 text-[13px]">{conv.title || "New Chat"}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                  )}
                </Link>
              );
            })
          )}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-all group cursor-default">
            <div className="w-8 h-8 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-secondary">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate flex-1">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all opacity-0 group-hover:opacity-100"
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
          className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"
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