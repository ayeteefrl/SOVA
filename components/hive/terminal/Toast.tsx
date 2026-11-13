"use client";
// A small message that eases in at the top centre of the screen, then fades out.
// Anywhere: window.dispatchEvent(new CustomEvent("terminal:toast", { detail: "Undone" }))
import { useEffect, useRef, useState } from "react";

export const toast = (text: string) => window.dispatchEvent(new CustomEvent("terminal:toast", { detail: text }));

export default function Toast() {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const [shown, setShown] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = () => timers.current.forEach(clearTimeout);
    const on = (e: Event) => {
      clear();
      setMsg({ text: String((e as CustomEvent).detail), id: Date.now() });
      // Mount first, then flip to the visible state so the transition plays.
      timers.current = [setTimeout(() => setShown(true), 15), setTimeout(() => setShown(false), 1300), setTimeout(() => setMsg(null), 1650)];
    };
    window.addEventListener("terminal:toast", on);
    return () => {
      window.removeEventListener("terminal:toast", on);
      clear();
    };
  }, []);

  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2">
      <div
        key={msg.id}
        className={`rounded-full border border-hive-line bg-hive-raised px-4 py-1.5 text-[13px] font-medium shadow-xl shadow-black/40 transition-all duration-300 ease-out ${shown ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}
      >
        {msg.text}
      </div>
    </div>
  );
}
