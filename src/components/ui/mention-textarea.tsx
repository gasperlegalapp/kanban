"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { activeMentionQuery, mentionToken, type Mentionable } from "@/lib/domain/mentions";

/**
 * Textarea with an @ picker: typing "@" lists teammates, and choosing one
 * inserts a mention that notifies them when the comment is posted.
 */
export function MentionTextarea({
  value,
  onChange,
  people,
  placeholder,
  className,
  disabled,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  people: Mentionable[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Ctrl/Cmd+Enter */
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const active = useMemo(() => people.filter((p) => p.isActive !== false), [people]);
  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return active.filter((p) => p.fullName.toLowerCase().split(/\s+/).some((part) => part.startsWith(q)) || p.fullName.toLowerCase().startsWith(q)).slice(0, 6);
  }, [query, active]);

  function refreshQuery(el: HTMLTextAreaElement) {
    const q = activeMentionQuery(el.value.slice(0, el.selectionStart ?? el.value.length));
    setQuery(q);
    setHighlight(0);
  }

  function pick(p: Mentionable) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@\w*$/, `@${mentionToken(p, active)} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  }

  return (
    <div className="relative flex-1">
      <textarea
        ref={ref}
        className={clsx("textarea w-full", className)}
        placeholder={placeholder ?? "Add a comment… type @ to notify someone"}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          refreshQuery(e.target);
        }}
        onClick={(e) => refreshQuery(e.currentTarget)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={(e) => {
          if (matches.length && query !== null) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (h + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => (h - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(matches[highlight]);
              return;
            }
            if (e.key === "Escape") {
              setQuery(null);
              return;
            }
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {query !== null && matches.length > 0 && (
        <ul className="absolute left-2 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border border-line bg-surface py-1 text-sm shadow-pop" role="listbox">
          {matches.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={clsx("block w-full px-3 py-1.5 text-left", i === highlight ? "bg-brand-soft text-brand" : "hover:bg-surface-2")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
              >
                {p.fullName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
