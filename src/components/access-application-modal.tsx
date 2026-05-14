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

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Apply for access form">
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Close application form" onClick={() => onOpenChange(false)} />
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-primary/40 bg-[#05070c] shadow-[0_0_90px_rgba(37,99,235,0.25)] animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/70 transition hover:border-primary/60 hover:text-white"
          aria-label="Close application form"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-white/10 px-6 py-5 pr-16">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Private Access</p>
          <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">Apply For MYBEATCATALOG Access</h2>
        </div>

        <div className="relative max-h-[calc(92vh-104px)] overflow-y-auto px-4 py-4 md:px-6">
          {!scriptLoaded ? (
            <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-white/60">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading application...
            </div>
          ) : null}
          <div ref={formHostRef} className="growform-host min-h-[320px]" />
        </div>
      </div>
    </div>
  );
}