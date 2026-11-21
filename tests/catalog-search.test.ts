import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCatalogQuery, rankCatalogMatches } from "../src/lib/catalog-search.ts";

const beat = (title: string, genre = "SWAC DREAMS") => ({
  title,
  genre,
  producerName: "KRAZYJAY",
  mood: null,
});
// Deliberately metadata-first, like newest-first catalog input.
const sorted = [
  beat("Hour Glass"),
  beat("SWAC Dreams Tonight"),
  beat("My SWAC Dreams"),
  beat("SWAC DREAMS"),
  beat("Showtime"),
];
const titles = (q: string, list = sorted) => rankCatalogMatches(list, q).map((b) => b.title);

test("SWAC Dreams exact title outranks the same genre regardless of case or whitespace", () => {
  for (const q of [
    "SWAC Dreams",
    "swac dreams",
    "SWAC DREAMS",
    "  sWaC   dReAmS  ",
    "\tSWAC\nDreams\t",
  ]) {
    assert.equal(titles(q)[0], "SWAC DREAMS");
  }
  assert.equal(normalizeCatalogQuery("  SWAC   Dreams "), "swac dreams");
});
test("title prefix then title contains rank before metadata", () => {
  assert.deepEqual(titles("SWAC Dreams"), [
    "SWAC DREAMS",
    "SWAC Dreams Tonight",
    "My SWAC Dreams",
    "Hour Glass",
    "Showtime",
  ]);
  assert.deepEqual(titles("swac"), [
    "SWAC Dreams Tonight",
    "SWAC DREAMS",
    "My SWAC Dreams",
    "Hour Glass",
    "Showtime",
  ]);
});
test("another title and unmatched searches return only relevant beats", () => {
  assert.deepEqual(titles("showtime"), ["Showtime"]);
  assert.deepEqual(titles("not a real title"), []);
});
test("clear and whitespace-only queries preserve the selected sort", () => {
  assert.deepEqual(rankCatalogMatches(sorted, ""), sorted);
  assert.deepEqual(rankCatalogMatches(sorted, "   "), sorted);
});
test("sort order is preserved within every relevance tier", () => {
  const alphabetical = [...sorted].sort((a, b) => a.title.localeCompare(b.title));
  assert.deepEqual(titles("swac", alphabetical), [
    "SWAC DREAMS",
    "SWAC Dreams Tonight",
    "My SWAC Dreams",
    "Hour Glass",
    "Showtime",
  ]);
  assert.deepEqual(
    titles("KRAZYJAY", alphabetical),
    alphabetical.map((b) => b.title),
  );
});
test("ranking never reintroduces a beat excluded by active filters", () => {
  const filtered = sorted.filter((b) => b.title !== "SWAC DREAMS");
  assert.equal(titles("SWAC Dreams", filtered).includes("SWAC DREAMS"), false);
  assert.deepEqual(
    titles(
      "SWAC Dreams",
      sorted.filter((b) => b.genre === "DARK MATTER"),
    ),
    [],
  );
});
