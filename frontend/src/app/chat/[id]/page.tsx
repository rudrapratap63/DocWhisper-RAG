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
    textarea.style.height = "48px";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 48), 150);
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

  if (isNew && !selectedDocumentId) {
    return (
      <div
        className="relative h-full overflow-y-auto bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(5,8,20,0.78), rgba(8,10,20,0.92)), url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1920&q=80')",
          backgroundAttachment: "fixed",
        }}
      >
        <div className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
          <section className="rounded-3xl border border-neutral-700/80 bg-black/45 p-6 shadow-2xl backdrop-blur md:p-8">
            <div className="mb-6 space-y-2">
              <span className="inline-flex items-center rounded-full border border-neutral-600 bg-neutral-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200">
                New Conversation
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Start a document chat</h1>
              <p className="text-neutral-300">Upload a PDF or choose a ready document before sending your first message.</p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="h-12 border-neutral-600 bg-neutral-900/70 text-neutral-100 file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-200"
              />
              <Button
                type="submit"
                className="h-11 rounded-xl bg-neutral-100 px-5 text-neutral-900 hover:bg-white"
                disabled={!file || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Upload PDF
                  </>
                )}
              </Button>
            </form>
          </section>

          <section className="rounded-3xl border border-neutral-700/80 bg-black/45 p-6 shadow-2xl backdrop-blur md:p-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Choose from existing documents</h2>

            {isDocumentsLoading ? (
              <div className="grid h-28 place-items-center text-neutral-300">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-600 bg-neutral-900/50 p-8 text-center text-neutral-300">
                No documents yet. Upload one above to begin.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {documents.map((doc) => {
                  const normalizedStatus = doc.status?.toLowerCase();
                  const isReady = normalizedStatus === "ready";
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className="rounded-2xl border border-neutral-700 bg-neutral-900/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-neutral-500 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => chooseDocument(doc.id)}
                      disabled={!isReady}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-neutral-200" />
                            <p className="truncate font-medium text-white">{doc.file_name}</p>
                          </div>
                          <p className="text-xs text-neutral-300">
                            {isReady ? "Ready to chat" : normalizedStatus === "processing" ? "Processing..." : "Processing failed"}
                          </p>
                        </div>
                        <span className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                          isReady
                            ? "bg-emerald-500/20 text-emerald-300"
                            : normalizedStatus === "processing"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-rose-500/20 text-rose-300"
                        )}>
                          {normalizedStatus || "unknown"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col bg-cover bg-center"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(5,8,20,0.75), rgba(8,10,20,0.92)), url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1920&q=80')",
        backgroundAttachment: "fixed",
      }}
    >
      <main className="relative flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {isNew && selectedDocument && (
            <div className="rounded-2xl border border-neutral-600 bg-neutral-900/70 px-4 py-3 text-sm text-neutral-200 backdrop-blur">
              Chatting with <span className="font-semibold">{selectedDocument.file_name}</span>
            </div>
          )}

          {messages.length === 0 && !isPolling && (
            <div className="mx-auto mt-20 max-w-md rounded-3xl border border-neutral-700 bg-neutral-900/60 p-8 text-center text-neutral-200 backdrop-blur">
              <Bot className="mx-auto mb-4 h-12 w-12" />
              <p className="text-lg font-medium text-white">Ask anything about your document</p>
              <p className="mt-1 text-sm text-neutral-300">Responses include context-aware citations when available.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 md:gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role !== "user" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-600 bg-neutral-900/80 shadow-sm">
                  <Bot className="h-5 w-5 text-neutral-200" />
                </div>
              )}

              <div className={`flex max-w-[90%] flex-col md:max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={cn(
                    "leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "rounded-2xl rounded-br-md bg-neutral-100 p-4 text-neutral-900"
                      : "rounded-2xl rounded-bl-md border border-neutral-700 bg-neutral-900/70 p-4 text-neutral-100 backdrop-blur"
                  )}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-invert prose-headings:font-semibold prose-p:leading-7 prose-pre:rounded-xl prose-pre:bg-black prose-pre:text-zinc-100 prose-code:before:content-none prose-code:after:content-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.citations.map((cit, idx) => (
                      <span key={idx} className="rounded-full border border-neutral-600 bg-neutral-800/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-200">
                        p.{cit.page_number}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-500 bg-neutral-100 shadow-sm">
                  <UserIcon className="h-5 w-5 text-neutral-800" />
                </div>
              )}
            </div>
          ))}

          {isPolling && (
            <div className="flex justify-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-600 bg-neutral-900/80 shadow-sm">
                <Bot className="h-5 w-5 text-neutral-200" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-neutral-700 bg-neutral-900/80 p-4 shadow-sm backdrop-blur">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-300" />
                <span className="text-sm text-neutral-200">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="relative shrink-0 border-t border-neutral-700 bg-black/45 p-4 backdrop-blur">
        <div className="mx-auto max-w-4xl">
          <form onSubmit={handleSend} className="rounded-2xl border border-neutral-700 bg-black/55 p-2 backdrop-blur-md">
            <Textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-12 resize-none border-none bg-transparent px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-400 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={sendMutation.isPending || (isNew && !selectedDocumentId)}
              style={{ overflow: "hidden", maxHeight: 150 }}
            />

            <div className="flex items-center justify-between px-1 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-neutral-200 hover:bg-neutral-700"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                type="submit"
                disabled={!input.trim() || sendMutation.isPending || isPolling || (isNew && !selectedDocumentId)}
                className="h-9 rounded-lg bg-neutral-100 px-3 text-neutral-900 hover:bg-white"
              >
                <ArrowUpIcon className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </form>
        </div>
      </footer>
    </div>
  );
}
