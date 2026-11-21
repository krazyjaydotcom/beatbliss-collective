type SearchableBeat = {
  title: string;
  producerName: string;
  genre: string | null;
  mood: string | null;
};

export function normalizeCatalogQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Input is already filtered and sorted; stable tiers preserve that order. */
export function rankCatalogMatches<T extends SearchableBeat>(
  beats: readonly T[],
  query: string,
): T[] {
  const q = normalizeCatalogQuery(query);
  if (!q) return [...beats];
  const exact: T[] = [];
  const prefix: T[] = [];
  const contains: T[] = [];
  const metadata: T[] = [];
  for (const beat of beats) {
    const title = normalizeCatalogQuery(beat.title);
    if (title === q) exact.push(beat);
    else if (title.startsWith(q)) prefix.push(beat);
    else if (title.includes(q)) contains.push(beat);
    else if (
      [beat.producerName, beat.genre ?? "", beat.mood ?? ""].some((value) =>
        normalizeCatalogQuery(value).includes(q),
      )
    )
      metadata.push(beat);
  }
  return [...exact, ...prefix, ...contains, ...metadata];
}
