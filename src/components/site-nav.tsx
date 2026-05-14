import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";

type SiteNavProps = {
  onApplyForAccess?: () => void;
};

export function SiteNav({ onApplyForAccess }: SiteNavProps = {}) {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();

  return (
    <header className="absolute left-0 right-0 top-0 z-50">
      <nav className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="text-2xl font-black tracking-tight">
          <span className="text-foreground">MY</span><span className="text-primary">BEAT</span><span className="text-foreground">CATALOG</span><sup className="ml-0.5 align-super text-[0.45em] font-bold text-foreground">TM</sup>
        </Link>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              {isAdmin && (
                <Button variant="heroOutline" size="sm" asChild>
                  <Link to="/admin">Admin</Link>
                </Button>
              )}
              <Button variant="heroOutline" size="sm" asChild>
                <Link to="/account">My Account</Link>
              </Button>
              <Button variant="heroOutline" size="sm" asChild>
                <Link to="/classroom">Classroom</Link>
              </Button>
              <Button variant="hero" size="sm" asChild>
                <Link to="/beats">Beat Catalog</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="heroOutline" size="sm" asChild>
                <Link to="/login">Log In</Link>
              </Button>
              {onApplyForAccess ? (
                <Button variant="hero" size="sm" type="button" onClick={onApplyForAccess}>
                  Apply For Access
                </Button>
              ) : (
                <Button variant="hero" size="sm" asChild>
                  <Link to="/checkout">Apply For Access</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </nav>
    </header>
  );
}