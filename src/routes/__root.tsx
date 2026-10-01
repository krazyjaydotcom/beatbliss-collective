import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { PlayerProvider } from "@/components/store/player-provider";
import { CartProvider } from "@/components/store/cart-provider";
import { CartSheet } from "@/components/store/cart-sheet";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My Beat Catalog by KRAZYJAYDOTCOM" },
      { name: "description", content: "A private beat catalog experience meant to help artists find their next level of success. Apply For Access today." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "My Beat Catalog by KRAZYJAYDOTCOM" },
      { property: "og:description", content: "A private beat catalog experience meant to help artists find their next level of success. Apply For Access today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "My Beat Catalog by KRAZYJAYDOTCOM" },
      { name: "twitter:description", content: "A private beat catalog experience meant to help artists find their next level of success. Apply For Access today." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/t7mD0j65UdWJraGB5uo4JzlbwS92/social-images/social-1779420108628-6f374e0d-3192-4464-9b7d-5db977a785b0.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/t7mD0j65UdWJraGB5uo4JzlbwS92/social-images/social-1779420108628-6f374e0d-3192-4464-9b7d-5db977a785b0.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="912d6666-c50b-4581-94bb-241b61d66ea1"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){window.init_tracer=function(){try{if(window.__tracerInit)return;if(typeof Tracer!=='function')return;window.__tracerInit=true;new Tracer({websiteId:"acb3a135-f2f5-4201-90a2-cc061d907b21",async:true,debug:false});}catch(e){}};if(!document.querySelector('script[data-visitortracking-tracer]')){var s=document.createElement('script');s.src='https://app.visitortracking.com/assets/js/tracer.js';s.async=true;s.defer=true;s.setAttribute('data-visitortracking-tracer','true');document.head.appendChild(s);}})();`,
          }}
        />

      </head>
      <body>
        {children}
        <Scripts />
      </body>

    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    (window as unknown as Record<string, unknown>).init_tracer = function () {
      try {
        const w = window as unknown as Record<string, unknown>;
        if (w.__tracerInit) return;
        if (typeof w.Tracer !== "function") return;
        w.__tracerInit = true;
        new (w.Tracer as new (config: { websiteId: string; async: boolean; debug: boolean }) => unknown)({
          websiteId: "acb3a135-f2f5-4201-90a2-cc061d907b21",
          async: true,
          debug: false,
        });
      } catch (e) {
        // silently ignore tracker errors
      }
    };

    if (!document.querySelector('script[data-visitortracking-tracer]')) {
      const script = document.createElement('script');
      script.src = "https://app.visitortracking.com/assets/js/tracer.js";
      script.async = true;
      script.defer = true;
      script.dataset.visitortrackingTracer = "true";
      document.head.appendChild(script);
    }

    const w = window as unknown as Record<string, unknown>;
    if (typeof w.Tracer === "function") {
      (w.init_tracer as () => void)();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlayerProvider>
          <CartProvider>
            <Outlet />
            <CartSheet />
            <Toaster theme="dark" />
          </CartProvider>
        </PlayerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
