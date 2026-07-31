import type { CorpusPassage } from "./types.ts";

// Full texts enter this collection only after their edition, source and rights
// metadata pass the corpus build gate. The existing 126 curated fragments remain
// regression fixtures and are deliberately not presented as full-text coverage.
export const corpusPassages: readonly CorpusPassage[] = [];
