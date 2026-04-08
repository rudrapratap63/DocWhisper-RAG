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
      <div className="h-full overflow-y-auto bg-zinc-50">
        <div className="mx-auto w-full max-w-5xl p-4 md:p-8 space-y-8">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900">Start a new chat</h1>
              <p className="mt-2 text-zinc-600">Upload a PDF or pick an existing ready document before sending your first message.</p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Button type="submit" disabled={!file || uploadMutation.isPending}>
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

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Or choose from your documents</h2>

            {isDocumentsLoading ? (
              <div className="h-28 grid place-items-center text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
                No documents yet. Upload one above to begin.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc) => {
                  const normalizedStatus = doc.status?.toLowerCase();
                  const isReady = normalizedStatus === "ready";
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className="text-left rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => chooseDocument(doc.id)}
                      disabled={!isReady}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-zinc-500 shrink-0" />
                            <p className="truncate font-medium text-zinc-900">{doc.file_name}</p>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {isReady ? "Ready to chat" : normalizedStatus === "processing" ? "Processing..." : "Processing failed"}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isReady ? "bg-green-100 text-green-700" : normalizedStatus === "processing" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
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
    <div className="flex flex-col h-full bg-zinc-50">
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {isNew && selectedDocument && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Chatting with: <span className="font-medium">{selectedDocument.file_name}</span>
            </div>
          )}

          {messages.length === 0 && !isPolling && (
            <div className="text-center text-zinc-500 mt-20">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ask anything about your document.</p>
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
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-zinc prose-headings:font-semibold prose-pre:rounded-lg prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-code:before:content-none prose-code:after:content-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
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

      <footer className="bg-white border-t p-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSend} className="flex gap-2 items-center">
            <Input
              placeholder="Type your message..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 shadow-sm rounded-full bg-zinc-50 px-6 py-6"
              disabled={sendMutation.isPending || (isNew && !selectedDocumentId)}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full shadow-sm w-12 h-12 shrink-0 bg-zinc-900 hover:bg-zinc-800"
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
