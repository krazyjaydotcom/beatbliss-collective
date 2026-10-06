export type PurchaseLicenseRef = {
  id: string;
  beat_id: string | null;
  stripe_session_id: string | null;
};

/** A repeated purchase is a different contract. Never substitute by email or session alone. */
export function matchPurchaseLicense<T extends PurchaseLicenseRef>(
  order: { beat_id: string | null; stripe_session_id: string | null },
  licenses: T[],
): T | null {
  if (!order.beat_id || !order.stripe_session_id) return null;
  const matches = licenses.filter(
    (license) =>
      license.beat_id === order.beat_id && license.stripe_session_id === order.stripe_session_id,
  );
  return matches.length === 1 ? matches[0] : null;
}
