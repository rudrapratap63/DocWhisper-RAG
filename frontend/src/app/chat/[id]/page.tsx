"use client";

import { use, useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { fetchApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Loader2, Bot, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Citation {
  page_number: string;
  source: string;
}

interface Message {
  id: number;
  role: string;
  content: string;
  citations: Citation[] | null;
}

interface ChatHistoryResponse {
  messages: Message[];
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  // `use(params)` to properly unwrap Next.js 15+ dynamic route params
  const { id } = use(params);
  
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");
  
  const isNew = id === "new";
  const conversationId = isNew ? null : parseInt(id, 10);

  const [input, setInput] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // redirect if not logged in
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/login");
    }
  }, [user, isAuthLoading, router]);

  // Fetch chat history only if it's not a new chat
  const { data: chatHistory, refetch } = useQuery<ChatHistoryResponse>({
    queryKey: ["chat", conversationId],
    queryFn: () => fetchApi(`/chats/${conversationId}`),
    enabled: !!conversationId && !!user,
    refetchInterval: isPolling ? 2000 : false, // Poll every 2 seconds if AI is thinking
  });

  // Polling logic to wait for AI
  useEffect(() => {
    if (chatHistory?.messages) {
      const messages = chatHistory.messages;
      const lastMessage = messages[messages.length - 1];
      // if the last message in DB is from the user, the AI hasn't responded yet
      if (lastMessage && lastMessage.role === "user") {
        setIsPolling(true);
      } else {
        setIsPolling(false);
      }
    }
  }, [chatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory?.messages, isPolling]);

  const sendMutation = useMutation({
    // 1. onMutate runs BEFORE the API call even starts
    onMutate: async (messageText: string) => {
      setInput(""); // Clear input instantly
      setIsPolling(true); // Show the "Thinking..." spinner instantly

      if (!isNew) {
        // Cancel any active polling/fetches so they don't overwrite our optimistic update
        await queryClient.cancelQueries({ queryKey: ["chat", conversationId] });

        // Get the current chat history from the cache
        const previousChat = queryClient.getQueryData<ChatHistoryResponse>(["chat", conversationId]);

        // Create a temporary fake message
        const optimisticMessage: Message = {
          id: Date.now(), // Fake ID
          role: "user",
          content: messageText,
          citations: null,
        };

        // Force the fake message into the cache so the UI updates instantly
        queryClient.setQueryData<ChatHistoryResponse>(["chat", conversationId], (old) => {
          if (!old) return { messages: [optimisticMessage] };
          return { ...old, messages: [...old.messages, optimisticMessage] };
        });

        // Return the previous context in case the API fails and we need to roll back
        return { previousChat };
      }
    },
    mutationFn: (messageText: string) => {
      const body = isNew
        ? { document_id: parseInt(documentId || "0", 10), message: messageText }
        : { conversation_id: conversationId, message: messageText };
      
      return fetchApi<{ status: string; conversation_id: number; message: string }>("/chats/send", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      if (isNew && data.conversation_id) {
        // Redirect to the new conversation URL
        router.replace(`/chat/${data.conversation_id}`);
      } else {
        // We don't need to invalidate right away because polling is about to start
        // and fetch the real database IDs anyway!
      }
    },
    // If the API call fails, roll back to the previous chat history
    onError: (error: any, variables, context) => {
      toast.error(error.message || "Failed to send message");
      setIsPolling(false);
      if (context?.previousChat) {
        queryClient.setQueryData(["chat", conversationId], context.previousChat);
      }
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMutation.isPending) return;
    
    // Optistic UI update logic can be complex with polling, but typically we send the mutation.
    sendMutation.mutate(input);
  };

  const messages = chatHistory?.messages || [];

  return (
    <div className="flex flex-col h-screen bg-zinc-50 font-sans">
      <header className="flex h-16 items-center px-4 border-b bg-white shrink-0">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="mr-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold flex-1">Document Assistant</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && !isPolling && (
            <div className="text-center text-zinc-500 mt-20">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ask anything about the document.</p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
              )}
              
              <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-xl shadow-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-zinc-900 text-zinc-50 rounded-br-none' 
                    : 'bg-white rounded-bl-none prose prose-sm max-w-none text-zinc-800'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {msg.citations.map((cit, idx) => (
                      <span key={idx} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 uppercase tracking-wide font-medium">
                        Page {cit.page_number}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5 text-zinc-600" />
                </div>
              )}
            </div>
          ))}

          {isPolling && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div className="p-4 rounded-xl bg-white rounded-bl-none shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                <span className="text-zinc-500 text-sm">Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white border-t p-4 shrink-0 absolute bottom-0 w-full z-10">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSend} className="flex gap-2 items-center">
            <Input 
              placeholder="Type your message..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 shadow-sm rounded-full bg-zinc-50 px-6 py-6"
              disabled={sendMutation.isPending || (isNew && !documentId)}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full shadow-sm w-12 h-12 shrink-0 bg-zinc-900 hover:bg-zinc-800"
              disabled={!input.trim() || sendMutation.isPending || isPolling}
            >
              <Send className="w-5 h-5 text-white" />
            </Button>
          </form>
        </div>
      </footer>
    </div>
  );
}
