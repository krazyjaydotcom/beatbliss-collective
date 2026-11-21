import { useEffect, useState } from "react";
import { Gift } from "lucide-react";

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export function ArtistGiftCelebration({
  originalCents,
  complete = false,
}: {
  originalCents: number;
  complete?: boolean;
}) {
  const [amount, setAmount] = useState(originalCents);
  const [burst, setBurst] = useState(!complete);
  useEffect(() => {
    if (complete) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now();
    function roll(now: number) {
      const progress = Math.min(1, Math.max(0, (now - start - 350) / 1100));
      setAmount(Math.round(originalCents * Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(roll);
    }
    if (reduced) {
      setAmount(0);
      setBurst(false);
    } else frame = requestAnimationFrame(roll);
    const timer = setTimeout(() => setBurst(false), 2800);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [originalCents, complete]);
  return (
    <section className="artist-gift relative overflow-hidden rounded-xl border border-primary/40 bg-primary/[0.07] px-3 py-3 text-center">
      <style>{`
        @keyframes gift-float { from { transform: translateY(90px) rotate(-10deg); opacity: 0; } 20% { opacity: .9; } to { transform: translateY(-200px) rotate(15deg); opacity: 0; } }
        .gift-balloon { position: absolute; bottom: 0; width: 22px; height: 28px; border-radius: 50%; animation: gift-float 2.8s ease-out both; }
        .gift-balloon::after { content: ''; position: absolute; top: 28px; left: 11px; height: 40px; border-left: 1px solid currentColor; opacity: .5; }
        @media (prefers-reduced-motion: reduce) { .gift-balloon { display: none; } }
      `}</style>
      {burst && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {["#f4bc55", "#a78bfa", "#fb7185", "#34d399", "#60a5fa", "#f4bc55"].map((color, i) => (
            <span
              key={i}
              className="gift-balloon"
              style={{
                left: `${5 + i * 17}%`,
                backgroundColor: color,
                color,
                animationDelay: `${i * 75}ms`,
              }}
            />
          ))}
        </div>
      )}
      <div className="relative">
        <Gift className="mx-auto mb-1 h-5 w-5 text-primary" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {complete ? "It's yours!" : "A surprise gift from KRAZYJAY"}
        </p>
        <h3 className="mt-1 text-lg font-semibold">
          {complete ? "Go make something great." : "This beat’s on me. 🎉"}
        </h3>
        {!complete && (
          <>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-snug text-muted-foreground">
              Since it’s your first time doing business with me, I figured I’d start things off
              right.
            </p>
            <div
              className="mt-2"
              aria-label={`Original price ${money(originalCents)}. Your total is zero dollars.`}
            >
              <p aria-hidden className="text-sm text-muted-foreground line-through">
                {money(originalCents)}
              </p>
              <p
                aria-hidden
                className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight"
              >
                {money(amount)
                  .split("")
                  .map((digit, i) =>
                    /[0-9]/.test(digit) ? (
                      <span key={i} className="inline-block h-[1em] overflow-hidden align-baseline">
                        <span
                          className="block transition-transform duration-75 motion-reduce:transition-none"
                          style={{ transform: `translateY(-${Number(digit)}em)` }}
                        >
                          {Array.from({ length: 10 }, (_, n) => (
                            <span key={n} className="block h-[1em] leading-none">
                              {n}
                            </span>
                          ))}
                        </span>
                      </span>
                    ) : (
                      <span key={i}>{digit}</span>
                    ),
                  )}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
