"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  FileCheck2,
  AlertTriangle,
  Scale,
  Building,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Info,
  Bot,
  User,
} from "lucide-react";

export type CaseContext = {
  institutionName?: string;
  referenceNo?: string;
  programName?: string;
  studentIntake?: number;
  facultyCount?: number;
  builtUpAreaSqM?: number;
  totalLandAcres?: number;
  flaggedRules?: Array<{ ruleCode: string; ruleName: string; submittedValue: string; requiredValue: string }>;
};

type Message = {
  id: string;
  sender: "user" | "copilot";
  text: string;
  citations?: string[];
  followUps?: string[];
  timestamp: string;
};

export function AiScrutinyCopilot({
  context,
  embedded = false,
}: {
  context?: CaseContext;
  embedded?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "initial",
      sender: "copilot",
      text: context?.institutionName
        ? `Welcome to the **AICTE PramaanAI Scrutiny Desk**. I have ingested the statutory profile for **${context.institutionName}** (${context.referenceNo ?? "Current Case"}). You can ask me to draft formal deficiency notices, verify APH clauses, or generate institutional rectification roadmaps.`
        : "Welcome to the **AICTE PramaanAI Scrutiny Copilot**. I am grounded in the **AICTE Approval Process Handbook (APH 2026–27)** and statutory regulations. Ask any regulatory, scrutiny, or compliance question.",
      citations: ["AICTE APH 2026-27", "AICTE Act 1987 Section 10"],
      followUps: [
        context?.flaggedRules && context.flaggedRules.length > 0
          ? "Draft a formal statutory deficiency notice for the flagged rules."
          : "What are the core APH 2026-27 norms for Extension of Approval (EoA)?",
        "What are the mandatory cadre ratio requirements for technical institutions?",
        "What is the required unencumbered lease tenure for campus land?",
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  async function handleSend(queryText?: string) {
    const textToSend = (queryText ?? input).trim();
    if (!textToSend || isPending) return;

    setInput("");
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);

    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: textToSend,
            context: {
              institutionName: context?.institutionName,
              referenceNo: context?.referenceNo,
              programName: context?.programName,
              studentIntake: context?.studentIntake,
              facultyCount: context?.facultyCount,
              builtUpAreaSqM: context?.builtUpAreaSqM,
              totalLandAcres: context?.totalLandAcres,
            },
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to receive response from AICTE Copilot");
        }

        const data = (await res.json()) as {
          answer: string;
          citations?: string[];
          suggestedFollowUps?: string[];
        };

        const copilotMsg: Message = {
          id: `copilot-${Date.now()}`,
          sender: "copilot",
          text: data.answer,
          citations: data.citations ?? [],
          followUps: data.suggestedFollowUps ?? [],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, copilotMsg]);
      } catch (err) {
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          sender: "copilot",
          text: "I encountered a communication timeout. The rule engine remains active. Please retry your inquiry.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    });
  }

  const quickPrompts = [
    {
      label: "Draft Deficiency Notice",
      icon: AlertTriangle,
      prompt: context?.flaggedRules?.length
        ? `Draft a formal Statutory Deficiency Notice under AICTE APH Chapter II for ${context.institutionName} citing the flagged shortfalls: ${context.flaggedRules.map((r) => r.ruleCode).join(", ")}.`
        : "Draft a formal Deficiency Notice template citing APH-101 and APH-103.",
    },
    {
      label: "Remediation Roadmap",
      icon: FileCheck2,
      prompt: `Provide an executive compliance remediation roadmap for ${context?.institutionName ?? "this institution"} to cure statutory shortfalls before the regional scrutiny deadline.`,
    },
    {
      label: "Cadre & FSR Norms",
      icon: Scale,
      prompt: "Explain the AICTE APH 2026-27 norms for Faculty-Student Ratio (FSR) and cadre ratio (Professors to Associate to Assistant Professors).",
    },
    {
      label: "Land & Carpet Area Rules",
      icon: Building,
      prompt: "What are the exact land parcel and built-up area requirements per student in Rural vs Metro/Mega city locations?",
    },
  ];

  return (
    <div className={`panel overflow-hidden border border-slate-300 bg-white ${embedded ? "" : "shadow-md"}`}>
      {/* Copilot Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-navy-950 px-4 py-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-none border border-brass-400/50 bg-brass-500/20 text-brass-300">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-semibold tracking-tight text-white">
                AICTE PramaanAI Scrutiny Desk
              </span>
              <span className="border border-brass-400/40 bg-brass-400/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-label text-brass-300">
                Gemini 3 Flash
              </span>
            </div>
            <p className="text-[10px] text-navy-300">
              Grounded in Approval Process Handbook (APH 2026–27) &amp; AICTE Regulations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-300">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          <span>Statutory Intelligence Active</span>
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
        <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
          Quick Actions:
        </span>
        {quickPrompts.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              disabled={isPending}
              onClick={() => handleSend(item.prompt)}
              className="inline-flex items-center gap-1 border border-slate-300 bg-white px-2 py-1 text-[9px] font-medium text-navy-900 transition hover:border-brass-500 hover:bg-brass-50/50 hover:text-navy-950 disabled:opacity-50"
            >
              <Icon size={10} className="text-brass-700" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Messages Stream */}
      <div className="max-h-[460px] min-h-[260px] space-y-3 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.sender === "copilot" && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-navy-300 bg-navy-100 text-navy-800">
                <Bot size={12} />
              </div>
            )}
            <div
              className={`max-w-[88%] rounded-none p-3 text-[11px] leading-relaxed ${
                msg.sender === "user"
                  ? "border border-navy-800 bg-navy-900 text-white"
                  : "border border-slate-200 bg-slate-50 text-navy-950"
              }`}
            >
              {/* Message Content */}
              <div className="prose prose-sm max-w-none space-y-1.5 text-[11px] leading-relaxed text-inherit">
                {msg.text.split("\n\n").map((para, idx) => (
                  <p key={idx} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 pt-2 text-[9px]">
                  <span className="font-semibold uppercase tracking-wider text-slate-500">
                    Citations:
                  </span>
                  {msg.citations.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-0.5 border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[8px] text-navy-800"
                    >
                      <BookOpen size={8} className="text-brass-600" />
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Follow-up suggestions */}
              {msg.followUps && msg.followUps.length > 0 && (
                <div className="mt-2 border-t border-slate-200/60 pt-2">
                  <span className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
                    Recommended Follow-ups:
                  </span>
                  <div className="mt-1 flex flex-col gap-1">
                    {msg.followUps.map((fu, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSend(fu)}
                        className="flex items-center justify-between text-left text-[9px] font-medium text-navy-800 transition hover:text-brass-700 hover:underline"
                      >
                        <span>• {fu}</span>
                        <ArrowRight size={8} className="shrink-0 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div
                className={`mt-1.5 text-right font-mono text-[8px] ${
                  msg.sender === "user" ? "text-navy-300" : "text-slate-400"
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.sender === "user" && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-navy-700 bg-navy-800 text-brass-300">
                <User size={12} />
              </div>
            )}
          </div>
        ))}

        {isPending && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-navy-300 bg-navy-100 text-navy-800">
              <Bot size={12} />
            </div>
            <div className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
              <Loader2 size={11} className="animate-spin text-brass-600" />
              <span>Analyzing against AICTE APH 2026–27 norm matrices…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a regulatory question, request a deficiency draft, or check norm thresholds…"
          className="input h-9 flex-1 text-[11px]"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || input.trim().length === 0}
          className="btn btn-primary h-9 px-3 text-[10px]"
        >
          {isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <>
              Ask <Send size={11} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
