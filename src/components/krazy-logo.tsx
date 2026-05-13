export function KrazyLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-start font-black tracking-tight ${className}`} aria-label="MYBEATCATALOG trademark">
      <span className="text-foreground">MY</span>
      <span className="text-primary">BEAT</span>
      <span className="text-foreground">CATALOG</span>
      <sup className="ml-0.5 align-super text-[0.45em] font-bold text-foreground">™</sup>
    </span>
  );
}
