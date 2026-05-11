import { useEffect, useState } from "react";

interface Props {
  /** ISO timestamp of when the timer started */
  startedAt: string;
  /** Total duration in hours */
  durationHours?: number;
  className?: string;
}

export function CountdownTimer({ startedAt, durationHours = 12, className }: Props) {
  const endsAt = new Date(startedAt).getTime() + durationHours * 3600 * 1000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const expired = remaining === 0;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  if (expired) {
    return (
      <div className={className}>
        <p className="text-center text-sm uppercase tracking-wider text-muted-foreground">
          Special offer expired — but you can still join below
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Special offer ends in
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <Cell value={h} label="hrs" />
        <span className="text-3xl font-black text-primary">:</span>
        <Cell value={m} label="min" />
        <span className="text-3xl font-black text-primary">:</span>
        <Cell value={s} label="sec" />
      </div>
    </div>
  );
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 min-w-[72px] text-center">
        <span className="text-3xl md:text-4xl font-black tabular-nums text-foreground">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}
