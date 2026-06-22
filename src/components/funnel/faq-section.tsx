import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const FAQ = [
  {
    q: "What exactly do I get for $49.99/yr?",
    a: "You can download up to 12 beats every month from the entire MYBEATCATALOG library — including new beats added every week and members-only exclusive releases. You also get a direct messaging line to KrazyJay. This is a limited time offer.",
  },
  {
    q: "Can I monetize songs I make with these beats?",
    a: "Yes — your membership grants full monetization rights. Release on Spotify, Apple Music, YouTube, TikTok, anywhere. Keep 100% of your master royalties. Standard producer publishing credit applies (registered with your PRO).",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. One click in your account and you're out. No contracts, no cancellation fees, no surprise charges. Anything you've already downloaded is yours to keep and release.",
  },
  {
    q: "Why is there an application?",
    a: "MYBEATCATALOG is a private membership. The application keeps the catalog focused on serious artists who actually use the beats. Most applications are approved within hours.",
  },
  {
    q: "What if I'm not happy?",
    a: "Cancel anytime in one click. If something's wrong with a download or your account, message KrazyJay directly — members get a private support channel.",
  },
  {
    q: "Are the beats exclusive to me?",
    a: "No — this is a non-exclusive membership license, which is why it's $49.99/yr instead of $1,500+ per beat. If you want an exclusive lease on a specific beat, members can place bids on exclusives inside the catalog.",
  },
];

type Props = {
  onApplyForAccess: () => void;
};

export function FaqSection({ onApplyForAccess }: Props) {
  return (
    <section className="border-t border-border bg-card/40 py-16 sm:py-20">
      <div className="container mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Questions</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Before you apply.</h2>
        </div>

        <Accordion type="single" collapsible className="mt-8 w-full">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-bold hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-10 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <h3 className="text-xl font-black">Ready to unlock the full catalog?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            $49.99/yr · Limited time offer · Application reviewed in hours
          </p>
          <Button size="lg" variant="hero" type="button" onClick={onApplyForAccess} className="mt-5">
            Apply For Access
          </Button>
        </div>
      </div>
    </section>
  );
}
