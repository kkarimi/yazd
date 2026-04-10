export type YazdWorkflowTrigger = "approval" | "match" | (string & {});
export type YazdWorkflowRunStatus = "completed" | "failed" | "pending" | "skipped" | (string & {});
export type YazdWebhookPayloadFormat = "json" | "markdown" | "text" | (string & {});
export type YazdWriteFileFormat = "json" | "markdown" | "text" | (string & {});

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

export interface YazdWorkflowActionBase extends YazdWorkflowActionDefinition {
  id: string;
}

export interface YazdWorkflowNamedAction extends YazdWorkflowActionBase {
  name?: string;
}

export interface YazdTriggeredWorkflowAction extends YazdWorkflowActionBase {
  sourceActionId?: string;
  trigger?: YazdWorkflowTrigger;
}

export interface YazdAskUserWorkflowAction extends YazdWorkflowActionBase {
  details?: string;
  kind: "ask-user";
  prompt: string;
}

export interface YazdCommandWorkflowAction extends YazdTriggeredWorkflowAction {
  args?: string[];
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  kind: "command";
  stdin?: "json" | "none";
  timeoutMs?: number;
}

export interface YazdWebhookWorkflowAction extends YazdTriggeredWorkflowAction {
  bodyTemplate?: string;
  headers?: Record<string, string>;
  kind: "webhook";
  method?: string;
  payload?: YazdWebhookPayloadFormat;
  url?: string;
  urlEnv?: string;
}

export interface YazdSlackMessageWorkflowAction extends YazdTriggeredWorkflowAction {
  kind: "slack-message";
  text?: string;
  webhookUrl?: string;
  webhookUrlEnv?: string;
}

export interface YazdWriteFileWorkflowAction extends YazdTriggeredWorkflowAction {
  contentTemplate?: string;
  filenameTemplate?: string;
  format?: YazdWriteFileFormat;
  kind: "write-file";
  outputDir: string;
  overwrite?: boolean;
}

export function yazdWorkflowActionName(
  action: Pick<YazdWorkflowNamedAction, "id" | "name">,
): string {
  return action.name || action.id;
}

export function buildYazdWorkflowRunId(matchId: string, actionId: string): string {
  return `${matchId}:${actionId}`;
}

export function buildYazdApprovalWorkflowRunId(subjectId: string, actionId: string): string {
  return `approval:${subjectId}:${actionId}`;
}

export function completeYazdWorkflowRun<TRun extends YazdWorkflowRun>(
  run: TRun,
  finishedAt: string,
  patch: Partial<TRun> = {},
): TRun {
  return {
    ...run,
    ...patch,
    finishedAt,
    status: "completed",
  };
}

export function failYazdWorkflowRun<TRun extends YazdWorkflowRun>(
  run: TRun,
  finishedAt: string,
  error: unknown,
): TRun {
  return {
    ...run,
    error: error instanceof Error ? error.message : String(error),
    finishedAt,
    status: "failed",
  };
}

export function skipYazdWorkflowRun<TRun extends YazdWorkflowRun>(
  run: TRun,
  finishedAt: string,
  reason: string,
): TRun {
  return {
    ...run,
    finishedAt,
    result: reason,
    status: "skipped",
  };
}

export interface YazdWorkflowDefinition {
  actions?: YazdWorkflowActionDefinition[];
  description?: string;
  enabled?: boolean;
  id: string;
  name: string;
  when?: YazdWorkflowWhen;
}
