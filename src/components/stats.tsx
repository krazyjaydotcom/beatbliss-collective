import { Music, Users, ShieldCheck, Clock } from "lucide-react";

const stats = [
  { icon: Music, value: "5,000+", label: "Premium Beats" },
  { icon: Users, value: "10,000+", label: "Active Members" },
  { icon: ShieldCheck, value: "100%", label: "Royalty Free" },
  { icon: Clock, value: "24/7", label: "New Content" },
];

export function Stats() {
  return (
    <section className="container mx-auto px-6 -mt-4 mb-20">
      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
