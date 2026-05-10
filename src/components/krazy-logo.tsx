export function KrazyLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight ${className}`}>
      <span className="text-foreground">KRAZYJAY</span>
      <span className="text-primary">DOTCOM</span>
    </span>
  );
}
