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
      <div className="relative h-full overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-6 md:p-10">
          {/* Header */}
          <div className="space-y-2 pb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-secondary/25 bg-secondary/10 text-secondary text-xs font-medium">
              <Sparkles className="w-3 h-3" />
              New Conversation
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              Choose your document
            </h1>
            <p className="text-muted-foreground text-[15px]">
              Upload a PDF or select an existing one to start chatting.
            </p>
          </div>

          {/* Upload Card */}
          <div
            className="rounded-xl border border-border p-6 md:p-8"
            style={{ background: "var(--card)" }}
          >
            <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-secondary" />
              Upload a new PDF
            </h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <label className="flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-border hover:border-secondary/40 hover:bg-secondary/5 transition-all cursor-pointer group">
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-muted-foreground/30 group-hover:text-secondary transition-colors" />
                  <span className="text-sm text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                    {file ? file.name : "Click to browse or drag & drop"}
                  </span>
                  {!file && <span className="text-xs text-muted-foreground/40">PDF up to 10MB</span>}
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
                  "w-full h-11 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                  file && !uploadMutation.isPending
                    ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm"
                    : "bg-muted text-muted-foreground/40 cursor-not-allowed"
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
            className="rounded-xl border border-border p-6 md:p-8"
            style={{ background: "var(--card)" }}
          >
            <h2 className="text-base font-semibold text-foreground mb-5 flex items-center gap-2">
              <FileText className="w-4 h-4 text-secondary" />
              Existing documents
            </h2>

            {isDocumentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 rounded-lg border border-dashed border-border">
                <FileText className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">No documents yet. Upload one above.</p>
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
                        "group flex items-start justify-between gap-3 rounded-lg border p-4 text-left transition-all duration-200",
                        isReady
                          ? "border-border hover:border-secondary/30 hover:bg-secondary/5 cursor-pointer"
                          : "border-border/50 opacity-50 cursor-not-allowed"
                      )}
                      style={{ background: "var(--background)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-secondary transition-colors" />
                          <p className="truncate text-[13px] font-medium text-foreground">{doc.file_name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground/60 pl-5">
                          {isReady ? "Ready to chat" : isProcessing ? "Processing…" : "Failed"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          isReady
                            ? "bg-green-100 text-green-700"
                            : isProcessing
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
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
    <div className="relative flex h-full flex-col" style={{ background: "#FFFFFF" }}>
      {/* Document badge */}
      {isNew && selectedDocument && (
        <div className="relative z-10 flex items-center gap-2 px-5 py-3 border-b border-border"
          style={{ background: "var(--background)" }}>
          <FileText className="w-3.5 h-3.5 text-secondary shrink-0" />
          <span className="text-xs text-muted-foreground">
            Chatting with <span className="text-foreground font-medium">{selectedDocument.file_name}</span>
          </span>
        </div>
      )}

      {/* Messages */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 pb-40">
          {messages.length === 0 && !isPolling && (
            <div className="flex flex-col items-center justify-center mt-16 gap-4 text-center">
              <div className="w-14 h-14 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                <Bot className="w-7 h-7 text-secondary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Ask anything about your document</p>
                <p className="mt-1 text-sm text-muted-foreground">Responses include citations when available.</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role !== "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 border border-secondary/20">
                  <Bot className="h-4 w-4 text-secondary" />
                </div>
              )}

              <div className={`flex max-w-[85%] flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={cn(
                    "text-[14.5px] leading-relaxed",
                    msg.role === "user"
                      ? "rounded-xl rounded-br-sm bg-primary text-primary-foreground px-4 py-3 shadow-sm"
                      : "rounded-xl rounded-bl-sm border border-border px-4 py-3 text-foreground"
                  )}
                  style={
                    msg.role !== "user"
                      ? { background: "var(--muted)" }
                      : undefined
                  }
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-p:leading-7 prose-headings:font-semibold prose-pre:rounded-lg prose-pre:bg-muted prose-pre:border prose-code:text-secondary prose-code:bg-secondary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.citations.map((cit, idx) => (
                      <span
                        key={idx}
                        className="rounded-full border border-secondary/20 bg-secondary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary"
                      >
                        p.{cit.page_number}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isPolling && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 border border-secondary/20">
                <Bot className="h-4 w-4 text-secondary" />
              </div>
              <div
                className="flex items-center gap-2.5 rounded-xl rounded-bl-sm border border-border px-4 py-3"
                style={{ background: "var(--muted)" }}
              >
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                    />
                  ))}
                </span>
                <span className="text-sm text-muted-foreground">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Floating Input Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-10"
        style={{ background: "linear-gradient(to top, #FFFFFF 60%, transparent)" }}>
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSend}>
            <div
              className="relative rounded-xl border transition-all duration-300"
              style={{
                background: "var(--background)",
                backdropFilter: "blur(20px)",
                borderColor: canSend ? "var(--secondary)" : "var(--border)",
                boxShadow: canSend
                  ? "0 0 0 1px var(--secondary/20), 0 4px 12px rgba(0,0,0,0.1)"
                  : "0 4px 12px rgba(0,0,0,0.05)",
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
                className="min-h-[52px] w-full resize-none border-none bg-transparent px-5 pt-4 pb-2 text-[14.5px] leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={sendMutation.isPending || (isNew && !selectedDocumentId)}
                style={{ overflow: "hidden", maxHeight: 160 }}
              />

              <div className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-xs"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Attach</span>
                </button>

                <button
                  type="submit"
                  disabled={!canSend || sendMutation.isPending || isPolling || (isNew && !selectedDocumentId)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                    canSend && !isPolling
                      ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm"
                      : "bg-muted text-muted-foreground/40 cursor-not-allowed"
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
            <p className="text-center mt-2 text-[11px] text-muted-foreground/60">
              Press Enter to send · Shift+Enter for new line
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}