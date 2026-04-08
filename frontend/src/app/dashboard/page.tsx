"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileText, MessageSquare, Loader2, LogOut } from "lucide-react";

interface Document {
  id: number;
  file_name: string;
  status: string;
}

export default function DashboardPage() {
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  // redirect if not logged in
  if (!isAuthLoading && !user) {
    router.push("/login");
    return null;
  }

  const { data: documents = [], isLoading: isDocsLoading } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: () => fetchApi("/documents/"),
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) =>
      fetchApi("/documents/upload", {
        method: "POST",
        body: formData,
      }),
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      setFile(null);
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload document");
    },
  });

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

  const startChat = (docId: number) => {
    router.push(`/chat/new?documentId=${docId}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <header className="flex h-16 items-center px-4 md:px-6 bg-white border-b sticky top-0 z-10 w-full shrink-0">
        <h1 className="text-xl font-bold flex flex-1 items-center gap-2">
          <FileText className="w-6 h-6" />
          DocWhisper
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-600 hidden md:inline-block">
            {user?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={() => { logout(); router.push("/login"); }}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>Upload a PDF document to start chatting with it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <Label htmlFor="pdf">Select PDF File (Max 10MB)</Label>
                <Input 
                  id="pdf" 
                  type="file" 
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <Button type="submit" disabled={!file || uploadMutation.isPending} className="w-full md:w-auto">
                {uploadMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading</>
                ) : (
                  <><UploadCloud className="mr-2 h-4 w-4" /> Upload</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Your Documents</h2>
          {isDocsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-white shadow-sm text-zinc-500">
              No documents uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id} className="flex flex-col">
                  <CardHeader className="flex-1">
                    <CardTitle className="text-lg line-clamp-1" title={doc.file_name}>{doc.file_name}</CardTitle>
                    <CardDescription>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                        ${doc.status === 'READY' ? 'bg-green-100 text-green-800' : 
                          doc.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {doc.status}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant="default" 
                      disabled={doc.status !== 'READY'}
                      onClick={() => startChat(doc.id)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Chat
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
