export type YazdWorkflowTrigger = "approval" | "match" | (string & {});
export type YazdWorkflowRunStatus = "completed" | "failed" | "pending" | "skipped" | (string & {});

export interface YazdWorkflowRun<TMeta = Record<string, unknown>> {
  error?: string;
  finishedAt?: string;
  id: string;
  meta?: TMeta;
  prompt?: string;
  result?: string;
  startedAt: string;
  status: YazdWorkflowRunStatus;
}

export interface YazdWorkflowWhen {
  eventKinds?: string[];
  itemIds?: string[];
  itemKinds?: string[];
  sourcePluginIds?: string[];
  tags?: string[];
  titleIncludes?: string[];
}

export interface YazdWorkflowActionDefinition {
  enabled?: boolean;
  id: string;
  kind: string;
  name?: string;
  trigger?: YazdWorkflowTrigger;
}

export interface YazdWorkflowDefinition {
  actions?: YazdWorkflowActionDefinition[];
  description?: string;
  enabled?: boolean;
  id: string;
  name: string;
  when?: YazdWorkflowWhen;
}
