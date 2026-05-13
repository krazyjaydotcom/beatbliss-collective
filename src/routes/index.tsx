import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Lock, MessageSquareText, Music4, ShieldCheck, Sparkles } from "lucide-react";
import { PublicSupportButton } from "@/components/public-support-button";

const MEMBER_PROMISES = [
  "Paid membership only",
  "No free trial",
  "No public beat browsing",
  "Private claim links for approved users",
];

const MEMBERSHIP_CARDS = [
  {
    title: "Catalog access after checkout",
    copy: "Members unlock the full catalog experience, including private drops and a direct line to KrazyJay.",
    icon: Music4,
  },
  {
    title: "Real license coverage",
    copy: "Every approved member gets the unlimited membership license and a clean path for released songs.",
    icon: ShieldCheck,
  },
  {
    title: "Support that stays close",
    copy: "Direct text support, private lessons, and member-only rollout help stay part of the offer.",
    icon: MessageSquareText,
  },
];

const MEMBER_BENEFITS = [
  "Stream 5,000+ beats inside the private catalog",
  "Download up to 25 beats every month",
  "Use the unlimited membership license for monetized releases",
  "Get direct text support and member-only course access",
];

const STUDIO_NOTES = [
  { label: "Monthly plan", value: "$37", note: "Catalog Membership" },
  { label: "Downloads", value: "25", note: "Fresh pulls every month" },
  { label: "Access", value: "Private", note: "Invite-only claim links supported" },
];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "KRAZYJAYDOTCOM - Private Catalog Membership" },
      {
        name: "description",
        content:
          "Private beat catalog membership with paid access only, no public browsing, and one-time claim links for approved members.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#05070a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.24),transparent_38%),radial-gradient(circle_at_78%_18%,rgba(59,130,246,0.20),transparent_26%),linear-gradient(180deg,#07090d_0%,#020304_100%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      </div>

      <div className="relative">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <Link to="/" className="text-xl font-black uppercase tracking-[0.2em] text-white sm:text-2xl">
              MY<span className="text-[#2f6bff]">BEAT</span>CATALOG
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-semibold uppercase tracking-[0.18em] text-white/70 md:flex">
              <a href="#membership" className="transition hover:text-white">
                Membership
              </a>
              <a href="#included" className="transition hover:text-white">
                Included
              </a>
              <a href="#invite-access" className="transition hover:text-white">
                Invite Access
              </a>
            </nav>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl border border-[#2f6bff]/70 px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:border-[#4f82ff] hover:bg-[#2f6bff]/10"
            >
              Member Login
            </Link>
          </div>
        </header>

        <section id="membership" className="border-b border-white/10 px-6 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-white/80">
                <Lock className="h-4 w-4 text-[#7aa2ff]" />
                Private membership
              </div>
              <h1 className="mt-8 max-w-4xl text-5xl font-black uppercase leading-[0.92] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                Premium access to KrazyJay's
                <span className="block text-[#2f6bff]">private beat catalog.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72 sm:text-xl">
                The public storefront stays closed. Paid members unlock the catalog, the unlimited membership license,
                and the private rollout tools that sit behind the wall.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {MEMBER_PROMISES.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/80"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#6ea0ff]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/checkout"
                  search={{ plan: "artist_monthly_v2" }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2f6bff] px-7 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#4b7eff]"
                >
                  Start membership
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-7 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  Already a member
                </Link>
              </div>

              <div className="mt-10 rounded-[28px] border border-white/10 bg-black/40 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.24em] text-white/45">Catalog membership</p>
                    <div className="mt-3 flex items-end gap-3">
                      <span className="text-6xl font-black tracking-[-0.05em]">$37</span>
                      <span className="pb-2 text-lg font-medium text-white/55">/month</span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-white/60">
                      One paid plan. No trial. Public browsing stays off until membership or an approved invite opens
                      the door.
                    </p>
                  </div>
                  <div className="grid gap-3 text-sm text-white/72 sm:grid-cols-2">
                    {MEMBER_BENEFITS.map((item) => (
                      <div key={item} className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#6ea0ff]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-8 right-16 hidden w-px bg-gradient-to-b from-transparent via-[#78a2ff] to-transparent lg:block" />
              <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,31,0.98)_0%,rgba(3,7,13,0.98)_100%)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">Studio mode</p>
                    <h2 className="mt-2 text-2xl font-black uppercase tracking-[0.08em] text-white">
                      Member access only
                    </h2>
                  </div>
                  <div className="rounded-full border border-[#2f6bff]/60 bg-[#2f6bff]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#9ab8ff]">
                    Paid wall on
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {STUDIO_NOTES.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">{item.label}</p>
                      <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{item.value}</p>
                      <p className="mt-2 text-sm text-white/55">{item.note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[28px] border border-white/10 bg-black/35 p-5">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.24em] text-white/40">
                    <span>Catalog status</span>
                    <span>Private queue</span>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between text-sm text-white/65">
                        <span>Membership gate</span>
                        <span className="text-[#7aa2ff]">Locked until checkout</span>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-white/8">
                        <div className="h-full w-[84%] rounded-full bg-gradient-to-r from-[#2f6bff] to-[#78a2ff]" />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Claim flow</p>
                        <p className="mt-3 text-sm leading-7 text-white/68">
                          Approved users receive one-time claim links and set their password before the catalog opens.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Member support</p>
                        <p className="mt-3 text-sm leading-7 text-white/68">
                          Direct outreach, licensing clarity, and whitelist help stay inside the paid member side.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="included" className="px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8fb3ff]">What members unlock</p>
              <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.04em] text-white sm:text-5xl">
                Built for artists who need access, not a public browse page.
              </h2>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {MEMBERSHIP_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2f6bff]/40 bg-[#2f6bff]/10">
                      <Icon className="h-5 w-5 text-[#7aa2ff]" />
                    </div>
                    <h3 className="mt-6 text-2xl font-bold text-white">{card.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-white/68">{card.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="invite-access" className="border-t border-white/10 px-6 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8fb3ff]">Invite access</p>
              <h2 className="mt-4 text-4xl font-black uppercase tracking-[-0.04em] text-white sm:text-5xl">
                Approved users can still get in without opening public signup.
              </h2>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/68">
                If someone pays you directly, or you want to hand-pick who gets in, the admin side can issue a private
                claim link. That link sends them to a one-time account setup flow instead of a public browse experience.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  How invite access works
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-2xl bg-white text-sm font-bold uppercase tracking-[0.18em] text-black px-6 py-3 transition hover:bg-white/90"
                >
                  Member login
                </Link>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/42">Three-step flow</p>
              <div className="mt-6 space-y-4">
                {[
                  "1. Join through the paid membership or get approved manually.",
                  "2. Receive a private claim link instead of public browse access.",
                  "3. Set your password once and enter the catalog as a member.",
                ].map((step) => (
                  <div
                    key={step}
                    className="rounded-2xl border border-white/8 bg-black/30 px-4 py-4 text-sm leading-7 text-white/70"
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 px-6 py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
            <p>KRAZYJAYDOTCOM keeps the catalog private until membership or an approved invite unlocks it.</p>
            <div className="flex items-center gap-4">
              <Link to="/login" className="transition hover:text-white">
                Already a member?
              </Link>
              <span className="text-white/20">|</span>
              <span>Check your email for a one-time claim link.</span>
            </div>
          </div>
        </footer>
      </div>

      <PublicSupportButton />
    </main>
  );
}
