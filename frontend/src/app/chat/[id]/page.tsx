"use client";

import { use, useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { fetchApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Bot, User as UserIcon, UploadCloud, FileText } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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
  const conversationId = isNew ? null : parseInt(id, 10);

  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const messages = chatHistory.messages;
      const lastMessage = messages[messages.length - 1];
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
      <div className="relative h-full overflow-y-auto bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_40%),radial-gradient(circle_at_bottom_left,#e0e7ff,transparent_45%),#f8fafc]">
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-20 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative mx-auto w-full max-w-6xl p-4 md:p-8 space-y-8">
          <section className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-xl shadow-blue-100/40 backdrop-blur md:p-8">
            <div className="mb-6 space-y-2">
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-blue-700 uppercase">
                New Conversation
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">Start a document chat</h1>
              <p className="text-zinc-600 md:text-base">Upload a PDF or choose a ready document to begin an answer-backed conversation with citations.</p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="h-12 rounded-xl border-zinc-200 bg-white text-sm shadow-sm file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium"
              />
              <Button
                type="submit"
                className="h-11 rounded-xl bg-zinc-900 px-5 text-zinc-50 shadow-lg shadow-zinc-900/15 transition hover:-translate-y-0.5 hover:bg-zinc-800"
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

          <section className="rounded-3xl border border-white/70 bg-white/75 p-6 shadow-xl shadow-blue-100/40 backdrop-blur md:p-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900">Choose from existing documents</h2>

            {isDocumentsLoading ? (
              <div className="grid h-28 place-items-center text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center text-zinc-500">
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
                      className="group rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => chooseDocument(doc.id)}
                      disabled={!isReady}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                            <p className="truncate font-medium text-zinc-900">{doc.file_name}</p>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {isReady ? "Ready to chat" : normalizedStatus === "processing" ? "Processing..." : "Processing failed"}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          isReady ? "bg-emerald-100 text-emerald-700" : normalizedStatus === "processing" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                        }`}>
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
    <div className="relative flex h-full flex-col bg-[radial-gradient(circle_at_top,#dbeafe,transparent_35%),#f8fafc]">
      <div className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 -left-24 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />

      <main className="relative flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {isNew && selectedDocument && (
            <div className="rounded-2xl border border-blue-200 bg-white/80 px-4 py-3 text-sm text-blue-700 shadow-sm backdrop-blur">
              Chatting with <span className="font-semibold">{selectedDocument.file_name}</span>
            </div>
          )}

          {messages.length === 0 && !isPolling && (
            <div className="mx-auto mt-20 max-w-md rounded-3xl border border-white/70 bg-white/70 p-8 text-center text-zinc-600 shadow-xl shadow-blue-100/40 backdrop-blur">
              <Bot className="mx-auto mb-4 h-12 w-12 text-blue-500" />
              <p className="text-lg font-medium text-zinc-800">Ask anything about your document</p>
              <p className="mt-1 text-sm text-zinc-500">Responses include context-aware citations when available.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 md:gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role !== "user" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 shadow-sm">
                  <Bot className="h-5 w-5 text-blue-600" />
                </div>
              )}

              <div className={`flex max-w-[90%] flex-col md:max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "rounded-2xl rounded-br-md bg-zinc-900 p-4 text-zinc-50"
                    : "rounded-2xl rounded-bl-md border border-white/70 bg-white/85 p-4 text-zinc-800 backdrop-blur"
                }`}>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-zinc prose-headings:font-semibold prose-p:leading-7 prose-pre:rounded-xl prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-code:before:content-none prose-code:after:content-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.citations.map((cit, idx) => (
                      <span key={idx} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                        p.{cit.page_number}{cit.source ? ` • ${cit.source}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-100 shadow-sm">
                  <UserIcon className="h-5 w-5 text-zinc-700" />
                </div>
              )}
            </div>
          ))}

          {isPolling && (
            <div className="flex gap-4 justify-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 shadow-sm">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                <span className="text-zinc-500 text-sm">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="relative shrink-0 border-t border-white/80 bg-white/70 p-4 backdrop-blur">
        <div className="mx-auto max-w-4xl">
          <form onSubmit={handleSend} className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-900/5">
            <Input
              placeholder="Ask about your document..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-12 flex-1 rounded-xl border-none bg-transparent px-4 text-sm shadow-none focus-visible:ring-0"
              disabled={sendMutation.isPending || (isNew && !selectedDocumentId)}
            />
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-zinc-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-zinc-800"
              disabled={!input.trim() || sendMutation.isPending || isPolling || (isNew && !selectedDocumentId)}
            >
              <Send className="w-5 h-5 text-white" />
            </Button>
          </form>
        </div>
      </footer>
    </div>
  );
}
