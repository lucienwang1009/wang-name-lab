export type CorpusCategory = "经" | "史" | "子" | "集" | "字书";
export type CorpusIngestionStatus = "planned" | "source-reviewed" | "ready";
export type CorpusPriority = 1 | 2 | 3;

export interface CorpusSource {
  originUrl: string;
  editionNote: string;
  rightsNote: string;
  retrievedAt: string;
  checksum?: string;
}

export interface CorpusBook {
  id: string;
  title: string;
  category: CorpusCategory;
  period: string;
  priority: CorpusPriority;
  status: CorpusIngestionStatus;
  source?: CorpusSource;
}

export interface CorpusPassage {
  id: string;
  bookId: string;
  workId: string;
  chapterId: string;
  workTitle: string;
  chapterTitle: string;
  order: number;
  text: string;
  normalizedText: string;
  sourceUrl: string;
  verificationUrl: string;
}

export interface CorpusBuildIssue {
  code: string;
  message: string;
  targetId?: string;
}

export interface CorpusBuildReport {
  schemaVersion: 1;
  catalogue: {
    totalBooks: number;
    totalPassages: number;
    totalCharacters: number;
    byCategory: Record<CorpusCategory, number>;
    byStatus: Record<CorpusIngestionStatus, number>;
  };
  blockingErrors: CorpusBuildIssue[];
  warnings: CorpusBuildIssue[];
}
