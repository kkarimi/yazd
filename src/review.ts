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

export interface YazdIssueReviewItem<
  TIssue,
  TKind extends string = "issue",
> extends YazdReviewItem<{
  issue: TIssue;
  kind: TKind;
}> {
  bucket: "recovery";
  issue: TIssue;
  key: string;
  kind: TKind;
  meetingId?: string;
}

export interface YazdPublishReviewItem<
  TDraft,
  TKind extends string = "draft",
> extends YazdReviewItem<{
  draft: TDraft;
  kind: TKind;
}> {
  bucket: "publish";
  draft: TDraft;
  key: string;
  kind: TKind;
  meetingId: string;
}

export interface YazdApprovalReviewItem<
  TRequest,
  TKind extends string = "approval-request",
> extends YazdReviewItem<{
  kind: TKind;
  request: TRequest;
}> {
  bucket: "approval";
  key: string;
  kind: TKind;
  meetingId: string;
  request: TRequest;
}

export interface YazdReviewSummary {
  approval: number;
  publish: number;
  recovery: number;
  total: number;
}

export interface BuildYazdIssueReviewItemInput<TIssue, TKind extends string = "issue"> {
  id: string;
  issue: TIssue;
  key: string;
  kind: TKind;
  meetingId?: string;
  priority: number;
  status: string;
  subtitle: string;
  summary: string;
  timestamp: string;
  title: string;
}

export interface BuildYazdPublishReviewItemInput<TDraft, TKind extends string = "draft"> {
  draft: TDraft;
  id: string;
  key: string;
  kind: TKind;
  meetingId: string;
  priority: number;
  status: string;
  subtitle: string;
  summary: string;
  timestamp: string;
  title: string;
}

export interface BuildYazdApprovalReviewItemInput<
  TRequest,
  TKind extends string = "approval-request",
> {
  id: string;
  key: string;
  kind: TKind;
  meetingId: string;
  priority: number;
  request: TRequest;
  status: string;
  subtitle: string;
  summary: string;
  timestamp: string;
  title: string;
}

export function buildYazdIssueReviewItem<TIssue, TKind extends string = "issue">(
  input: BuildYazdIssueReviewItemInput<TIssue, TKind>,
): YazdIssueReviewItem<TIssue, TKind> {
  return {
    ...input,
    bucket: "recovery",
    payload: {
      issue: input.issue,
      kind: input.kind,
    },
  };
}

export function buildYazdPublishReviewItem<TDraft, TKind extends string = "draft">(
  input: BuildYazdPublishReviewItemInput<TDraft, TKind>,
): YazdPublishReviewItem<TDraft, TKind> {
  return {
    ...input,
    bucket: "publish",
    payload: {
      draft: input.draft,
      kind: input.kind,
    },
  };
}

export function buildYazdApprovalReviewItem<TRequest, TKind extends string = "approval-request">(
  input: BuildYazdApprovalReviewItemInput<TRequest, TKind>,
): YazdApprovalReviewItem<TRequest, TKind> {
  return {
    ...input,
    bucket: "approval",
    payload: {
      kind: input.kind,
      request: input.request,
    },
  };
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

export function sortYazdReviewItems<TItem extends YazdReviewItem>(
  items: readonly TItem[],
): TItem[] {
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
