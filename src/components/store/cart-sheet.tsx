import { useState } from "react";
import { ArrowLeft, ArrowRight, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/components/store/cart-provider";
import { formatPrice } from "@/components/store/player-provider";
import { TIER_META } from "@/lib/licensing";
import { CoverArt } from "@/components/store/cover-art";
import { InlineCheckout } from "@/components/store/inline-checkout";
import { trackPurchaseFunnel } from "@/lib/purchase-attribution";

export function CartButton() {
  const { count, open } = useCart();
  return (
    <button
      type="button"
      onClick={open}
      aria-label={count ? `Cart, ${count} license${count === 1 ? "" : "s"}` : "Cart, empty"}
      className="relative inline-flex h-10 items-center gap-2 rounded-full border border-white/12 px-3 text-xs font-medium text-foreground hover:border-primary/60 hover:text-primary sm:px-4"
    >
      <ShoppingBag className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 ? (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function CartSheet() {
  const cart = useCart();
  const [paying, setPaying] = useState(false);
  const closeCart = () => {
    setPaying(false);
    cart.close();
  };

  if (!cart.isOpen) return null;


  return (
    <div className="fixed inset-0 z-[95] flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="absolute inset-0 bg-black/70"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className="relative flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-card"
        onKeyDown={(e) => {
          if (e.key === "Escape") closeCart();
        }}
      >
        <header className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          {paying ? (
            <button
              type="button"
              onClick={() => setPaying(false)}
              className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to cart
            </button>
          ) : (
            <h2 className="text-sm font-semibold uppercase tracking-wide">Your cart</h2>
          )}
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            autoFocus
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {paying && cart.items.length > 0 ? (
            <InlineCheckout
              items={cart.items.map((i) => ({ beatId: i.beatId, tier: i.tier }))}
              onComplete={cart.clear}
            />
          ) : cart.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your cart is empty. Open any beat and add a license to buy several at once.
            </p>
          ) : (
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <li
                  key={`${item.beatId}-${item.tier}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.08] p-3"
                >
                  <CoverArt
                    src={item.coverUrl}
                    title={item.title}
                    seed={item.beatId}
                    className="h-12 w-12 shrink-0 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {TIER_META[item.tier].label} · {item.producerName}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPrice(item.priceCents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => cart.remove(item.beatId, item.tier)}
                    aria-label={`Remove ${item.title}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.items.length > 0 && !paying ? (
          <div className="shrink-0 space-y-3 border-t border-white/[0.08] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                {cart.count} license{cart.count === 1 ? "" : "s"}
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatPrice(cart.totalCents)}
              </span>
            </div>
            <button
              type="button"
               onClick={() => {
                 cart.items.forEach((item) => trackPurchaseFunnel("buy_now_clicked", item.beatId, item.tier));
                 setPaying(true);
               }}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
            >
              Checkout
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeCart}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Pay right here — your music keeps playing.
            </p>
            <button
              type="button"
              onClick={cart.clear}
              className="w-full text-center text-xs text-muted-foreground underline underline-offset-4"
            >
              Empty cart
            </button>
          </div>
        ) : null}

      </aside>
    </div>
  );
}
