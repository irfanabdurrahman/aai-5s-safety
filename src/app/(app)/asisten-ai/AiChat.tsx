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
  const [error, setError] = useState<string | null>(null);
  const empty = useMemo(() => messages.length === 0, [messages.length]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending || !enabled) return;
    setError(null);
    setQuestion("");
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "USER", content: text }]);
    setPending(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const payload = (await response.json()) as { conversationId?: string; answer?: string; error?: string };
      if (!response.ok || !payload.answer || !payload.conversationId) throw new Error(payload.error || "Jawaban AI tidak tersedia");
      setConversationId(payload.conversationId);
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "ASSISTANT", content: payload.answer! }]);
    } catch (reason) {
      setMessages((current) => current.slice(0, -1));
      setQuestion(text);
      setError(reason instanceof Error ? reason.message : "AI Safety Assistant tidak dapat dihubungi");
    } finally {
      setPending(false);
    }
  }

  function startNewChat() {
    if (pending) return;
    setConversationId(undefined);
    setMessages([]);
    setQuestion("");
    setError(null);
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
                      <AssistantMessage content={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {pending && <div className="flex justify-start"><div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">Menganalisis data Safety5S…</div></div>}
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
