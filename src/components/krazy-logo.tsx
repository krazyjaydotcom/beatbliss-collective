export function KrazyLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight ${className}`}>
      <span className="text-foreground">My</span>
      <span className="text-primary">Beat</span>
      <span className="text-foreground">Catalog</span>
    </span>
  );
}
