import { Download, Music4, MessageCircle, Shield, Zap, Crown } from "lucide-react";

const ITEMS = [
  {
    icon: Download,
    title: "Unlimited Downloads",
    body: "Full WAV + MP3 stems. Pay once a month, take everything you need.",
  },
  {
    icon: Music4,
    title: "Fresh Beats Weekly",
    body: "New drops every week — exclusive members-only releases you won't hear anywhere else.",
  },
  {
    icon: MessageCircle,
    title: "Direct Line To KrazyJay",
    body: "Members get a private message channel for custom requests and feedback.",
  },
  {
    icon: Crown,
    title: "Full Monetization Rights",
    body: "Release on Spotify, Apple Music, and every platform. Keep 100% of your masters.",
  },
  {
    icon: Zap,
    title: "Instant Access",
    body: "Approved in minutes. Start downloading and recording the same day.",
  },
  {
    icon: Shield,
    title: "Cancel Anytime",
    body: "No contracts, no commitments. One click to cancel — keep what you've downloaded.",
  },
];

export function WhatYouGet() {
  return (
    <section className="border-t border-border bg-card/40 py-16 sm:py-20">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">What's Included</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
            Everything you need to drop your next hit.
          </h2>
          <p className="mt-3 text-muted-foreground">
            One membership. The whole catalog. No per-beat fees, no upsells.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card/70 p-5 transition hover:border-primary/40 hover:bg-card"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-black">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
