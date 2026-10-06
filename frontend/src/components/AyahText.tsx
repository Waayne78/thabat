import { useMemo } from "react";

import { splitWords } from "@/utils/arabic";

interface Props {
  text: string;
  /** indexes of hidden words */
  hidden?: Set<number>;
  /** indexes flagged as mistakes */
  marked?: Set<number>;
  onWordClick?: (index: number) => void;
  scale?: number;
  blurred?: boolean;
  wordLabel?: (index: number, hidden: boolean) => string;
}

export function AyahText({ text, hidden, marked, onWordClick, scale = 100, blurred, wordLabel }: Props) {
  const words = useMemo(() => splitWords(text), [text]);
  return (
    <p dir="rtl" lang="ar" className={`ayah text-center transition duration-300 ${blurred ? "select-none blur-md" : ""}`} style={{ fontSize: `${(scale / 100) * 1.9}rem` }}>
      {words.map((w, i) => {
        const isHidden = hidden?.has(i) ?? false;
        const isMarked = marked?.has(i) ?? false;
        const cls = `mx-[0.12em] inline-block rounded-lg px-[0.12em] transition-all duration-300 ${
          isHidden ? "bg-sunken text-transparent [text-shadow:none] select-none" : ""} ${
          isMarked ? "bg-clay-soft text-clay underline decoration-clay decoration-2 underline-offset-[0.55em]" : ""}`;
        return onWordClick ? (
          <button key={i} type="button" className={`${cls} hover:bg-pine-soft`} onClick={() => onWordClick(i)}
            aria-label={wordLabel?.(i, isHidden) ?? `Mot ${i + 1}`} aria-pressed={isMarked}>
            {isHidden ? <span aria-hidden="true">{w}</span> : w}
          </button>
        ) : (
          <span key={i} className={cls} aria-hidden={isHidden}>{w}</span>
        );
      })}
    </p>
  );
}
