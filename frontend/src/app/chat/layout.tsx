"use client";

import { useAuth } from "@/contexts/auth-context";
import { fetchApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, LogOut, FileText, Menu } from "lucide-react";
import { useState } from "react";

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

  // redirect if not logged in
  if (!isAuthLoading && !user) {
    router.push("/login");
    return null;
  }

  const { data: conversations = [], isLoading: isChatsLoading } = useQuery<
    Conversation[]
  >({
    queryKey: ["conversations"],
    queryFn: () => fetchApi("/chats/"),
    enabled: !!user,
  });

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-zinc-900 flex items-center px-4 z-50 text-white">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="mr-3">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4" /> DocWhisper
        </span>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-zinc-900 text-zinc-300 transform transition-transform duration-200 ease-in-out flex flex-col ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-4 pt-16 md:pt-4">
          <Link href="/chat/new" onClick={() => setIsMobileMenuOpen(false)}>
            <Button
              variant="outline"
              className="w-full justify-start text-zinc-100 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-xs font-semibold text-zinc-500 mb-3 px-2">
            Today
          </div>
          {isChatsLoading ? (
            <div className="px-2 text-sm text-zinc-500">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="px-2 text-sm text-zinc-500">No recent chats</div>
          ) : (
            conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 text-sm rounded-lg transition-colors group ${
                  pathname === `/chat/${conv.id}`
                    ? "bg-zinc-800 text-white"
                    : "hover:bg-zinc-800/50 hover:text-zinc-100"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-zinc-400" />
                <span className="truncate flex-1">{conv.title || "New Chat"}</span>
              </Link>
            ))
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 mt-auto">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-zinc-300 font-medium">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <span className="text-sm font-medium truncate text-zinc-200">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </div>

      {/* Main Content Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 bg-white">
        {children}
      </div>
    </div>
  );
}