import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listHomeGalleryImages, type GalleryImage } from "@/lib/home-gallery.functions";

const ROTATE_MS = 5000;

export function HomeGallerySection() {
  const fetchImages = useServerFn(listHomeGalleryImages);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchImages().then((rows) => {
      if (!cancelled) setImages(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchImages]);

  useEffect(() => {
    if (images.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-2xl">
        {images.map((img, i) => {
          const active = i === index;
          const t = img.transition;
          let cls = "opacity-0";
          if (active) {
            if (t === "slide") cls = "opacity-100 translate-x-0";
            else if (t === "zoom") cls = "opacity-100 scale-100";
            else cls = "opacity-100"; // fade / crossfade
          } else {
            if (t === "slide") cls = "opacity-0 translate-x-8";
            else if (t === "zoom") cls = "opacity-0 scale-110";
            else cls = "opacity-0";
          }
          return (
            <img
              key={img.id}
              src={img.image_url}
              alt={img.alt ?? ""}
              loading={i === 0 ? "eager" : "lazy"}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-in-out ${cls}`}
            />
          );
        })}
      </div>
      {images.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-8 bg-primary" : "w-2 bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
