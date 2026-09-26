"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge"; import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILL_BLUE } from "@/lib/ui/fills";
import {
    listTeammates,
    getConversation,
    sendTeammateMessage, getUnreadMessageCount, markMessagesRead, type Teammate,
    type ChatMessage,
} from "@/lib/notifications/compose-actions"; const POSITION_KEY = "message-teammate-button-pos"; type Pos = { left: number; top: number }; export function MessageTeammateButton() {
    const [open, setOpen] = useState(false);
    const [teammates, setTeammates] = useState<Teammate[] | null>(null);
    const [recipientId, setRecipientId] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingThread, setLoadingThread] = useState(false);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null); const [unreadCount, setUnreadCount] = useState(0);
    const end = useRef<HTMLDivElement>(null); const [pos, setPos] = useState<Pos | null>(null); const boxRef = useRef<HTMLElement>(null); const draggingRef = useRef(false); const movedRef = useRef(false); const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0 }); useEffect(() => { try { const saved = localStorage.getItem(POSITION_KEY); if (saved) setPos(JSON.parse(saved)); } catch {} }, []); function clampToViewport(left: number, top: number): Pos { const w = boxRef.current?.offsetWidth ?? 200; const h = boxRef.current?.offsetHeight ?? 44; return { left: Math.min(Math.max(left, 0), window.innerWidth - w), top: Math.min(Math.max(top, 0), window.innerHeight - h) }; } useEffect(() => { function onResize() { setPos((current) => (current ? clampToViewport(current.left, current.top) : current)); } window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize); }, []); function onDragPointerDown(e: React.PointerEvent<HTMLElement>) { const rect = boxRef.current?.getBoundingClientRect(); if (!rect) return; draggingRef.current = true; movedRef.current = false; dragStart.current = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top }; e.currentTarget.setPointerCapture(e.pointerId); } function onDragPointerMove(e: React.PointerEvent<HTMLElement>) { if (!draggingRef.current) return; const dx = e.clientX - dragStart.current.x; const dy = e.clientY - dragStart.current.y; if (!movedRef.current && Math.hypot(dx, dy) > 4) movedRef.current = true; if (!movedRef.current) return; setPos(clampToViewport(dragStart.current.left + dx, dragStart.current.top + dy)); } function onDragPointerUp() { if (!draggingRef.current) return; draggingRef.current = false; if (!movedRef.current) return; setPos((current) => { try { if (current) localStorage.setItem(POSITION_KEY, JSON.stringify(current)); } catch {} return current; }); } useEffect(() => { if (open) return; let cancelled = false; function loadUnread() { getUnreadMessageCount().then((n) => { if (!cancelled) setUnreadCount(n); }); } loadUnread(); const interval = setInterval(loadUnread, 15000); return () => { cancelled = true; clearInterval(interval); }; }, [open]); useEffect(() => { if (open && teammates === null) {
                listTeammates().then(setTeammates);
        }
  }, [open, teammates]);

  useEffect(() => {
        if (!open || !recipientId) return; let cancelled = false; setLoadingThread(true); void markMessagesRead(recipientId); getConversation(recipientId).then((rows) => {
                if (cancelled) return;
                setMessages(rows);
                setLoadingThread(false);
        });
        const interval = setInterval(() => {
                getConversation(recipientId).then((rows) => {
                          if (!cancelled) setMessages(rows);
                });
        }, 5000);
        return () => {
                cancelled = true;
                clearInterval(interval);
        };
  }, [open, recipientId]);

  useEffect(() => {
        end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
        const text = input.trim();
        if (!text || sending || !recipientId) return;
        setInput("");
        setSendError(null);
        setSending(true);
        setMessages((m) => [...m, { fromMe: true, text, createdAt: new Date().toISOString() }]);
        const fd = new FormData();
        fd.set("recipientUserId", recipientId);
        fd.set("message", text);
        const result = await sendTeammateMessage({ error: null }, fd);
        setSending(false);
        if (result.error) setSendError(result.error);
  }

  const activeTeammate = teammates?.find((t) => t.userId === recipientId) ?? null; const posStyle = pos ? { left: pos.left, top: pos.top } : undefined; const posClass = pos ? "" : "bottom-4 left-4";

  return (
        <div className="print:hidden">
          {!open && (
                  <button ref={(el) => { boxRef.current = el; }} type="button" onPointerDown={onDragPointerDown} onPointerMove={onDragPointerMove} onPointerUp={onDragPointerUp} onClick={() => { if (movedRef.current) { movedRef.current = false; return; } setOpen(true); }} style={posStyle} className={`fixed z-50 ${posClass} cursor-grab touch-none active:cursor-grabbing ${FILL_BLUE} rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg`}>
                            Message a teammate {unreadCount > 0 && (<Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px] leading-none">{unreadCount > 9 ? "9+" : unreadCount}</Badge>)} </button>
              )}
          {open && (
                  <div ref={(el) => { boxRef.current = el; }} style={posStyle} className={`fixed z-50 ${posClass} flex h-[min(28rem,calc(100dvh-2rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border bg-background shadow-xl`}>
                            <div onPointerDown={onDragPointerDown} onPointerMove={onDragPointerMove} onPointerUp={onDragPointerUp} className="flex cursor-grab touch-none items-center justify-between gap-2 border-b px-3 pt-2.5 pb-2.5 active:cursor-grabbing">
                                        <p className="text-sm font-semibold tracking-tight">Message a teammate</p>
                                        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setOpen(false)}
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-muted-foreground hover:bg-muted"
                                                        aria-label="Close"
                                                      >
                                                      ×
                                        </button>
                            </div>
                    <div className="border-b p-2">
                      <Select value={recipientId} onValueChange={setRecipientId}>
                                      <SelectTrigger className="w-full">
                                                      <SelectValue
                                                                          placeholder={
                                                                                                teammates === null
                                                                                                  ? "Loading your team…"
                                                                                                  : teammates.length === 0
                                                                                                    ? "No other teammates yet"
                                                                                                    : "Choose a teammate"
                                                                          }
                                                                        />
                                      </SelectTrigger>
                                    <SelectContent>
                                      {(teammates ?? []).map((t) => (
                                          <SelectItem key={t.userId} value={t.userId}>
                                            {t.name}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                      </Select>
          </div>
                    <div className="flex-1 space-y-2 overflow-auto p-3 text-sm">
          {!recipientId ? (
                          <p className="text-xs text-muted-foreground">Choose a teammate to start.</p>
                        ) : loadingThread && messages.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Loading…</p>
                        ) : messages.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No messages with {activeTeammate?.name} yet — say hi.</p>
                        ) : (
                          messages.map((m, i) => (
                                            <div key={i} className={m.fromMe ? "ml-6 rounded-md bg-muted px-2 py-1" : "mr-6 text-muted-foreground"}>
                                              {m.text}
                                            </div>
                                          ))
                        )}
          {sendError && <div className="mr-6 text-xs text-destructive">Not sent: {sendError}</div>}
                    <div ref={end} />
        </div>
              <form
                className="flex gap-2 border-t p-2"
              onSubmit={(e) => {
                              e.preventDefault();
                              void send();
              }}
            >
                            <Textarea
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder={activeTeammate ? `Message ${activeTeammate.name}…` : "Choose a teammate…"}
                                            disabled={!recipientId}
                                            rows={1}
                                            className="flex-1 resize-none"
                                            onKeyDown={(e) => {
                                                              if (e.key === "Enter" && !e.shiftKey) {
                                                                                  e.preventDefault();
                                                                                  void send();
                                                              }
                                            }}
                                          />
              <button
                              type="submit"
                disabled={sending || !recipientId || !input.trim()}
              className={`shrink-0 rounded-full ${FILL_BLUE} px-4 py-2 text-sm font-semibold disabled:opacity-50`}
            >
{sending ? "…" : "Send"}
</button>
</form>
  </div>
          )}
  </div>
    );
}
