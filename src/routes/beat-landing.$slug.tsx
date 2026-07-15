import { createFileRoute, redirect } from "@tanstack/react-router";

// Friendly alias URL — redirects to the canonical /beats/<slug> page
// so both /beats/... and /beat-landing/... links work.
export const Route = createFileRoute("/beat-landing/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/beats/$slug", params: { slug: params.slug } });
  },
});
