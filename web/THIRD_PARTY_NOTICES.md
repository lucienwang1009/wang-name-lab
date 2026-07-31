# Third-party corpus notices

## chinese-poetry/chinese-poetry

- Project: <https://github.com/chinese-poetry/chinese-poetry>
- Pinned revision: `b8594f81a89752241442f2ce267d6f66f96704ee`
- Licence declared by upstream: MIT
- Vendored licence: `corpus/vendor/chinese-poetry/LICENSE`
- Files used: 《诗经》《楚辞》《论语》《孟子》《大学》《中庸》《唐诗三百首》《宋词三百首》《古文观止》 JSON data

The ancient works themselves are in the public domain. This project relies on the upstream repository's MIT licence for its machine-readable transcription and formatting. The imported text is normalized and split into search passages, while the original display strings are retained.

The upstream README says that its data was collected from the internet and does not identify a critical edition for every file. Therefore these files are treated as a useful machine-search source, not as a definitive scholarly edition. Every result must retain a separate public-domain verification link, and important naming decisions should be checked against a reliable printed or facsimile edition.

## direct-phonology/ect-krp

- Project: <https://github.com/direct-phonology/ect-krp>
- Pinned revision: `b28fab8f54b0e3ec3ca97cc2baa8caecfe71259f`
- Licence declared by upstream: CC BY-SA 4.0
- Vendored licence: `corpus/vendor/licenses/CC-BY-SA-4.0.txt`
- Files used: 34 JSONL base-text transcriptions derived from Kanripo identifiers

ECT-KRP removes most paratext, commentary, punctuation, whitespace, and non-Han characters. This project preserves its source-unit metadata, then cuts long units into bounded search segments. Those segment boundaries are not represented as historical sentence divisions, and adjacency found only in this unpunctuated layer is not graded as a reliable A-level continuous phrase.

## 漢籍リポジトリ / Kanripo

- Project: <https://www.kanripo.org/>
- Git mirrors: <https://github.com/kr-shadow> and <https://github.com/kanripo/KR2a0012>
- Pinned revisions: recorded per collection and file in `corpus/vendor/source-lock.json`
- Licence declared by upstream: CC BY-SA 4.0
- Files used: 27 fixed transcriptions, including the separately versioned 《三国志》 series

Kanripo files can contain old commentary, prefaces, transcription marks, and machine-readable headings. The generated evidence therefore retains the KR identifier and verification URL, does not present the transcription as a modern critical edition, and conservatively treats unpunctuated adjacency as B-level evidence until checked against a punctuated edition.

## Derived corpus artefacts

The generated normalized text, aliases, indexes, and text shards that derive from ECT-KRP or Kanripo are distributed under CC BY-SA 4.0. The underlying ancient works are in the public domain; source-specific digital transcription and formatting rights remain governed by the notices above.
