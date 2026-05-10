import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SiteNav() {
  const { user, loading } = useAuth();

  return (
    <header className="absolute top-0 left-0 right-0 z-50">
      <nav className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="text-2xl font-black tracking-tight">
          KRAZYJAY<span className="text-primary">DOTCOM</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <a href="/#beats" className="hover:text-primary transition-colors">Beats</a>
          <a href="/#membership" className="hover:text-primary transition-colors">Membership</a>
          <a href="/#about" className="hover:text-primary transition-colors">About</a>
          <a href="/#pricing" className="hover:text-primary transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <Button variant="hero" size="sm" asChild>
              <Link to="/account">My Account</Link>
            </Button>
          ) : (
            <>
              <Button variant="heroOutline" size="sm" asChild>
                <Link to="/login">Log In</Link>
              </Button>
              <Button variant="hero" size="sm" asChild>
                <Link to="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
