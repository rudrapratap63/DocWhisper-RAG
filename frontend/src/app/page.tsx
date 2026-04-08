import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Bot, FileText, Sparkles, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-zinc-50 overflow-hidden">
      <header className="flex h-16 items-center justify-between px-6 md:px-12 bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-zinc-900" />
          <span className="text-xl font-bold tracking-tight">DocWhisper</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="font-semibold text-zinc-600 hover:text-zinc-900">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-full px-6">
              Sign up
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative px-4">
        {/* Decorative Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

        <div className="max-w-4xl text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Document Intelligence</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-zinc-900 drop-shadow-sm leading-tight">
            Chat with your <br className="hidden md:block"/> documents instantly.
          </h1>
          
          <p className="text-xl md:text-2xl text-zinc-600 max-w-2xl mx-auto leading-relaxed">
            Upload your PDFs and let our advanced AI extract, analyze, and synthesize information for you in seconds. No more tedious reading.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link href="/signup">
              <Button size="lg" className="rounded-full h-14 px-8 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 transition-all hover:scale-105">
                Start for free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg font-semibold border-zinc-200 hover:bg-zinc-100 text-zinc-800 transition-all">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-zinc-500 text-sm border-t bg-white">
        &copy; {new Date().getFullYear()} DocWhisper Inc. All rights reserved.
      </footer>
    </div>
  );
}
