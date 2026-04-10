export type YazdReviewStatus = "generated" | "needs-review" | "approved" | "rejected";
export type YazdReviewBucket = "recovery" | "approval" | "publish";
export type YazdReviewDecision = "approve" | "reject";
export type YazdReviewIssueSeverity = "error" | "warning" | (string & {});

export interface YazdReviewIssue {
  detail: string;
  detectedAt: string;
  id: string;
  recoverable: boolean;
  severity: YazdReviewIssueSeverity;
  title: string;
}

export interface YazdReviewDecisionInput {
  decision: YazdReviewDecision;
  note?: string;
  publishTargetId?: string;
}

export interface YazdReviewItem<TPayload = Record<string, unknown>> {
  bucket: YazdReviewBucket;
  id: string;
  payload: TPayload;
  priority: number;
  status: string;
  subtitle: string;
  summary: string;
  timestamp: string;
  title: string;
}

export interface YazdReviewSummary {
  approval: number;
  publish: number;
  recovery: number;
  total: number;
}

export function summariseYazdReviewItems(items: readonly YazdReviewItem[]): YazdReviewSummary {
  return items.reduce<YazdReviewSummary>(
    (summary, item) => {
      summary.total += 1;
      switch (item.bucket) {
        case "approval":
          summary.approval += 1;
          break;
        case "publish":
          summary.publish += 1;
          break;
        case "recovery":
          summary.recovery += 1;
          break;
      }
      return summary;
    },
    {
      approval: 0,
      publish: 0,
      recovery: 0,
      total: 0,
    },
  );
}

export function sortYazdReviewItems<TPayload>(
  items: readonly YazdReviewItem<TPayload>[],
): YazdReviewItem<TPayload>[] {
  return items
    .slice()
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        right.timestamp.localeCompare(left.timestamp) ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    );
}
