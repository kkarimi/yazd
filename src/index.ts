import type { YazdReviewStatus } from "./review.ts";

export * from "./review.ts";
export * from "./workflows.ts";

export type YazdArtifactKind =
  | "note"
  | "transcript"
  | "decision"
  | "action-item"
  | "entity"
  | (string & {});

export type YazdKnowledgeBaseKind = "folder" | "obsidian-vault" | (string & {});

export type YazdPublishAction = "write" | "update" | "delete" | "noop";

export interface YazdArtifactProvenance {
  sourcePluginId: string;
  sourceItemId: string;
  reviewStatus: YazdReviewStatus;
  generatedAt?: string;
}

export interface YazdArtifact<TMeta = Record<string, unknown>> {
  id: string;
  kind: YazdArtifactKind;
  title: string;
  markdown?: string;
  text?: string;
  metadata?: TMeta;
  provenance: YazdArtifactProvenance;
}

export interface YazdStructuredSection {
  body: string;
  title: string;
}

export interface YazdStructuredActionItem<TRole = string> {
  dueDate?: string;
  owner?: string;
  ownerEmail?: string;
  ownerOriginal?: string;
  ownerRole?: TRole;
  title: string;
}

export interface YazdStructuredParticipantSummary<TRole = string> {
  actionItems: string[];
  role?: TRole;
  speaker: string;
  summary: string;
}

export interface YazdStructuredOutput<TRole = string> {
  actionItems: YazdStructuredActionItem<TRole>[];
  decisions: string[];
  followUps: string[];
  highlights: string[];
  markdown: string;
  metadata?: Record<string, unknown>;
  participantSummaries?: YazdStructuredParticipantSummary<TRole>[];
  sections: YazdStructuredSection[];
  summary?: string;
  title: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function normaliseYazdStringList(value: unknown): string[] {
  return stringArray(value)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normaliseYazdStructuredSections(value: unknown): YazdStructuredSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return undefined;
      }

      const title = stringValue(record.title).trim();
      const body = stringValue(record.body).trim();
      if (!title || !body) {
        return undefined;
      }

      return { body, title };
    })
    .filter((item): item is YazdStructuredSection => Boolean(item));
}

export function normaliseYazdStructuredActionItems<TRole = string>(
  value: unknown,
): YazdStructuredActionItem<TRole>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items = value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return undefined;
      }

      const title = stringValue(record.title).trim();
      if (!title) {
        return undefined;
      }

      const ownerRole = stringValue(record.ownerRole).trim();
      return {
        dueDate: stringValue(record.dueDate).trim() || undefined,
        owner: stringValue(record.owner).trim() || undefined,
        ownerEmail: stringValue(record.ownerEmail).trim() || undefined,
        ownerOriginal: stringValue(record.ownerOriginal).trim() || undefined,
        ownerRole: (ownerRole || undefined) as TRole | undefined,
        title,
      };
    })
    .filter((item) => Boolean(item));

  return items as YazdStructuredActionItem<TRole>[];
}

export function normaliseYazdStructuredParticipantSummaries<TRole = string>(
  value: unknown,
): YazdStructuredParticipantSummary<TRole>[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const summaries = value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return undefined;
      }

      const speaker = stringValue(record.speaker).trim();
      const summary = stringValue(record.summary).trim();
      if (!speaker || !summary) {
        return undefined;
      }

      const role = stringValue(record.role).trim();
      return {
        actionItems: normaliseYazdStringList(record.actionItems),
        role: (role || undefined) as TRole | undefined,
        speaker,
        summary,
      };
    })
    .filter((item) => Boolean(item)) as YazdStructuredParticipantSummary<TRole>[];

  return summaries.length > 0 ? summaries : undefined;
}

export interface NormaliseYazdStructuredOutputOptions<TRole = string> {
  actionItems?: (value: unknown) => YazdStructuredActionItem<TRole>[];
  fallbackTitle?: string;
  participantSummaries?: (value: unknown) => YazdStructuredParticipantSummary<TRole>[] | undefined;
}

export function normaliseYazdStructuredOutput<TRole = string>(
  value: unknown,
  options: NormaliseYazdStructuredOutputOptions<TRole> = {},
): YazdStructuredOutput<TRole> | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const title = stringValue(record.title).trim() || options.fallbackTitle?.trim() || "";
  const markdown = stringValue(record.markdown).trim();
  if (!title || !markdown) {
    return undefined;
  }

  return {
    actionItems:
      options.actionItems?.(record.actionItems) ??
      normaliseYazdStructuredActionItems(record.actionItems),
    decisions: normaliseYazdStringList(record.decisions),
    followUps: normaliseYazdStringList(record.followUps),
    highlights: normaliseYazdStringList(record.highlights),
    markdown,
    metadata: asRecord(record.metadata),
    participantSummaries:
      options.participantSummaries?.(record.participantSummaries) ??
      normaliseYazdStructuredParticipantSummaries(record.participantSummaries),
    sections: normaliseYazdStructuredSections(record.sections),
    summary: stringValue(record.summary).trim() || undefined,
    title,
  };
}

export function cloneYazdStructuredOutput<TRole>(
  structured: YazdStructuredOutput<TRole>,
): YazdStructuredOutput<TRole> {
  return {
    ...structured,
    actionItems: structured.actionItems.map((item) => ({ ...item })),
    decisions: [...structured.decisions],
    followUps: [...structured.followUps],
    highlights: [...structured.highlights],
    metadata: structured.metadata ? structuredClone(structured.metadata) : undefined,
    participantSummaries: structured.participantSummaries?.map((summary) => ({
      ...summary,
      actionItems: [...summary.actionItems],
    })),
    sections: structured.sections.map((section) => ({ ...section })),
  };
}

export interface YazdArtifactBundle {
  sourcePluginId: string;
  sourceItemId: string;
  title: string;
  updatedAt?: string;
  tags?: string[];
  url?: string;
  metadata?: Record<string, unknown>;
  artifacts: YazdArtifact[];
}

export interface YazdSourceListInput {
  cursor?: string;
  limit?: number;
  since?: string;
}

export interface YazdSourceItemSummary {
  id: string;
  title: string;
  kind?: string;
  summary?: string;
  tags?: string[];
  updatedAt?: string;
  url?: string;
}

export interface YazdSourceListResult {
  items: YazdSourceItemSummary[];
  nextCursor?: string;
}

export interface YazdSourceFetchInput {
  id: string;
}

export interface YazdSourceFetchResult {
  item: YazdSourceItemSummary;
  markdown?: string;
  text?: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

export interface YazdSourceBuildArtifactsInput {
  id: string;
}

export interface YazdSourceBuildArtifactsResult {
  bundle: YazdArtifactBundle;
}

export interface YazdSourceChange {
  id: string;
  kind: "created" | "updated" | "deleted" | (string & {});
  itemId: string;
  happenedAt?: string;
}

export interface YazdSourceChangesInput {
  cursor?: string;
  limit?: number;
  since?: string;
}

export interface YazdSourceChangesResult {
  changes: YazdSourceChange[];
  nextCursor?: string;
}

export interface YazdSourcePlugin {
  id: string;
  label: string;
  description?: string;
  list(input?: YazdSourceListInput): Promise<YazdSourceListResult>;
  fetch(input: YazdSourceFetchInput): Promise<YazdSourceFetchResult>;
  buildArtifacts(input: YazdSourceBuildArtifactsInput): Promise<YazdSourceBuildArtifactsResult>;
  listChanges?(input?: YazdSourceChangesInput): Promise<YazdSourceChangesResult>;
}

export interface YazdKnowledgeBaseRef {
  id?: string;
  name?: string;
  kind: YazdKnowledgeBaseKind;
  rootDir: string;
}

export interface YazdPublishPlanEntry {
  artifactId: string;
  artifactKind: YazdArtifactKind;
  path: string;
  action: YazdPublishAction;
  reason?: string;
}

export interface YazdKnowledgeBasePublishInput {
  knowledgeBase: YazdKnowledgeBaseRef;
  bundle: YazdArtifactBundle;
}

export interface YazdKnowledgeBasePublishPreview extends YazdKnowledgeBaseRef {
  entries: YazdPublishPlanEntry[];
}

export interface YazdKnowledgeBasePublishResult extends YazdKnowledgeBasePublishPreview {
  publishedAt: string;
}

export interface YazdKnowledgeBasePlugin {
  id: string;
  label: string;
  description?: string;
  kinds: readonly YazdKnowledgeBaseKind[];
  previewPublish(input: YazdKnowledgeBasePublishInput): Promise<YazdKnowledgeBasePublishPreview>;
  publish(input: YazdKnowledgeBasePublishInput): Promise<YazdKnowledgeBasePublishResult>;
}

export interface YazdAgentAttachment {
  id: string;
  label?: string;
  contentType?: string;
  text?: string;
}

export interface YazdAgentTask {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  attachments?: YazdAgentAttachment[];
}

export interface YazdAgentRunResult {
  markdown?: string;
  text?: string;
  structured?: Record<string, unknown>;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface YazdAgentPlugin {
  id: string;
  label: string;
  description?: string;
  run(task: YazdAgentTask): Promise<YazdAgentRunResult>;
}

export interface YazdPluginRegistryInput {
  sourcePlugins?: YazdSourcePlugin[];
  knowledgeBasePlugins?: YazdKnowledgeBasePlugin[];
  agentPlugins?: YazdAgentPlugin[];
}

function cloneSourcePlugin(plugin: YazdSourcePlugin): YazdSourcePlugin {
  return { ...plugin };
}

function cloneKnowledgeBasePlugin(plugin: YazdKnowledgeBasePlugin): YazdKnowledgeBasePlugin {
  return {
    ...plugin,
    kinds: [...plugin.kinds],
  };
}

function cloneAgentPlugin(plugin: YazdAgentPlugin): YazdAgentPlugin {
  return { ...plugin };
}

export class YazdPluginRegistry {
  readonly #sourcePlugins: Map<string, YazdSourcePlugin>;
  readonly #knowledgeBasePlugins: Map<string, YazdKnowledgeBasePlugin>;
  readonly #agentPlugins: Map<string, YazdAgentPlugin>;

  constructor(input: YazdPluginRegistryInput = {}) {
    this.#sourcePlugins = new Map(
      (input.sourcePlugins ?? []).map((plugin) => [plugin.id, cloneSourcePlugin(plugin)]),
    );
    this.#knowledgeBasePlugins = new Map(
      (input.knowledgeBasePlugins ?? []).map((plugin) => [
        plugin.id,
        cloneKnowledgeBasePlugin(plugin),
      ]),
    );
    this.#agentPlugins = new Map(
      (input.agentPlugins ?? []).map((plugin) => [plugin.id, cloneAgentPlugin(plugin)]),
    );
  }

  getSourcePlugin(id: string): YazdSourcePlugin | undefined {
    const plugin = this.#sourcePlugins.get(id);
    return plugin ? cloneSourcePlugin(plugin) : undefined;
  }

  listSourcePlugins(): YazdSourcePlugin[] {
    return [...this.#sourcePlugins.values()].map(cloneSourcePlugin);
  }

  getKnowledgeBasePlugin(id: string): YazdKnowledgeBasePlugin | undefined {
    const plugin = this.#knowledgeBasePlugins.get(id);
    return plugin ? cloneKnowledgeBasePlugin(plugin) : undefined;
  }

  listKnowledgeBasePlugins(): YazdKnowledgeBasePlugin[] {
    return [...this.#knowledgeBasePlugins.values()].map(cloneKnowledgeBasePlugin);
  }

  getAgentPlugin(id: string): YazdAgentPlugin | undefined {
    const plugin = this.#agentPlugins.get(id);
    return plugin ? cloneAgentPlugin(plugin) : undefined;
  }

  listAgentPlugins(): YazdAgentPlugin[] {
    return [...this.#agentPlugins.values()].map(cloneAgentPlugin);
  }
}

export function createYazdPluginRegistry(input: YazdPluginRegistryInput = {}): YazdPluginRegistry {
  return new YazdPluginRegistry(input);
}
