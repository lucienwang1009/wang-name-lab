import type {
  CorpusBook,
  CorpusBuildIssue,
  CorpusBuildReport,
  CorpusCategory,
  CorpusIngestionStatus,
  CorpusPassage,
} from "./types.ts";

const stableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const secureUrlPattern = /^https:\/\//;

const categories: readonly CorpusCategory[] = ["经", "史", "子", "集", "字书"];
const statuses: readonly CorpusIngestionStatus[] = [
  "planned",
  "source-reviewed",
  "ready",
];

function emptyCategoryCounts(): Record<CorpusCategory, number> {
  return { 经: 0, 史: 0, 子: 0, 集: 0, 字书: 0 };
}

function emptyStatusCounts(): Record<CorpusIngestionStatus, number> {
  return { planned: 0, "source-reviewed": 0, ready: 0 };
}

function issue(
  code: string,
  message: string,
  targetId?: string,
): CorpusBuildIssue {
  return targetId ? { code, message, targetId } : { code, message };
}

function normalizeIssues(issues: CorpusBuildIssue[]): CorpusBuildIssue[] {
  const unique = new Map<string, CorpusBuildIssue>();
  for (const item of issues) {
    const key = `${item.code}|${item.targetId ?? ""}|${item.message}`;
    unique.set(key, item);
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      (left.targetId ?? "").localeCompare(right.targetId ?? "") ||
      left.message.localeCompare(right.message),
  );
}

function sourceIsComplete(book: CorpusBook): boolean {
  const source = book.source;
  return Boolean(
    source &&
      secureUrlPattern.test(source.originUrl) &&
      source.editionNote.trim() &&
      source.rightsNote.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(source.retrievedAt),
  );
}

export function buildCorpusReport({
  books,
  passages,
}: {
  books: readonly CorpusBook[];
  passages: readonly CorpusPassage[];
}): CorpusBuildReport {
  const blockingErrors: CorpusBuildIssue[] = [];
  const warnings: CorpusBuildIssue[] = [];
  const byCategory = emptyCategoryCounts();
  const byStatus = emptyStatusCounts();
  const bookIds = new Set(books.map((book) => book.id));
  const booksById = new Map(books.map((book) => [book.id, book]));
  const passageCountByBook = new Map<string, number>();
  const duplicateBookIds = new Set<string>();
  const seenBookIds = new Set<string>();

  for (const book of books) {
    byCategory[book.category] += 1;
    byStatus[book.status] += 1;

    if (seenBookIds.has(book.id)) duplicateBookIds.add(book.id);
    seenBookIds.add(book.id);

    if (!stableIdPattern.test(book.id)) {
      blockingErrors.push(
        issue("INVALID_BOOK_ID", "书籍编号必须是稳定的 kebab-case。", book.id),
      );
    }
    if (!book.title.trim()) {
      blockingErrors.push(issue("EMPTY_BOOK_TITLE", "书名不能为空。", book.id));
    }
    if (book.status === "planned" && !book.source) {
      warnings.push(
        issue(
          "PLANNED_BOOK_SOURCE_PENDING",
          "目标书目尚未完成版本、来源和授权核验。",
          book.id,
        ),
      );
    }
    if (book.status !== "planned" && !sourceIsComplete(book)) {
      blockingErrors.push(
        issue(
          book.status === "ready"
            ? "READY_BOOK_MISSING_SOURCE"
            : "REVIEWED_BOOK_MISSING_SOURCE",
          "已核验或可检索书目必须具有完整的 HTTPS 来源、版本、授权和获取日期。",
          book.id,
        ),
      );
    }
  }

  for (const duplicateId of duplicateBookIds) {
    blockingErrors.push(
      issue("DUPLICATE_BOOK_ID", "书籍编号重复。", duplicateId),
    );
  }

  const duplicatePassageIds = new Set<string>();
  const seenPassageIds = new Set<string>();
  for (const item of passages) {
    if (seenPassageIds.has(item.id)) duplicatePassageIds.add(item.id);
    seenPassageIds.add(item.id);

    if (!bookIds.has(item.bookId)) {
      blockingErrors.push(
        issue("UNKNOWN_PASSAGE_BOOK", "原句引用了不存在的书籍编号。", item.id),
      );
    }
    passageCountByBook.set(
      item.bookId,
      (passageCountByBook.get(item.bookId) ?? 0) + 1,
    );
    if (!item.normalizedText.trim()) {
      blockingErrors.push(
        issue("EMPTY_NORMALIZED_TEXT", "原句缺少可检索的规范化文本。", item.id),
      );
    }
    if (!secureUrlPattern.test(item.sourceUrl)) {
      blockingErrors.push(
        issue("PASSAGE_MISSING_SOURCE_URL", "原句缺少可核验的 HTTPS 来源。", item.id),
      );
    }
    if (!secureUrlPattern.test(item.verificationUrl)) {
      blockingErrors.push(
        issue(
          "PASSAGE_MISSING_VERIFICATION_URL",
          "原句缺少可人工复核的 HTTPS 页面。",
          item.id,
        ),
      );
    }
    const parentBook = booksById.get(item.bookId);
    if (parentBook?.source && item.sourceUrl !== parentBook.source.originUrl) {
      blockingErrors.push(
        issue(
          "PASSAGE_SOURCE_MISMATCH",
          "原句来源必须与书目中经过核验的固定来源一致。",
          item.id,
        ),
      );
    }
  }

  for (const book of books) {
    if (book.status === "ready" && !passageCountByBook.has(book.id)) {
      blockingErrors.push(
        issue(
          "READY_BOOK_WITHOUT_PASSAGES",
          "标记为 ready 的书目必须包含至少一条可检索原句。",
          book.id,
        ),
      );
    }
  }

  for (const duplicateId of duplicatePassageIds) {
    blockingErrors.push(
      issue("DUPLICATE_PASSAGE_ID", "原句编号重复。", duplicateId),
    );
  }

  for (const category of categories) byCategory[category] ??= 0;
  for (const status of statuses) byStatus[status] ??= 0;

  return {
    schemaVersion: 1,
    catalogue: {
      totalBooks: books.length,
      totalPassages: passages.length,
      totalCharacters: passages.reduce(
        (total, item) => total + [...item.normalizedText].length,
        0,
      ),
      byCategory,
      byStatus,
    },
    blockingErrors: normalizeIssues(blockingErrors),
    warnings: normalizeIssues(warnings),
  };
}
