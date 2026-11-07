import { describe, expect, it } from "vitest";
import { citationIndex, citationParts } from "./law-citations.js";

describe("citationParts", () => {
  it("links only citations that exist in an installed pack, up to the article", () => {
    const index = citationIndex([
      { jurisdiction: "ro", source: "ro-cod-civil", citations: ["Codul civil, art. 1.902"] },
      { jurisdiction: "ro", source: "ro-legea-31", citations: ["Legea nr. 31/1990, art. 69^1"] },
    ]);
    const parts = citationParts(
      "Vezi Codul civil, art. 1.902 alin. (4), Legea nr. 31/1990, art. 69^1. și Codul civil, art. 19.",
      index,
    );
    expect(parts).toEqual([
      "Vezi ",
      {
        text: "Codul civil, art. 1.902",
        target: { jurisdiction: "ro", source: "ro-cod-civil", citation: "Codul civil, art. 1.902" },
      },
      " alin. (4), ",
      {
        text: "Legea nr. 31/1990, art. 69^1",
        target: {
          jurisdiction: "ro",
          source: "ro-legea-31",
          citation: "Legea nr. 31/1990, art. 69^1",
        },
      },
      ". și Codul civil, art. 19.",
    ]);
  });
});
