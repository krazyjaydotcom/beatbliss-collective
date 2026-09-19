import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TIER_META, type LicenseTier } from "@/lib/licensing";

export type CartItem = {
  beatId: string;
  title: string;
  producerName: string;
  coverUrl: string | null;
  slug: string | null;
  tier: LicenseTier;
  priceCents: number;
};

type CartValue = {
  items: CartItem[];
  count: number;
  totalCents: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: CartItem) => void;
  remove: (beatId: string, tier: LicenseTier) => void;
  clear: () => void;
  has: (beatId: string, tier: LicenseTier) => boolean;
};

const CartContext = createContext<CartValue | null>(null);
const KEY = "mbc.cart.v1";

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setItems(read());
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — the cart lives for this page view only */
    }
  }, []);

  const value = useMemo<CartValue>(() => {
    const has = (beatId: string, tier: LicenseTier) =>
      items.some((i) => i.beatId === beatId && i.tier === tier);
    return {
      items,
      count: items.length,
      totalCents: items.reduce((sum, i) => sum + i.priceCents, 0),
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      has,
      add: (item) => {
        // One license per beat: adding a different tier replaces the old one.
        persist([...items.filter((i) => i.beatId !== item.beatId), item]);
        setIsOpen(true);
      },
      remove: (beatId, tier) =>
        persist(items.filter((i) => !(i.beatId === beatId && i.tier === tier))),
      clear: () => persist([]),
    };
  }, [items, isOpen, persist]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function cartItemLabel(item: CartItem) {
  return `${item.title} — ${TIER_META[item.tier].label}`;
}
