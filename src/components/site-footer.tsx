export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-border bg-card/40">
      <div className="container mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="text-xl font-black">
            KRAZYJAY<span className="text-primary">DOTCOM</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm">
            Premium beats for artists and labels. Unlimited streaming, fair pricing, real results.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold">Product</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="#beats" className="hover:text-foreground">Beats</a></li>
            <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
            <li><a href="#membership" className="hover:text-foreground">Membership</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="#about" className="hover:text-foreground">About</a></li>
            <li><a href="#contact" className="hover:text-foreground">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KrazyJayDotCom. All rights reserved.
      </div>
    </footer>
  );
}
