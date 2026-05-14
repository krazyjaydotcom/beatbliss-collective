import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

const GROWFORM_SRC = "https://embed.growform.co/client/6a062b94122a3aa549fe3414";

type AccessApplicationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AccessApplicationModal({ open, onOpenChange }: AccessApplicationModalProps) {
  const formHostRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open || !formHostRef.current) return;

    const host = formHostRef.current;
    setScriptLoaded(false);
    host.innerHTML = "";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = GROWFORM_SRC;
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setScriptLoaded(true);
    host.appendChild(script);

    return () => {
      host.innerHTML = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !formHostRef.current) return;

    const host = formHostRef.current;
    const fitEmbedToHost = () => {
      host.style.width = "100%";
      host.style.maxWidth = "100%";
      host.style.overflowX = "hidden";

      host.querySelectorAll<HTMLElement>("iframe, div, form, section, main").forEach((element) => {
        element.style.maxWidth = "100%";
        element.style.boxSizing = "border-box";
      });

      host.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
        iframe.style.display = "block";
        iframe.style.width = "100%";
        iframe.style.maxWidth = "100%";
        iframe.style.minWidth = "0";
        iframe.style.border = "0";
      });
    };

    fitEmbedToHost();
    const resizeObserver = new ResizeObserver(fitEmbedToHost);
    resizeObserver.observe(host);
    const interval = window.setInterval(fitEmbedToHost, 300);

    return () => {
      resizeObserver.disconnect();
      window.clearInterval(interval);
    };
  }, [open, scriptLoaded]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/75 px-2 py-2 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Apply for access form"
    >
      <style>{`
        .growform-modal-shell,
        .growform-modal-shell * {
          box-sizing: border-box;
        }

        .growform-host {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow-x: hidden !important;
        }

        .growform-host > *,
        .growform-host iframe,
        .growform-host form,
        .growform-host div,
        .growform-host section,
        .growform-host main {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .growform-host iframe {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          border: 0 !important;
        }

        .growform-host input,
        .growform-host select,
        .growform-host textarea,
        .growform-host button {
          max-width: 100% !important;
        }

        @media (max-width: 640px) {
          .growform-host input,
          .growform-host select,
          .growform-host textarea {
            font-size: 16px !important;
          }
        }
      `}</style>
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close application form" onClick={() => onOpenChange(false)} />
      <div className="growform-modal-shell relative my-auto max-h-[calc(100svh-1rem)] w-full max-w-[min(100%,48rem)] overflow-hidden rounded-xl border border-primary/40 bg-[#05070c] shadow-[0_0_90px_rgba(37,99,235,0.25)] animate-in fade-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white/70 transition hover:border-primary/60 hover:text-white sm:right-4 sm:top-4 sm:h-10 sm:w-10"
          aria-label="Close application form"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-white/10 px-4 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary sm:text-xs sm:tracking-[0.25em]">Private Access</p>
          <h2 className="mt-2 text-xl font-black leading-tight text-white sm:text-2xl md:text-3xl">Apply For MYBEATCATALOG Access</h2>
        </div>

        <div className="relative max-h-[calc(100svh-6.5rem)] overflow-y-auto overflow-x-hidden px-2 py-3 sm:max-h-[calc(100dvh-9rem)] sm:px-5 sm:py-4 md:px-6">
          {!scriptLoaded ? (
            <div className="flex min-h-[280px] items-center justify-center gap-3 text-sm text-white/60 sm:min-h-[320px]">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading application...
            </div>
          ) : null}
          <div ref={formHostRef} className="growform-host min-h-[280px] sm:min-h-[320px]" />
        </div>
      </div>
    </div>
  );
}