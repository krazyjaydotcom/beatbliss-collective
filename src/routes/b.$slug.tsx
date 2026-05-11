import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getFunnelBySlug, submitFunnelLead } from "@/lib/funnels.functions";
import { FunnelView, type FunnelContent } from "@/components/funnel/FunnelView";

export const Route = createFileRoute("/b/$slug")({
  loader: async ({ params }) => {
    const result = await getFunnelBySlug({ data: { slug: params.slug } });
    return result;
  },
  head: ({ loaderData }) => {
    const f = loaderData?.funnel;
    return {
      meta: [
        { title: f ? `${f.title} — KRAZYJAY` : "My Beat Catalog — KRAZYJAYDOTCOM" },
        {
          name: "description",
          content: f?.headline ?? "Private access to cinematic, inspirational beats for artists with a message.",
        },
      ],
    };
  },
  component: BeatLandingPage,
});

function BeatLandingPage() {
  const { funnel } = Route.useLoaderData();
  const submit = useServerFn(submitFunnelLead);
  const navigate = useNavigate();
  const params = Route.useParams();

  if (!funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Beat not found</h1>
          <p className="mt-2 text-muted-foreground">This link is no longer active.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <FunnelView
      funnel={funnel}
      content={funnel.content as FunnelContent}
      onEmailSubmit={async (email) => {
        const res = await submit({ data: { slug: params.slug, email } });
        if (!res.ok) throw new Error(res.error ?? "Something went wrong. Please try again.");
        navigate({
          to: "/b/$slug/offer",
          params: { slug: params.slug },
          search: { e: email, t: res.captured_at ?? new Date().toISOString() },
        });
      }}
    />
  );
}
