export type YazdReviewStatus = "generated" | "needs-review" | "approved" | "rejected";

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
