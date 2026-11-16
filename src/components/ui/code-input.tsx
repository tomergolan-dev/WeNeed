"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

/**
 * A one-time code shown as separate boxes, one per digit. A single real input
 * sits on top of the boxes, so typing, pasting and the phone's "from
 * Messages/Mail" autofill all work as in a normal field. onComplete runs once
 * all digits are in.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Back in the field after a check, e.g. to type again after a wrong code.
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  return (
    <div dir="ltr" className="relative">
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        // readOnly rather than disabled, so the field keeps focus while a code is checked.
        readOnly={disabled}
        autoFocus
        aria-invalid={invalid || undefined}
        className="absolute inset-0 z-10 w-full cursor-text opacity-0"
      />
      <div aria-hidden className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
        {Array.from({ length }, (_, i) => {
          const active = focused && !disabled && i === Math.min(value.length, length - 1);
          return (
            <div
              key={i}
              className={cn(
                "flex h-14 items-center justify-center rounded-2xl border bg-card text-2xl font-bold tabular-nums transition-colors",
                value[i] && "border-foreground/25",
                active && "border-2 border-primary",
                invalid && "border-destructive",
                disabled && "opacity-60",
              )}
            >
              {value[i] ?? (active ? <span className="h-6 w-0.5 animate-pulse rounded-full bg-primary" /> : null)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
