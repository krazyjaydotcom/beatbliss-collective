The `/admin/beat-landing` route exists but isn't linked in the admin sidebar (`src/routes/_authenticated/admin.tsx`), so there's no visible entry point.

## Fix

Add a nav entry to the `NAV` array in `src/routes/_authenticated/admin.tsx`:

```ts
{ to: "/admin/beat-landing", label: "Beat Landing Pages", icon: Link2 },
```

Placed near the Beats/Funnels entries so it's easy to find on both desktop sidebar and mobile dropdown.

Nothing else changes — the page, server functions, and share-link UI already exist.