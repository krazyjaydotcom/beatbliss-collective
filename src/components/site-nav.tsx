import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-border bg-card/40">
      <div className="container mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="text-xl font-black">
            KRAZYJAY<span className="text-primary">DOTCOM</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm">
            Private access to cinematic, inspirational beats for artists with a message.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold">Membership</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#membership" className="hover:text-foreground">
                Overview
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-foreground">
                Pricing
              </a>
            </li>
            <li>
              <Link to="/login" className="hover:text-foreground">
                Member Login
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold">Support</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#contact" className="hover:text-foreground">
                Contact
              </a>
            </li>
            <li>
              <Link to="/signup" className="hover:text-foreground">
                Invite-only access
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KrazyJayDotCom. All rights reserved.
      </div>
    </footer>
  );
}
