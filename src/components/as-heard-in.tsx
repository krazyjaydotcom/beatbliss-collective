export function AsHeardIn() {
  const brands = ["Spotify", "Apple Music", "YouTube", "Tidal", "Amazon Music"];
  return (
    <section className="border-t border-border bg-background py-12">
      <div className="container mx-auto px-6 text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-muted-foreground">AS HEARD IN</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-xl md:text-2xl font-bold text-muted-foreground/70">
          {brands.map((b) => (
            <span key={b} className="hover:text-foreground transition-colors">{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
