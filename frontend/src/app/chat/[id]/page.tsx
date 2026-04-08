"use client";

import { use, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  ArrowUpIcon,
  Bot,
  FileText,
  Loader2,
  Paperclip,
  UploadCloud,
  User as UserIcon,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { fetchApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

interface Document {
  id: number;
  file_name: string;
  status: string;
}

interface UploadResponse {
  message: string;
  doc_id: number;
  status: string;
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");

  const isNew = id === "new";
  const selectedDocumentId = documentId ? Number.parseInt(documentId, 10) : null;
  const conversationId = isNew ? null : Number.parseInt(id, 10);

  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/login");
    }
  }, [user, isAuthLoading, router]);

  const { data: documents = [], isLoading: isDocumentsLoading } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: () => fetchApi("/documents/"),
    enabled: !!user && isNew,
    refetchInterval: isNew ? 3000 : false,
  });

  const { data: chatHistory } = useQuery<ChatHistoryResponse>({
    queryKey: ["chat", conversationId],
    queryFn: () => fetchApi(`/chats/${conversationId}`),
    enabled: !!conversationId && !!user,
    refetchInterval: isPolling ? 2000 : false,
  });

  useEffect(() => {
    if (chatHistory?.messages) {
      const lastMessage = chatHistory.messages[chatHistory.messages.length - 1];
      setIsPolling(!!lastMessage && lastMessage.role === "user");
    }
  }, [chatHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory?.messages, isPolling]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "52px";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 52), 160);
    textarea.style.height = `${nextHeight}px`;
  }, [input]);

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) =>
      fetchApi<UploadResponse>("/documents/upload", {
        method: "POST",
        body: formData,
      }),
    onSuccess: (data) => {
      toast.success("Document uploaded. Processing started.");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (data.status?.toLowerCase() === "ready") {
        router.replace(`/chat/new?documentId=${data.doc_id}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload document");
    },
  });

  const sendMutation = useMutation({
    onMutate: async (messageText: string) => {
      setInput("");
      setIsPolling(true);

      if (!isNew) {
        await queryClient.cancelQueries({ queryKey: ["chat", conversationId] });
        const previousChat = queryClient.getQueryData<ChatHistoryResponse>(["chat", conversationId]);
        const optimisticMessage: Message = {
          id: Date.now(),
          role: "user",
          content: messageText,
          citations: null,
        };
        queryClient.setQueryData<ChatHistoryResponse>(["chat", conversationId], (old) => {
          if (!old) return { messages: [optimisticMessage] };
          return { ...old, messages: [...old.messages, optimisticMessage] };
        });
        return { previousChat };
      }
    },
    mutationFn: (messageText: string) => {
      const body = isNew
        ? { document_id: selectedDocumentId, message: messageText }
        : { conversation_id: conversationId, message: messageText };
      return fetchApi<{ status: string; conversation_id: number; message: string }>("/chats/send", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (isNew && data.conversation_id) {
        router.replace(`/chat/${data.conversation_id}`);
      }
    },
    onError: (error: any, _variables, context) => {
      toast.error(error.message || "Failed to send message");
      setIsPolling(false);
      if (context?.previousChat) {
        queryClient.setQueryData(["chat", conversationId], context.previousChat);
      }
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMutation.isPending || (isNew && !selectedDocumentId)) return;
    sendMutation.mutate(input);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size should be under 10MB");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    uploadMutation.mutate(formData);
  };

  const chooseDocument = (docId: number) => {
    router.replace(`/chat/new?documentId=${docId}`);
  };

  const selectedDocument = documents.find((doc) => doc.id === selectedDocumentId);
  const messages = chatHistory?.messages || [];

  /* ─── Document Selection Screen ─────────────────────────────────── */
  if (isNew && !selectedDocumentId) {
    return (
      <div className="relative h-full overflow-y-auto" style={{ background: "#07070f" }}>
        {/* Background */}
        <div className="pointer-events-none fixed inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(109,40,217,0.15) 0%, transparent 60%), #07070f",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-3xl space-y-6 p-6 md:p-10">
          {/* Header */}
          <div className="space-y-2 pb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-300 text-xs font-medium">
              <Sparkles className="w-3 h-3" />
              New Conversation
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              Choose your document
            </h1>
            <p className="text-white/40 text-[15px]">
              Upload a PDF or select an existing one to start chatting.
            </p>
          </div>

          {/* Upload Card */}
          <div
            className="rounded-2xl border border-white/[0.07] p-6 md:p-8"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-violet-400" />
              Upload a new PDF
            </h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-white/10 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all cursor-pointer group">
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-white/20 group-hover:text-violet-400 transition-colors" />
                  <span className="text-sm text-white/30 group-hover:text-white/50 transition-colors">
                    {file ? file.name : "Click to browse or drag & drop"}
                  </span>
                  {!file && <span className="text-xs text-white/20">PDF up to 10MB</span>}
                </div>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={!file || uploadMutation.isPending}
                className={cn(
                  "w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2",
                  file && !uploadMutation.isPending
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20"
                    : "bg-white/5 text-white/25 cursor-not-allowed"
                )}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    Upload PDF
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Existing Documents */}
          <div
            className="rounded-2xl border border-white/[0.07] p-6 md:p-8"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-400" />
              Existing documents
            </h2>

            {isDocumentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 rounded-xl border border-dashed border-white/8">
                <FileText className="w-8 h-8 text-white/15" />
                <p className="text-sm text-white/25">No documents yet. Upload one above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {documents.map((doc) => {
                  const normalizedStatus = doc.status?.toLowerCase();
                  const isReady = normalizedStatus === "ready";
                  const isProcessing = normalizedStatus === "processing";
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      disabled={!isReady}
                      onClick={() => chooseDocument(doc.id)}
                      className={cn(
                        "group flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                        isReady
                          ? "border-white/8 hover:border-violet-500/30 hover:bg-violet-500/5 cursor-pointer"
                          : "border-white/5 opacity-50 cursor-not-allowed"
                      )}
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-white/40 group-hover:text-violet-400 transition-colors" />
                          <p className="truncate text-[13px] font-medium text-white/80">{doc.file_name}</p>
                        </div>
                        <p className="text-xs text-white/30 pl-5">
                          {isReady ? "Ready to chat" : isProcessing ? "Processing…" : "Failed"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          isReady
                            ? "bg-emerald-500/15 text-emerald-400"
                            : isProcessing
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-rose-500/15 text-rose-400"
                        )}
                      >
                        {normalizedStatus || "unknown"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Chat Screen ────────────────────────────────────────────────── */
  const canSend = input.trim().length > 0;

  return (
    <div className="relative flex h-full flex-col" style={{ background: "#07070f" }}>
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(109,40,217,0.1) 0%, transparent 60%), #07070f",
          }}
        />
      </div>

      {/* Document badge */}
      {isNew && selectedDocument && (
        <div className="relative z-10 flex items-center gap-2 px-5 py-3 border-b border-white/[0.05]"
          style={{ background: "rgba(255,255,255,0.02)" }}>
          <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="text-xs text-white/40">
            Chatting with <span className="text-white/70 font-medium">{selectedDocument.file_name}</span>
          </span>
        </div>
      )}

      {/* Messages */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 pb-40">
          {messages.length === 0 && !isPolling && (
            <div className="flex flex-col items-center justify-center mt-16 gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
                <Bot className="w-7 h-7 text-violet-300" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">Ask anything about your document</p>
                <p className="mt-1 text-sm text-white/35">Responses include citations when available.</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role !== "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20">
                  <Bot className="h-4 w-4 text-violet-300" />
                </div>
              )}

              <div className={`flex max-w-[85%] flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={cn(
                    "text-[14.5px] leading-relaxed",
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-sm bg-white text-neutral-900 px-4 py-3 shadow-sm"
                      : "rounded-2xl rounded-bl-sm border border-white/[0.07] px-4 py-3 text-white/85"
                  )}
                  style={
                    msg.role !== "user"
                      ? { background: "rgba(255,255,255,0.04)" }
                      : undefined
                  }
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-invert prose-p:leading-7 prose-headings:font-semibold prose-pre:rounded-xl prose-pre:bg-black/60 prose-pre:border prose-pre:border-white/10 prose-code:before:content-none prose-code:after:content-none prose-code:text-violet-300 prose-code:bg-violet-500/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.citations.map((cit, idx) => (
                      <span
                        key={idx}
                        className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300"
                      >
                        p.{cit.page_number}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                  <UserIcon className="h-4 w-4 text-white/60" />
                </div>
              )}
            </div>
          ))}

          {isPolling && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20">
                <Bot className="h-4 w-4 text-violet-300" />
              </div>
              <div
                className="flex items-center gap-2.5 rounded-2xl rounded-bl-sm border border-white/[0.07] px-4 py-3"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                    />
                  ))}
                </span>
                <span className="text-sm text-white/40">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Floating Input Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-10"
        style={{ background: "linear-gradient(to top, #07070f 60%, transparent)" }}>
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSend}>
            <div
              className="relative rounded-2xl border transition-all duration-300"
              style={{
                background: "rgba(18,18,30,0.95)",
                backdropFilter: "blur(20px)",
                borderColor: canSend ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.08)",
                boxShadow: canSend
                  ? "0 0 0 1px rgba(139,92,246,0.15), 0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(139,92,246,0.08)"
                  : "0 20px 50px rgba(0,0,0,0.6)",
              }}
            >
              <Textarea
                ref={textareaRef}
                placeholder={
                  isNew && !selectedDocumentId
                    ? "Select a document first…"
                    : "Message DocWhisper…"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                className="min-h-[52px] w-full resize-none border-none bg-transparent px-5 pt-4 pb-2 text-[14.5px] leading-relaxed text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={sendMutation.isPending || (isNew && !selectedDocumentId)}
                style={{ overflow: "hidden", maxHeight: 160 }}
              />

              <div className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all text-xs"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Attach</span>
                </button>

                <button
                  type="submit"
                  disabled={!canSend || sendMutation.isPending || isPolling || (isNew && !selectedDocumentId)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
                    canSend && !isPolling
                      ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 active:scale-95"
                      : "bg-white/6 text-white/20 cursor-not-allowed"
                  )}
                >
                  {isPolling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowUpIcon className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">Send</span>
                </button>
              </div>
            </div>
            <p className="text-center mt-2 text-[11px] text-white/18">
              Press Enter to send · Shift+Enter for new line
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}