export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-border bg-card/40">
      <div className="container mx-auto grid gap-8 px-6 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-xl font-black">
            <span className="text-foreground">MY</span><span className="text-primary">BEAT</span><span className="text-foreground">CATALOG</span><sup className="ml-0.5 align-super text-[0.45em] font-bold text-foreground">™</sup>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Private membership access to cinematic, inspirational beats for artists with a message.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold">Membership</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="/checkout" className="hover:text-foreground">Apply For Access</a></li>
            <li><a href="/login" className="hover:text-foreground">Member Login</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="#contact" className="hover:text-foreground">Support</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} MYBEATCATALOG. All rights reserved.
      </div>
    </footer>
  );
}
