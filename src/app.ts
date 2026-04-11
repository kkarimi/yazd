import {
  buildYazdApprovalReviewItem,
  buildYazdIssueReviewItem,
  buildYazdPublishReviewItem,
  createYazdPluginRegistry,
  normaliseYazdStructuredOutput,
  sortYazdReviewItems,
  summariseYazdReviewItems,
  type YazdAgentPlugin,
  type YazdAgentTask,
  type YazdArtifact,
  type YazdArtifactBundle,
  type YazdKnowledgeBasePlugin,
  type YazdKnowledgeBasePublishInput,
  type YazdPublishPlanEntry,
  type YazdReviewItem,
  type YazdSourceFetchResult,
  type YazdSourceItemSummary,
  type YazdSourcePlugin,
  type YazdStructuredActionItem,
  type YazdStructuredOutput,
} from "./index.ts";

export type AppPriority = 0 | 1 | 2;
export type TodoStatus = "done" | "in-progress" | "next";
export type AppReviewActionKind = "approve" | "reject" | "rerun" | "publish" | "open-settings";
export type AppReviewDecision = "approved" | "rejected";

export interface AppSettings {
  agentId: string;
  granEndpoint: string;
  knowledgeBaseKind: "folder" | "obsidian-vault";
  knowledgeBasePath: string;
}

export interface AppReviewDecisionRecord {
  actedAt: string;
  decision: AppReviewDecision;
  note?: string;
}

export interface AppPublishedRecord {
  paths: string[];
  publishedAt: string;
}

export interface AppReviewState {
  itemDecisions: Record<string, AppReviewDecisionRecord>;
  publishedItems: Record<string, AppPublishedRecord>;
}

export interface AppBootstrap {
  configPath: string;
  reviewStatePath: string;
  reviewState: AppReviewState;
  settings: AppSettings;
}

export interface AppOption {
  description: string;
  id: string;
  label: string;
}

export interface AppValidationResult {
  errors: string[];
  normalizedPath?: string;
  valid: boolean;
  warnings: string[];
}

export interface AppRuntimeStatus {
  detail: string;
  eventMode: "none" | "poll" | "sample" | "sse";
  eventsUrl?: string;
  label: string;
  state: "configured" | "error" | "planned";
}

export interface AppTodoItem {
  detail: string;
  id: string;
  priority: AppPriority;
  status: TodoStatus;
  title: string;
}

export interface AppReviewAction {
  itemId: string;
  kind: AppReviewActionKind;
  label: string;
  relatedItemIds?: string[];
  tone?: "default" | "danger" | "primary";
}

export interface AppReviewQueueItem extends YazdReviewItem {
  actions: AppReviewAction[];
}

export interface AppPublishEntry extends YazdPublishPlanEntry {
  content: string;
}

export interface AppDraftPreview {
  actionItems: Array<{
    dueDate?: string;
    owner?: string;
    title: string;
  }>;
  decisions: string[];
  markdown: string;
  sourceMarkdown: string;
  sourceTitle: string;
  summary: string;
  title: string;
}

export interface AppPublishState {
  artifactCount: number;
  publishedAt?: string;
  publishedPaths: string[];
  status: "awaiting-approval" | "published" | "ready" | "unavailable";
  title?: string;
}

export interface AppActivityItem {
  at: string;
  detail: string;
  kind: "approval" | "publish" | "rejection";
  title: string;
}

export interface AppSourceState {
  detail: string;
  status: "runtime" | "sample";
  title: string;
  updatedAt?: string;
  url?: string;
}

export interface AppSourceOption {
  id: string;
  summary?: string;
  title: string;
  updatedAt?: string;
  url?: string;
}

export interface AppDashboard {
  activityItems: AppActivityItem[];
  draftPreview?: AppDraftPreview;
  publishEntries: AppPublishEntry[];
  publishState: AppPublishState;
  reviewItems: AppReviewQueueItem[];
  runtime: AppRuntimeStatus;
  sourceOptions: AppSourceOption[];
  sourceState?: AppSourceState;
  todoItems: AppTodoItem[];
  validation?: AppValidationResult;
}

export const knowledgeBaseOptions: AppOption[] = [
  {
    description: "Publishes notes into an Obsidian vault using local paths.",
    id: "obsidian-vault",
    label: "Obsidian vault",
  },
  {
    description: "Publishes into a normal folder for plain markdown workflows.",
    id: "folder",
    label: "Folder",
  },
];

export const agentOptions: AppOption[] = [
  {
    description: "Primary writing and planning agent for Yazd workflows.",
    id: "pi",
    label: "PI Agent",
  },
];

const roadmap: AppTodoItem[] = [
  {
    detail: "A real local-first desktop shell now exists with setup and workflow surfaces.",
    id: "desktop-shell",
    priority: 0,
    status: "done",
    title: "Ship the first Tauri shell",
  },
  {
    detail: "Settings are intentionally small: vault, agent, and optional Gran runtime endpoint.",
    id: "essential-setup",
    priority: 0,
    status: "done",
    title: "Persist only essential setup",
  },
  {
    detail: "The dashboard now runs through source, agent, and knowledge-base plugins instead of hardcoded cards.",
    id: "plugin-backed-dashboard",
    priority: 1,
    status: "done",
    title: "Wire plugin-backed dashboard data",
  },
  {
    detail: "PI Agent now runs as a local plugin adapter so the selected agent actually produces a reviewable draft.",
    id: "pi-adapter",
    priority: 1,
    status: "done",
    title: "Make the PI agent operational",
  },
  {
    detail: "Gran runtime discovery, HTTP ingestion, and event-driven refresh are now first-class seams instead of a hardcoded sample-only path.",
    id: "gran-runtime",
    priority: 2,
    status: "done",
    title: "Add Gran runtime discovery and ingestion",
  },
  {
    detail: "Review rows now support approve, reject, rerun, and publish so the queue is actionable instead of informational.",
    id: "review-actions",
    priority: 2,
    status: "done",
    title: "Make review items actionable",
  },
  {
    detail: "The desktop bootstrap and review-state contract now live in one shared app module that both the UI and tests use.",
    id: "app-contract",
    priority: 2,
    status: "done",
    title: "Stabilize the shared app contract",
  },
];

const sampleMeetings = [
  {
    id: "gran:weekly-sync-2026-04-11",
    markdown: `# Weekly Sync

Nima: The first Tauri shell is running, but the landing experience should feel calmer.
Sarah: The first thing users should do is connect the vault and then review the next useful draft.
Decision: Keep the default landing screen minimal and move the dense queue into a dedicated review view.
Decision: Treat Gran as an external runtime that exposes local fetch and event seams.
Highlight: The app should reveal complexity progressively instead of surfacing every control immediately.
Action: Nima to replace mocked dashboard data with plugin-backed flows by Tuesday.
Action: PI Agent to generate a tighter approval summary for the weekly sync bundle by Wednesday.
Action: Sarah to validate the Obsidian publish plan shape against a real vault this week.
`,
    title: "Weekly Sync",
    updatedAt: "2026-04-11T09:00:00Z",
  },
  {
    id: "gran:product-review-2026-04-10",
    markdown: `# Product Review

Nima: The first-run flow feels calmer now, but source selection still needs to feel intentional.
Sarah: The app should help users decide what to review next instead of assuming the newest meeting is always right.
Decision: Add a recent source selector once the shell stays quiet by default.
Highlight: The app should make source provenance obvious without surfacing runtime internals.
Action: Nima to thread selected source identity through the dashboard this week.
Action: Sarah to review whether published paths should be directly openable from the app.
`,
    title: "Product Review",
    updatedAt: "2026-04-10T15:30:00Z",
  },
  {
    id: "gran:research-standup-2026-04-09",
    markdown: `# Research Standup

Nima: Gran should stay a boring local runtime even as Yazd becomes more capable.
Sarah: The publish flow is clearer when users can inspect both the source and the generated draft in one place.
Decision: Keep source sync outside Yazd and keep workflow review inside Yazd.
Highlight: A minimal desktop shell can still feel powerful if it preserves context between actions.
Action: PI Agent to tighten the publish-ready note structure for research standups.
Action: Nima to surface recent activity so the app remembers what happened last.
`,
    title: "Research Standup",
    updatedAt: "2026-04-09T11:15:00Z",
  },
] as const;

interface GranRuntimeInfo {
  detail: string;
  eventMode: "poll" | "sample" | "sse";
  eventsUrl?: string;
}

interface GranListPayloadItem {
  id?: string;
  kind?: string;
  markdown?: string;
  summary?: string;
  text?: string;
  title?: string;
  updatedAt?: string;
  url?: string;
}

function sortTodo(items: readonly AppTodoItem[]): AppTodoItem[] {
  return items
    .slice()
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        statusOrder(left.status) - statusOrder(right.status) ||
        left.title.localeCompare(right.title),
    );
}

function statusOrder(status: TodoStatus): number {
  switch (status) {
    case "in-progress":
      return 0;
    case "next":
      return 1;
    case "done":
      return 2;
  }
}

function findSampleMeeting(id: string) {
  return sampleMeetings.find((meeting) => meeting.id === id) ?? sampleMeetings[0];
}

export function defaultAppReviewState(): AppReviewState {
  return {
    itemDecisions: {},
    publishedItems: {},
  };
}

function cloneReviewState(state: AppReviewState): AppReviewState {
  return {
    itemDecisions: Object.fromEntries(
      Object.entries(state.itemDecisions).map(([key, value]) => [key, { ...value }]),
    ),
    publishedItems: Object.fromEntries(
      Object.entries(state.publishedItems).map(([key, value]) => [key, { ...value, paths: [...value.paths] }]),
    ),
  };
}

export function setAppReviewDecision(
  reviewState: AppReviewState,
  itemId: string,
  decision: AppReviewDecision,
  note?: string,
): AppReviewState {
  const next = cloneReviewState(reviewState);
  next.itemDecisions[itemId] = {
    actedAt: new Date().toISOString(),
    decision,
    note,
  };
  return next;
}

export function clearAppReviewItems(
  reviewState: AppReviewState,
  itemIds: readonly string[],
): AppReviewState {
  const next = cloneReviewState(reviewState);
  itemIds.forEach((itemId) => {
    delete next.itemDecisions[itemId];
    delete next.publishedItems[itemId];
  });
  return next;
}

export function markAppReviewPublished(
  reviewState: AppReviewState,
  itemId: string,
  publishedAt: string,
  paths: readonly string[],
): AppReviewState {
  const next = cloneReviewState(reviewState);
  next.publishedItems[itemId] = {
    paths: [...paths],
    publishedAt,
  };
  return next;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

async function fetchJsonCandidates<T>(
  endpoint: string,
  candidates: readonly string[],
): Promise<{ data: T; url: string }> {
  const base = normalizeEndpoint(endpoint);
  const failures: string[] = [];

  for (const candidate of candidates) {
    const url = `${base}${candidate}`;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        failures.push(`${candidate}: ${response.status}`);
        continue;
      }
      return {
        data: (await response.json()) as T,
        url,
      };
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Gran runtime request failed (${failures.join(", ") || "no candidates responded"})`);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseGranRuntimeInfo(
  endpoint: string,
  payload: unknown,
): GranRuntimeInfo {
  const record = asRecord(payload);
  const eventsUrl =
    stringValue(record?.eventsUrl) ??
    stringValue(record?.sseUrl) ??
    stringValue(record?.eventStreamUrl);

  return {
    detail:
      stringValue(record?.detail) ??
      stringValue(record?.message) ??
      `Connected to the Gran runtime at ${endpoint}.`,
    eventMode: eventsUrl ? "sse" : "poll",
    eventsUrl,
  };
}

function parseGranListResult(payload: unknown): YazdSourceItemSummary[] {
  const record = asRecord(payload);
  const itemsValue =
    (Array.isArray(record?.items) && record?.items) ||
    (Array.isArray(record?.data) && record?.data) ||
    (Array.isArray(payload) ? payload : []);

  const parsedItems: YazdSourceItemSummary[] = [];
  for (const item of itemsValue) {
    const parsed = asRecord(item);
    if (!parsed) {
      continue;
    }

    const id = stringValue(parsed.id);
    const title = stringValue(parsed.title);
    if (!id || !title) {
      continue;
    }

    parsedItems.push({
      id,
      kind: stringValue(parsed.kind),
      summary: stringValue(parsed.summary),
      title,
      updatedAt: stringValue(parsed.updatedAt),
      url: stringValue(parsed.url),
    });
  }

  return parsedItems;
}

function parseGranFetchResult(payload: unknown, fallbackItem: YazdSourceItemSummary): YazdSourceFetchResult {
  const record = asRecord(payload);
  const nestedItem = asRecord(record?.item);
  const itemRecord = nestedItem ?? record;

  return {
    item: {
      id: stringValue(itemRecord?.id) ?? fallbackItem.id,
      kind: stringValue(itemRecord?.kind) ?? fallbackItem.kind,
      summary: stringValue(itemRecord?.summary) ?? fallbackItem.summary,
      title: stringValue(itemRecord?.title) ?? fallbackItem.title,
      updatedAt: stringValue(itemRecord?.updatedAt) ?? fallbackItem.updatedAt,
      url: stringValue(itemRecord?.url) ?? fallbackItem.url,
    },
    markdown: stringValue(record?.markdown) ?? stringValue(itemRecord?.markdown),
    metadata: asRecord(record?.metadata) ?? asRecord(itemRecord?.metadata),
    text: stringValue(record?.text) ?? stringValue(itemRecord?.text),
  };
}

function sampleRuntimeInfo(endpoint: string): GranRuntimeInfo {
  if (!endpoint) {
    return {
      detail:
        "Using a built-in meeting bundle until a local Gran runtime is configured. The seam still stays local-first: fetch surfaces, events, and source-owned auth.",
      eventMode: "sample",
    };
  }

  return {
    detail: `Using local HTTP fetches against ${endpoint}. Add an event stream endpoint to enable live refresh.`,
    eventMode: "poll",
  };
}

async function readGranRuntimeInfo(endpoint: string): Promise<GranRuntimeInfo> {
  if (!endpoint) {
    return sampleRuntimeInfo(endpoint);
  }

  try {
    const { data } = await fetchJsonCandidates<Record<string, unknown>>(endpoint, [
      "/health",
      "/status",
      "/v1/health",
    ]);
    return parseGranRuntimeInfo(endpoint, data);
  } catch {
    return sampleRuntimeInfo(endpoint);
  }
}

function createGranSourcePlugin(granEndpoint: string): YazdSourcePlugin {
  return {
    description: granEndpoint
      ? `Connected to Gran runtime at ${granEndpoint}.`
      : "Built-in local sample until a Gran runtime endpoint is configured.",
    async buildArtifacts(input) {
      const fetched = await this.fetch({ id: input.id });
      return {
        bundle: {
          artifacts: [
            {
              id: `${input.id}:transcript`,
              kind: "transcript",
              markdown: fetched.markdown,
              provenance: {
                reviewStatus: "generated",
                sourceItemId: input.id,
                sourcePluginId: "gran",
              },
              title: `${fetched.item.title} transcript`,
            },
          ],
          metadata: fetched.metadata,
          sourceItemId: input.id,
          sourcePluginId: "gran",
          title: fetched.item.title,
          updatedAt: fetched.item.updatedAt,
          url: fetched.item.url,
        },
      };
    },
    async fetch(input) {
      if (!granEndpoint) {
        const meeting = findSampleMeeting(input.id);
        return {
          item: {
            id: meeting.id,
            kind: "meeting",
            summary: "Loaded from the built-in sample source until Gran is configured.",
            title: meeting.title,
            updatedAt: meeting.updatedAt,
            url: `local://gran/${meeting.id}`,
          },
          markdown: meeting.markdown,
          text: meeting.markdown,
        };
      }

      const listResult = await this.list({ limit: 1 });
      const fallbackItem =
        listResult.items.find((item) => item.id === input.id) ?? {
          id: input.id,
          title: input.id,
        };
      const { data } = await fetchJsonCandidates<Record<string, unknown>>(granEndpoint, [
        `/items/${encodeURIComponent(input.id)}`,
        `/v1/items/${encodeURIComponent(input.id)}`,
      ]);
      return parseGranFetchResult(data, fallbackItem);
    },
    id: "gran",
    label: "Gran",
    async list(input) {
      if (!granEndpoint) {
        return {
          items: sampleMeetings
            .slice(0, input?.limit ?? 5)
            .map((meeting) => ({
              id: meeting.id,
              kind: "meeting",
              summary: "A built-in meeting bundle used until a Gran runtime is connected.",
              title: meeting.title,
              updatedAt: meeting.updatedAt,
              url: `local://gran/${meeting.id}`,
            })),
        };
      }

      const limit = input?.limit ?? 5;
      const { data } = await fetchJsonCandidates<Record<string, unknown> | GranListPayloadItem[]>(
        granEndpoint,
        [`/items?limit=${limit}`, `/v1/items?limit=${limit}`],
      );
      const items = parseGranListResult(data);
      if (items.length === 0) {
        throw new Error("Gran runtime returned no source items.");
      }
      return { items };
    },
  };
}

function extractTaggedLines(text: string, prefix: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim())
    .filter(Boolean);
}

function deriveSummary(text: string): string {
  const speakerLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Za-z]+:/.test(line));
  return speakerLines.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
}

function parseActionItem(line: string): YazdStructuredActionItem {
  const match = /^(.+?) to (.+?)(?: by (.+))?$/.exec(line);
  if (!match) {
    return {
      title: line,
    };
  }

  return {
    dueDate: match[3]?.trim(),
    owner: match[1]?.trim(),
    ownerOriginal: match[1]?.trim(),
    title: match[2]?.trim() ?? line,
  };
}

function structuredFallback(title: string, text: string): YazdStructuredOutput {
  const decisions = extractTaggedLines(text, "Decision:");
  const highlights = extractTaggedLines(text, "Highlight:");
  const actions = extractTaggedLines(text, "Action:").map(parseActionItem);
  const summary = deriveSummary(text) || "Meeting bundle ready for review.";
  const sections = [
    {
      body: summary,
      title: "Summary",
    },
  ];

  if (highlights.length > 0) {
    sections.push({
      body: highlights.map((item) => `- ${item}`).join("\n"),
      title: "Highlights",
    });
  }

  if (decisions.length > 0) {
    sections.push({
      body: decisions.map((item) => `- ${item}`).join("\n"),
      title: "Decisions",
    });
  }

  if (actions.length > 0) {
    sections.push({
      body: actions
        .map((item) =>
          `- ${item.owner ? `${item.owner}: ` : ""}${item.title}${item.dueDate ? ` (${item.dueDate})` : ""}`,
        )
        .join("\n"),
      title: "Action Items",
    });
  }

  const markdown = [`# ${title}`, "", ...sections.flatMap((section) => [`## ${section.title}`, section.body, ""])]
    .join("\n")
    .trim();

  return {
    actionItems: actions,
    decisions,
    followUps: actions.map((item) => item.title),
    highlights,
    markdown,
    sections,
    summary,
    title,
  };
}

function createPiAgentPlugin(): YazdAgentPlugin {
  return {
    async run(task: YazdAgentTask) {
      const transcript = task.attachments?.find((attachment) => attachment.text)?.text ?? task.prompt;
      const sourceLabel = task.attachments?.find((attachment) => attachment.label)?.label?.replace(/ transcript$/i, "").trim();
      const structured = structuredFallback(
        sourceLabel ? `${sourceLabel} Briefing` : "Meeting Briefing",
        transcript,
      );

      return {
        markdown: structured.markdown,
        model: "pi-local-v1",
        structured: structured as unknown as Record<string, unknown>,
        text: structured.summary,
      };
    },
    description: "Local deterministic PI adapter for turning meeting bundles into reviewable drafts.",
    id: "pi",
    label: "PI Agent",
  };
}

function buildPublishEntries(
  knowledgeBaseRoot: string,
  knowledgeBaseKind: AppSettings["knowledgeBaseKind"],
  structured: YazdStructuredOutput,
): AppPublishEntry[] {
  const root = knowledgeBaseRoot.trim();
  const baseName = slugify(structured.title);
  const notePath = `${root}/Meetings/${baseName}.md`;
  const decisionsPath = `${root}/Decisions/${baseName}.md`;
  const actionsPath = `${root}/Actions/Open Actions.md`;

  const entries: AppPublishEntry[] = [
    {
      action: "write",
      artifactId: `${baseName}:note`,
      artifactKind: "note",
      content: structured.markdown,
      path: notePath,
      reason: knowledgeBaseKind === "obsidian-vault"
        ? "Create the primary reviewed note inside the vault."
        : "Create the primary reviewed note in the target folder.",
    },
  ];

  if (structured.decisions.length > 0) {
    entries.push({
      action: "write",
      artifactId: `${baseName}:decisions`,
      artifactKind: "decision",
      content: [`# ${structured.title} Decisions`, "", ...structured.decisions.map((item) => `- ${item}`)].join("\n"),
      path: decisionsPath,
      reason: "Promote reviewed decisions into a durable decision log.",
    });
  }

  if (structured.actionItems.length > 0) {
    entries.push({
      action: "update",
      artifactId: `${baseName}:actions`,
      artifactKind: "action-item",
      content: [
        "# Open Actions",
        "",
        ...structured.actionItems.map((item) =>
          `- [ ] ${item.owner ? `${item.owner}: ` : ""}${item.title}${item.dueDate ? ` (${item.dueDate})` : ""}`,
        ),
      ].join("\n"),
      path: actionsPath,
      reason: "Merge reviewed follow-ups into the shared action register.",
    });
  }

  return entries;
}

function createKnowledgeBasePlugin(kind: AppSettings["knowledgeBaseKind"]): YazdKnowledgeBasePlugin {
  return {
    description:
      kind === "obsidian-vault"
        ? "Preview and publish reviewed artifacts into an Obsidian vault."
        : "Preview and publish reviewed artifacts into a folder.",
    id: kind === "obsidian-vault" ? "obsidian" : "folder",
    kinds: [kind],
    label: kind === "obsidian-vault" ? "Obsidian" : "Folder",
    async previewPublish(input: YazdKnowledgeBasePublishInput) {
      const structured = normaliseYazdStructuredOutput(asRecord(input.bundle.metadata)?.structured, {
        fallbackTitle: input.bundle.title,
      });
      const entries = structured
        ? buildPublishEntries(input.knowledgeBase.rootDir, kind, structured)
        : [];

      return {
        ...input.knowledgeBase,
        entries,
      };
    },
    async publish(input: YazdKnowledgeBasePublishInput) {
      const preview = await this.previewPublish(input);
      return {
        ...preview,
        publishedAt: new Date().toISOString(),
      };
    },
  };
}

function buildGeneratedBundle(
  sourceBundle: YazdArtifactBundle,
  structured: YazdStructuredOutput,
  generatedAt: string,
): YazdArtifactBundle {
  const artifacts: YazdArtifact[] = [
    {
      id: `${sourceBundle.sourceItemId}:note`,
      kind: "note",
      markdown: structured.markdown,
      provenance: {
        generatedAt,
        reviewStatus: "needs-review",
        sourceItemId: sourceBundle.sourceItemId,
        sourcePluginId: sourceBundle.sourcePluginId,
      },
      title: structured.title,
    },
    ...structured.decisions.map((decision, index) => ({
      id: `${sourceBundle.sourceItemId}:decision:${index + 1}`,
      kind: "decision" as const,
      provenance: {
        generatedAt,
        reviewStatus: "needs-review" as const,
        sourceItemId: sourceBundle.sourceItemId,
        sourcePluginId: sourceBundle.sourcePluginId,
      },
      text: decision,
      title: decision,
    })),
    ...structured.actionItems.map((item, index) => ({
      id: `${sourceBundle.sourceItemId}:action:${index + 1}`,
      kind: "action-item" as const,
      metadata: {
        dueDate: item.dueDate,
        owner: item.owner,
      },
      text: item.title,
      provenance: {
        generatedAt,
        reviewStatus: "needs-review" as const,
        sourceItemId: sourceBundle.sourceItemId,
        sourcePluginId: sourceBundle.sourcePluginId,
      },
      title: item.title,
    })),
  ];

  return {
    ...sourceBundle,
    artifacts,
    metadata: {
      ...sourceBundle.metadata,
      structured,
    },
    title: structured.title,
    updatedAt: generatedAt,
  };
}

function createRuntimeStatus(
  granEndpoint: string,
  info: GranRuntimeInfo,
  error?: string,
): AppRuntimeStatus {
  if (error) {
    return {
      detail: error,
      eventMode: granEndpoint ? "poll" : info.eventMode,
      eventsUrl: info.eventsUrl,
      label: "Gran runtime",
      state: "error",
    };
  }

  return {
    detail: info.detail,
    eventMode: info.eventMode,
    eventsUrl: info.eventsUrl,
    label: "Gran runtime",
    state: granEndpoint ? "configured" : "planned",
  };
}

function withActions(
  item: YazdReviewItem,
  actions: AppReviewAction[],
): AppReviewQueueItem {
  return {
    ...item,
    actions,
  };
}

function buildActivityItems(
  reviewState: AppReviewState,
  sourceOptions: readonly AppSourceOption[],
): AppActivityItem[] {
  const sourceTitles = Object.fromEntries(sourceOptions.map((item) => [item.id, item.title]));
  const items: AppActivityItem[] = [];

  Object.entries(reviewState.itemDecisions).forEach(([itemId, record]) => {
    if (!itemId.startsWith("approval:")) {
      return;
    }

    const sourceId = itemId.slice("approval:".length);
    const sourceTitle = sourceTitles[sourceId] ?? sourceId;
    items.push({
      at: record.actedAt,
      detail:
        record.decision === "approved"
          ? `${sourceTitle} was approved and can move to publish.`
          : `${sourceTitle} was rejected and should be rerun or revised.`,
      kind: record.decision === "approved" ? "approval" : "rejection",
      title: record.decision === "approved" ? "Draft approved" : "Draft rejected",
    });
  });

  Object.entries(reviewState.publishedItems).forEach(([itemId, record]) => {
    if (!itemId.startsWith("publish:")) {
      return;
    }

    const sourceId = itemId.slice("publish:".length);
    const sourceTitle = sourceTitles[sourceId] ?? sourceId;
    items.push({
      at: record.publishedAt,
      detail: `Yazd wrote ${record.paths.length} files for ${sourceTitle}.`,
      kind: "publish",
      title: "Published to knowledge base",
    });
  });

  return items.sort((left, right) => right.at.localeCompare(left.at));
}

export async function buildDashboard(
  settings: AppSettings,
  reviewState: AppReviewState = defaultAppReviewState(),
  validation?: AppValidationResult,
  selectedSourceItemId?: string,
): Promise<AppDashboard> {
  const granEndpoint = settings.granEndpoint.trim();
  const knowledgeBasePath = settings.knowledgeBasePath.trim();
  const reviewItems: AppReviewQueueItem[] = [];
  const registry = createYazdPluginRegistry({
    agentPlugins: [createPiAgentPlugin()],
    knowledgeBasePlugins: [createKnowledgeBasePlugin("folder"), createKnowledgeBasePlugin("obsidian-vault")],
    sourcePlugins: [createGranSourcePlugin(granEndpoint)],
  });
  let activityItems: AppActivityItem[] = [];
  let publishState: AppPublishState = {
    artifactCount: 0,
    publishedPaths: [],
    status: "unavailable",
  };
  let sourceOptions: AppSourceOption[] = [];
  let sourceState: AppSourceState | undefined;

  const runtimeInfo = await readGranRuntimeInfo(granEndpoint);

  try {
    const sourcePlugin = registry.getSourcePlugin("gran");
    const agentPlugin = registry.getAgentPlugin(settings.agentId) ?? registry.getAgentPlugin("pi");
    const knowledgeBasePlugin = registry
      .listKnowledgeBasePlugins()
      .find((plugin) => plugin.kinds.includes(settings.knowledgeBaseKind));

    if (!sourcePlugin || !agentPlugin) {
      throw new Error("The dashboard runtime is missing its source or agent plugin.");
    }

    const listResult = await sourcePlugin.list({ limit: 5 });
    sourceOptions = listResult.items.map((item) => ({
      id: item.id,
      summary: item.summary,
      title: item.title,
      updatedAt: item.updatedAt,
      url: item.url && /^https?:\/\//.test(item.url) ? item.url : undefined,
    }));
    activityItems = buildActivityItems(reviewState, sourceOptions);
    const sourceItem = listResult.items.find((item) => item.id === selectedSourceItemId) ?? listResult.items[0];
    if (!sourceItem) {
      throw new Error("No source items were returned by the current source plugin.");
    }

    const fetched = await sourcePlugin.fetch({ id: sourceItem.id });
    const sourceBundle = await sourcePlugin.buildArtifacts({ id: sourceItem.id });
    const transcript = fetched.markdown ?? fetched.text ?? "";
    sourceState = {
      detail: granEndpoint
        ? `Loaded from the Gran runtime at ${granEndpoint}.`
        : "Loaded from the built-in local sample until a Gran runtime is configured.",
      status: granEndpoint ? "runtime" : "sample",
      title: sourceItem.title,
      updatedAt: sourceItem.updatedAt,
      url: fetched.item.url && /^https?:\/\//.test(fetched.item.url) ? fetched.item.url : undefined,
    };
    const agentResult = await agentPlugin.run({
      attachments: [
        {
          id: `${sourceItem.id}:transcript`,
          label: `${sourceItem.title} transcript`,
          text: transcript,
        },
      ],
      model: "pi-local-v1",
      prompt: `Review the meeting bundle for ${sourceItem.title} and prepare a concise publishable draft.`,
      systemPrompt:
        "Generate a review-ready draft with summary, highlights, decisions, and action items.",
    });

    const structured =
      normaliseYazdStructuredOutput(agentResult.structured, {
        fallbackTitle: `${sourceItem.title} Briefing`,
      }) ?? structuredFallback(`${sourceItem.title} Briefing`, transcript);

    const generatedAt = sourceItem.updatedAt ?? new Date().toISOString();
    const generatedBundle = buildGeneratedBundle(sourceBundle.bundle, structured, generatedAt);
    const approvalItemId = `approval:${sourceItem.id}`;
    const publishItemId = `publish:${sourceItem.id}`;
    const approvalRecord = reviewState.itemDecisions[approvalItemId];
    const approvalDecision = approvalRecord?.decision;
    const publishedRecord = reviewState.publishedItems[publishItemId];
    const draftPreview: AppDraftPreview = {
      actionItems: structured.actionItems.map((item) => ({
        dueDate: item.dueDate,
        owner: item.owner,
        title: item.title,
      })),
      decisions: [...structured.decisions],
      markdown: structured.markdown,
      sourceMarkdown: transcript,
      sourceTitle: sourceItem.title,
      summary: structured.summary ?? "Draft is ready for review before publishing.",
      title: structured.title,
    };

    if (validation && !validation.valid) {
      reviewItems.push(
        withActions(
          buildYazdIssueReviewItem({
            id: "validation:knowledge-base",
            issue: {
              errors: validation.errors,
              warnings: validation.warnings,
            },
            key: "validation:knowledge-base",
            kind: "validation-error",
            priority: 0,
            status: "error",
            subtitle: "knowledge base",
            summary: validation.errors.join(" "),
            timestamp: generatedAt,
            title: "Knowledge base path needs attention",
          }),
          [
            {
              itemId: "validation:knowledge-base",
              kind: "open-settings",
              label: "Open settings",
              tone: "primary",
            },
          ],
        ),
      );
    }

    if (!knowledgeBasePath) {
      reviewItems.push(
        withActions(
          buildYazdIssueReviewItem({
            id: "setup:vault",
            issue: {
              field: "knowledgeBasePath",
              sourceTitle: sourceItem.title,
            },
            key: "setup:vault",
            kind: "setup-gap",
            priority: 0,
            status: "needs-input",
            subtitle: "knowledge base",
            summary: "Pick the vault or folder Yazd should publish into before it can materialize the plan.",
            timestamp: generatedAt,
            title: "Connect a knowledge base",
          }),
          [
            {
              itemId: "setup:vault",
              kind: "open-settings",
              label: "Open settings",
              tone: "primary",
            },
          ],
        ),
      );
    }

    reviewItems.push(
      withActions(
        buildYazdApprovalReviewItem({
          id: approvalItemId,
          key: approvalItemId,
          kind: "agent-run",
          meetingId: sourceItem.id,
          priority: knowledgeBasePath ? 1 : 2,
          request: {
            agentId: agentPlugin.id,
            model: agentResult.model,
            sourceTitle: sourceItem.title,
            title: structured.title,
          },
          status:
            approvalDecision === "approved"
              ? "approved"
              : approvalDecision === "rejected"
                ? "rejected"
                : "pending",
          subtitle: `${agentPlugin.label} · ${agentResult.model ?? "local"}`,
          summary:
            approvalDecision === "approved"
              ? "Draft approved. Publishing can now proceed."
              : approvalDecision === "rejected"
                ? "Draft rejected. Rerun the agent once the source or prompt has changed."
                : structured.summary ?? "Draft is ready for human review before publishing.",
          timestamp: generatedAt,
          title: structured.title,
        }),
        approvalDecision
          ? [
              {
                itemId: approvalItemId,
                kind: "rerun",
                label: "Rerun",
                relatedItemIds: [approvalItemId, publishItemId],
              },
            ]
          : [
              {
                itemId: approvalItemId,
                kind: "approve",
                label: "Approve",
                tone: "primary",
              },
              {
                itemId: approvalItemId,
                kind: "reject",
                label: "Reject",
                tone: "danger",
              },
              {
                itemId: approvalItemId,
                kind: "rerun",
                label: "Rerun",
                relatedItemIds: [approvalItemId, publishItemId],
              },
            ],
      ),
    );

    let publishEntries: AppPublishEntry[] = [];
    if (knowledgeBasePath && validation?.valid !== false && knowledgeBasePlugin) {
      const preview = await knowledgeBasePlugin.previewPublish({
        bundle: generatedBundle,
        knowledgeBase: {
          kind: settings.knowledgeBaseKind,
          rootDir: knowledgeBasePath,
        },
      });

      publishEntries = preview.entries.map((entry) => entry as AppPublishEntry);
      const publishStatus =
        approvalDecision !== "approved"
          ? "awaiting-approval"
          : publishedRecord
            ? "published"
            : "ready";
      publishState = {
        artifactCount: publishEntries.length,
        publishedAt: publishedRecord?.publishedAt,
        publishedPaths: publishedRecord ? [...publishedRecord.paths] : [],
        status: publishStatus,
        title: structured.title,
      };

      reviewItems.push(
        withActions(
          buildYazdPublishReviewItem({
            draft: {
              agentId: agentPlugin.id,
              entryCount: publishEntries.length,
              title: structured.title,
            },
            id: publishItemId,
            key: publishItemId,
            kind: "publish-plan",
            meetingId: sourceItem.id,
            priority: approvalDecision === "approved" ? 1 : 2,
            status: publishStatus,
            subtitle: settings.knowledgeBaseKind,
            summary:
              publishStatus === "published"
                ? `Published ${publishEntries.length} files at ${publishedRecord?.publishedAt}.`
                : publishStatus === "awaiting-approval"
                  ? "Approve the draft before publishing into the knowledge base."
                  : `Previewed ${publishEntries.length} publish actions for ${structured.title}.`,
            timestamp: generatedAt,
            title: publishStatus === "published" ? "Published to knowledge base" : "Publish plan ready",
          }),
          publishStatus === "ready"
            ? [
                {
                  itemId: publishItemId,
                  kind: "publish",
                  label: "Publish",
                  tone: "primary",
                },
              ]
            : publishStatus === "published"
              ? [
                  {
                    itemId: publishItemId,
                    kind: "rerun",
                    label: "Rerun",
                    relatedItemIds: [approvalItemId, publishItemId],
                  },
                ]
              : [],
        ),
      );
    }

    if (!granEndpoint) {
      reviewItems.push(
        withActions(
          buildYazdIssueReviewItem({
            id: "runtime:gran",
            issue: {
              field: "granEndpoint",
            },
            key: "runtime:gran",
            kind: "integration-opportunity",
            priority: 2,
            status: "planned",
            subtitle: "gran runtime",
            summary:
              "The app can ingest from a local Gran runtime over HTTP today. Configure an endpoint to replace the built-in sample source.",
            timestamp: generatedAt,
            title: "Connect a real Gran runtime",
          }),
          [
            {
              itemId: "runtime:gran",
              kind: "open-settings",
              label: "Open settings",
            },
          ],
        ),
      );
    }

    return {
      activityItems,
      draftPreview,
      publishEntries,
      publishState,
      reviewItems: sortYazdReviewItems(reviewItems) as AppReviewQueueItem[],
      runtime: createRuntimeStatus(granEndpoint, runtimeInfo),
      sourceOptions,
      sourceState,
      todoItems: sortTodo(roadmap),
      validation,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reviewItems.push(
      withActions(
        buildYazdIssueReviewItem({
          id: "runtime:error",
          issue: {
            error: message,
          },
          key: "runtime:error",
          kind: "runtime-error",
          priority: 0,
          status: "error",
          subtitle: "dashboard runtime",
          summary: message,
          timestamp: new Date().toISOString(),
          title: "Dashboard runtime failed",
        }),
        [
          {
            itemId: "runtime:error",
            kind: "rerun",
            label: "Rerun",
            relatedItemIds: ["runtime:error"],
          },
          {
            itemId: "runtime:error",
            kind: "open-settings",
            label: "Open settings",
          },
        ],
      ),
    );

    return {
      activityItems: [],
      draftPreview: undefined,
      publishEntries: [],
      publishState,
      reviewItems: sortYazdReviewItems(reviewItems) as AppReviewQueueItem[],
      runtime: createRuntimeStatus(granEndpoint, runtimeInfo, message),
      sourceOptions,
      sourceState,
      todoItems: sortTodo(roadmap),
      validation,
    };
  }
}

export function describeReviewLoad(items: readonly YazdReviewItem[]): string {
  const summary = summariseYazdReviewItems(items);
  return `${summary.total} queued · ${summary.recovery} recovery · ${summary.approval} approval · ${summary.publish} publish`;
}
