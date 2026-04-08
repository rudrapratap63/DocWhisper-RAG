"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  FileUp,
  MonitorIcon,
  CircleUserRound,
  ArrowUpIcon,
  Paperclip,
  Code2,
  Palette,
  Layers,
  Rocket,
} from "lucide-react";

interface AutoResizeProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Infinity));
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

const QUICK_ACTIONS = [
  { icon: <Code2 className="h-3.5 w-3.5" />, label: "Generate Code" },
  { icon: <Rocket className="h-3.5 w-3.5" />, label: "Launch App" },
  { icon: <Layers className="h-3.5 w-3.5" />, label: "UI Components" },
  { icon: <Palette className="h-3.5 w-3.5" />, label: "Theme Ideas" },
  { icon: <CircleUserRound className="h-3.5 w-3.5" />, label: "User Dashboard" },
  { icon: <MonitorIcon className="h-3.5 w-3.5" />, label: "Landing Page" },
  { icon: <FileUp className="h-3.5 w-3.5" />, label: "Upload Docs" },
  { icon: <ImageIcon className="h-3.5 w-3.5" />, label: "Image Assets" },
];

export default function RuixenMoonChat() {
  const [message, setMessage] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 52, maxHeight: 180 });

  const hasText = message.trim().length > 0;

  return (
    <div
      className="relative flex h-screen w-full flex-col items-center overflow-hidden"
      style={{
        background: "#07070f",
      }}
    >
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        {/* Star field base */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1920&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.18,
          }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(109,40,217,0.18) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(59,130,246,0.1) 0%, transparent 60%), #07070f",
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      {/* Hero section */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center px-4 text-center">
        {/* Glow orb */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-300 text-xs font-medium mb-2 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            AI-powered · v2.0
          </div>
          <h1
            className="text-5xl md:text-6xl font-bold text-white tracking-tight"
            style={{
              textShadow: "0 0 60px rgba(139,92,246,0.4)",
              fontFamily: "'Syne', 'Inter', sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            Ruixen{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #60a5fa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AI
            </span>
          </h1>
          <p className="text-white/45 text-base md:text-lg max-w-md mx-auto leading-relaxed">
            Build something extraordinary — start with a single prompt.
          </p>
        </div>
      </div>

      {/* Bottom floating area */}
      <div className="relative w-full max-w-2xl px-4 pb-10 space-y-4">
        {/* Quick actions */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {QUICK_ACTIONS.map(({ icon, label }) => (
            <QuickAction key={label} icon={icon} label={label} onClick={() => setMessage(label)} />
          ))}
        </div>

        {/* Floating input box */}
        <div
          className="relative rounded-2xl border transition-all duration-300"
          style={{
            background: "rgba(15,15,28,0.85)",
            backdropFilter: "blur(24px)",
            borderColor: hasText ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)",
            boxShadow: hasText
              ? "0 0 0 1px rgba(139,92,246,0.2), 0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.1)"
              : "0 20px 60px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
          }}
        >
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              adjustHeight();
            }}
            placeholder="What do you want to build today?"
            className={cn(
              "w-full resize-none border-none bg-transparent px-5 pt-4 pb-2 text-[15px] leading-relaxed text-white",
              "placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
            style={{ overflow: "hidden", minHeight: 52, outline: "none" }}
          />

          <div className="flex items-center justify-between px-4 py-3">
            <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-white/35 hover:text-white/60 hover:bg-white/5 transition-all text-xs">
              <Paperclip className="h-3.5 w-3.5" />
              <span>Attach</span>
            </button>

            <button
              disabled={!hasText}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200",
                hasText
                  ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 active:scale-95"
                  : "bg-white/8 text-white/20 cursor-not-allowed"
              )}
            >
              <ArrowUpIcon className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/20">
          Ruixen may produce inaccurate results. Review important outputs.
        </p>
      </div>
    </div>
  );
}

interface QuickActionProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

function QuickAction({ icon, label, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-white/40 hover:text-white/80 border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all duration-200"
    >
      <span className="text-white/30">{icon}</span>
      {label}
    </button>
  );
}