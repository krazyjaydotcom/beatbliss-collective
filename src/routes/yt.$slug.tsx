import { createFileRoute, redirect } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  s: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/yt/$slug")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/",
      search: {
        beat: params.slug,
        play: "1",
        purchase: "1",
        utm_source: "youtube",
        utm_medium: "shorts",
        utm_campaign: params.slug,
        utm_content: search.s,
        view: "browse",
        q: "",
        genre: "all",
        bpm: "all",
        sort: "newest",
      },
      replace: true,
    });
  },
});