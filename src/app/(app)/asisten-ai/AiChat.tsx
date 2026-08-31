"use client";

import Link from "next/link";
import {
  FormEvent,
  Fragment,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import {
  IconAlert,
  IconPlus,
  IconSend,
  IconSparkles,
} from "@/components/icons";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
};

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "meta"; conversationId: string; model: string }
  | { type: "delta"; content: string }
  | { type: "done"; conversationId: string; model: string }
  | { type: "error"; message: string };

const EXAMPLES = [
  "Ringkas kondisi temuan safety dan risiko yang perlu diprioritaskan hari ini.",
  "Apa rekomendasi 5S untuk mengurangi temuan berulang di area produksi?",
  "Buat rencana tindak lanjut EHS untuk temuan berisiko tinggi yang masih terbuka.",
];

function InlineMarkdown({ text }: { text: string }) {
  const matcher = /(\[[^\]]+\]\((?:\/|https?:\/\/)[^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  return (
    <>
      {text.split(matcher).map((part, index) => {
        const link = part.match(/^\[([^\]]+)\]\(((?:\/|https?:\/\/)[^)]+)\)$/);
        if (link) {
          const external = link[2].startsWith("http");
          return (
            <Link
              key={index}
              href={link[2]}
              className="font-semibold text-brand underline underline-offset-2"
              {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {link[1]}
            </Link>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={index} className="rounded bg-black/5 px-1">{part.slice(1, -1)}</code>;
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2">
      {content.split("\n").map((line, index) => {
        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        const numbered = line.match(/^\s*(\d+)\.\s+(.+)$/);
        const heading = line.match(/^#{1,3}\s+(.+)$/);
        if (!line.trim()) return <div key={index} className="h-0.5" />;
        if (heading) return <p key={index} className="font-extrabold"><InlineMarkdown text={heading[1]} /></p>;
        if (bullet) return <div key={index} className="flex gap-2"><span className="font-bold text-brand">•</span><p><InlineMarkdown text={bullet[1]} /></p></div>;
        if (numbered) return <div key={index} className="flex gap-2"><span className="font-bold text-brand">{numbered[1]}.</span><p><InlineMarkdown text={numbered[2]} /></p></div>;
        return <p key={index}><InlineMarkdown text={line} /></p>;
      })}
    </div>
  );
}

export function AiChat({
  initialConversation,
  enabled,
  model,
}: {
  initialConversation: Conversation | null;
  enabled: boolean;
  model: string;
}) {
  const [conversationId, setConversationId] = useState(initialConversation?.id);
  const [messages, setMessages] = useState<Message[]>(initialConversation?.messages ?? []);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const empty = useMemo(() => messages.length === 0, [messages.length]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: pending ? "auto" : "smooth" });
  }, [messages, pending, status]);

  useEffect(() => {
    if (!pending) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending || !enabled) return;
    setError(null);
    setQuestion("");
    const requestId = Date.now();
    const assistantId = `assistant-${requestId}`;
    setMessages((current) => [...current, { id: `user-${requestId}`, role: "USER", content: text }]);
    setPending(true);
    setStatus("Mengirim pertanyaan…");
    setElapsedSeconds(0);
    setStreamingMessageId(null);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Jawaban AI tidak tersedia");
      }
      if (!response.body) throw new Error("Browser tidak menerima aliran jawaban AI");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let completed = false;

      const handleEvent = (streamEvent: StreamEvent) => {
        if (streamEvent.type === "status") {
          setStatus(streamEvent.message);
          return;
        }
        if (streamEvent.type === "meta") {
          setConversationId(streamEvent.conversationId);
          return;
        }
        if (streamEvent.type === "delta") {
          answer += streamEvent.content;
          setStreamingMessageId(assistantId);
          setMessages((current) => {
            const existing = current.findIndex((item) => item.id === assistantId);
            if (existing < 0) {
              return [
                ...current,
                { id: assistantId, role: "ASSISTANT", content: answer },
              ];
            }
            return current.map((item, index) =>
              index === existing ? { ...item, content: answer } : item,
            );
          });
          return;
        }
        if (streamEvent.type === "done") {
          completed = true;
          setConversationId(streamEvent.conversationId);
          return;
        }
        throw new Error(streamEvent.message);
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) handleEvent(JSON.parse(line) as StreamEvent);
          newline = buffer.indexOf("\n");
        }
        if (done) break;
      }
      if (buffer.trim()) handleEvent(JSON.parse(buffer) as StreamEvent);
      if (!completed || !answer.trim()) {
        throw new Error("Aliran jawaban AI berhenti sebelum selesai");
      }
    } catch (reason) {
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      setError(reason instanceof Error ? reason.message : "AI Safety Assistant tidak dapat dihubungi");
    } finally {
      setPending(false);
      setStatus(null);
      setStreamingMessageId(null);
    }
  }

  function startNewChat() {
    if (pending) return;
    setConversationId(undefined);
    setMessages([]);
    setQuestion("");
    setError(null);
    setStatus(null);
    setElapsedSeconds(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white"><IconSparkles size={19} /></span>
            <div>
              <h1 className="text-xl font-extrabold">AI Safety Assistant</h1>
              <p className="text-sm text-muted">Analisis data Safety5S dan rekomendasi EHS, lingkungan, ESG, serta 5S.</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={startNewChat} disabled={pending}>
          <IconPlus size={16} /> Chat baru
        </Button>
      </div>

      {!enabled ? (
        <Card><CardBody className="flex items-start gap-3 text-sm text-muted"><IconAlert className="mt-0.5 text-danger" size={20} />AI Safety Assistant sedang dinonaktifkan oleh Admin.</CardBody></Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardBody className="min-h-96 space-y-4 bg-background/40">
              {empty ? (
                <div className="mx-auto flex max-w-xl flex-col items-center py-12 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><IconSparkles size={28} /></span>
                  <h2 className="mt-4 text-base font-bold">Tanyakan apa pun tentang Safety5S</h2>
                  <p className="mt-1 text-sm text-muted">Assistant menggunakan data temuan dan audit terbaru sebagai konteks. Validasi rekomendasi terhadap prosedur EHS perusahaan.</p>
                  <div className="mt-5 grid w-full gap-2 text-left">
                    {EXAMPLES.map((example) => <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-xs font-medium text-foreground hover:border-brand hover:bg-brand-soft">{example}</button>)}
                  </div>
                </div>
              ) : messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "USER" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${message.role === "USER" ? "bg-brand text-white" : "border border-line bg-surface text-foreground"}`}>
                    {message.role === "ASSISTANT" ? (
                      <div aria-live={message.id === streamingMessageId ? "polite" : undefined}>
                        <AssistantMessage content={message.content} />
                        {message.id === streamingMessageId && (
                          <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-full bg-brand align-text-bottom" aria-hidden="true" />
                        )}
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {pending && status && (
                <div className="flex justify-start" role="status" aria-live="polite">
                  <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand" aria-hidden="true" />
                    <span>{status}</span>
                    <span className="tabular-nums text-[11px]">{elapsedSeconds} detik</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </CardBody>
            <form onSubmit={submit} className="border-t border-line bg-surface p-3 sm:p-4">
              {error && <p role="alert" className="mb-2 text-xs font-medium text-danger">{error}</p>}
              <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onKeyDown} placeholder="Contoh: temuan mana yang paling mendesak dan apa rekomendasi tindak lanjutnya?" className="min-h-20" disabled={pending} maxLength={4000} />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted">Engine: {model} · Jangan masukkan password atau data rahasia.</p>
                <Button type="submit" disabled={pending || !question.trim()}>{pending ? "Memproses…" : <><IconSend size={16} /> Kirim</>}</Button>
              </div>
            </form>
          </Card>
          <p className="px-1 text-xs text-muted">Rekomendasi AI adalah bantuan analisis. Keputusan keselamatan, penghentian kerja, dan tindakan darurat tetap mengikuti prosedur resmi perusahaan.</p>
        </>
      )}
    </div>
  );
}
