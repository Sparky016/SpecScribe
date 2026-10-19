"use client";

import React, { useState } from "react";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Clock,
  ExternalLink,
  HelpCircle,
  Database,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { CitationItem, RAGResponse, TimelineData } from "../lib/types";
import { askMeetingRAG, formatTimestamp } from "../lib/api";

interface RAGDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  timeline: TimelineData;
  onJumpToTimestamp: (timestampMs: number) => void;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  citations?: CitationItem[];
  timestamp: string;
}

export const RAGDrawer: React.FC<RAGDrawerProps> = ({
  isOpen,
  onClose,
  timeline,
  onJumpToTimestamp,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-welcome",
      sender: "assistant",
      text: "👋 Hello! I am the **SpecScribe Grounded RAG Agent**. Ask me anything about *why* architectural decisions were made, security vulnerabilities flagged by the AI, or specific component choices. Every explanation is grounded with clickable [MM:SS] timestamp citations that synchronize your timeline.",
      timestamp: "Just now",
    },
  ]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const suggestedQuestions = [
    "Why did we place Redis between API Gateway and Postgres?",
    "What security vulnerabilities were flagged by the AI?",
    "How does the Kafka event pipeline handle sensor telemetry?",
    "Summarize all architectural decisions and failure boundaries",
  ];

  const handleSend = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setIsLoading(true);

    try {
      const response: RAGResponse = await askMeetingRAG(
        timeline.meeting.id,
        trimmed,
        timeline
      );

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: response.answer,
        citations: response.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "Apologies, an error occurred while searching knowledge chunks. Please check your query or try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] md:w-[520px] bg-[#0c121d] border-l border-white/15 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-white/10 bg-[#0e1624] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#00FF66]/20 to-[#00E5FF]/20 border border-[#00FF66]/40 text-[#00FF66]">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Ask the Meeting RAG
              </h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30">
                pgvector (1536-dim)
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Grounded architectural retrieval with clickable timestamp citations
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close RAG Drawer (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Suggested Questions */}
      <div className="px-4 py-2.5 bg-[#090d15] border-b border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-[#00FF66]" />
          Suggested:
        </span>
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-[#00FF66]/15 hover:border-[#00FF66]/30 border border-white/10 text-gray-300 hover:text-[#00FF66] transition-colors whitespace-nowrap shrink-0"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 mb-1 px-1">
              {msg.sender === "user" ? (
                <>
                  <span>You</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-[#00FF66]" />
                  <span className="text-[#00FF66] font-semibold">SpecScribe RAG</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </>
              )}
            </div>

            <div
              className={`p-3.5 rounded-2xl max-w-[95%] text-xs leading-relaxed ${
                msg.sender === "user"
                  ? "bg-[#107C41]/30 border border-[#00FF66]/40 text-gray-100 rounded-br-sm"
                  : "bg-[#111723] border border-white/10 text-gray-200 rounded-bl-sm shadow-md"
              }`}
            >
              {/* Formatted Text with Clickable In-Text Timestamp Pills */}
              <RenderFormattedText
                text={msg.text}
                onJump={onJumpToTimestamp}
              />

              {/* Citations Block */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    <Database className="w-3 h-3 text-[#00E5FF]" />
                    Grounded Citations (Click to Jump Scrubber):
                  </span>
                  <div className="flex flex-col gap-1">
                    {msg.citations.map((c, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => onJumpToTimestamp(c.timestamp_ms)}
                        className="flex items-start gap-2 p-1.5 rounded-lg bg-black/40 hover:bg-[#00E5FF]/10 border border-white/5 hover:border-[#00E5FF]/30 text-left transition-colors group"
                      >
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#00E5FF]/20 text-[#00E5FF] font-bold group-hover:bg-[#00E5FF] group-hover:text-black transition-colors shrink-0">
                          [{c.label}]
                        </span>
                        <span className="text-[11px] text-gray-300 group-hover:text-white line-clamp-2">
                          {c.excerpt}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 animate-pulse">
            <Bot className="w-4 h-4 text-[#00FF66]" />
            <span>Embedding query & querying match_knowledge_chunks RPC...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3.5 border-t border-white/10 bg-[#0e1624]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(query);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about architectural decisions, caches, vulnerabilities..."
            className="flex-1 bg-[#080c14] border border-white/15 focus:border-[#00FF66] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="p-2.5 rounded-xl bg-[#00FF66] hover:bg-[#00e55c] disabled:opacity-40 disabled:hover:bg-[#00FF66] text-black font-semibold transition-all shadow-md"
            title="Submit Question"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

// Formatter to render Markdown-like text and turn [MM:SS] into clickable badges
function RenderFormattedText({
  text,
  onJump,
}: {
  text: string;
  onJump: (ms: number) => void;
}) {
  // Regex to split by timestamp tokens like [00:36]
  const parts = text.split(/(\[\d{2}:\d{2}\])/g);

  return (
    <div className="space-y-1.5 whitespace-pre-wrap">
      {parts.map((part, idx) => {
        const match = part.match(/\[(\d{2}):(\d{2})\]/);
        if (match) {
          const mins = parseInt(match[1], 10);
          const secs = parseInt(match[2], 10);
          const ms = (mins * 60 + secs) * 1000;
          return (
            <button
              key={idx}
              onClick={() => onJump(ms)}
              className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF] hover:text-black border border-[#00E5FF]/40 transition-colors align-baseline"
              title={`Jump scrubber to ${match[1]}:${match[2]}`}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{part}</span>
            </button>
          );
        }

        // Render bold markers
        return (
          <span key={idx} dangerouslySetInnerHTML={{ __html: renderMarkdownInline(part) }} />
        );
      })}
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdownInline(raw: string): string {
  const escaped = escapeHtml(raw);
  return escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
}
