import { ShieldCheck, AudioLines, Tag, Swords } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "Affordable Access", desc: "Low monthly price with credits that roll over." },
  { icon: AudioLines, title: "High Quality Beats", desc: "Professionally mixed and industry ready." },
  { icon: Tag, title: "Member Perks", desc: "Unlock private beats, discounts & more." },
  { icon: Swords, title: "Built For Artists", desc: "Everything you need to create and win." },
];

export function Features() {
  return (
    <section id="about" className="container mx-auto px-6 py-20">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight">
          WHY ARTISTS CHOOSE KRAZYJAYDOTCOM
        </h2>
        <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-primary" />
      </div>
      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-card p-8 text-center hover:border-primary/50 transition-colors"
          >
            <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-5 text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
