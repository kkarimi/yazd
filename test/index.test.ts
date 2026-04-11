import { describe, expect, it } from "vitest";

import { buildDashboard, type AppSettings } from "../src/app.ts";
import {
  buildYazdApprovalWorkflowRunId,
  buildYazdWorkflowRunId,
  buildYazdApprovalReviewItem,
  buildYazdIssueReviewItem,
  buildYazdPublishReviewItem,
  normaliseYazdArtifactAttempt,
  normaliseYazdArtifactParseMode,
  normaliseYazdStructuredOutput,
  completeYazdWorkflowRun,
  createYazdPluginRegistry,
  failYazdWorkflowRun,
  skipYazdWorkflowRun,
  summariseYazdReviewItems,
  sortYazdReviewItems,
  type YazdApprovalMode,
  type YazdArtifactAttempt,
  type YazdArtifactParseMode,
  type YazdArtefactHistoryEntry,
  type YazdArtefactStatus,
  type YazdCommandWorkflowAction,
  type YazdKnowledgeBasePlugin,
  type YazdPublishReviewItem,
  type YazdStructuredOutput,
  cloneYazdStructuredOutput,
  yazdWorkflowActionName,
} from "../src/index.ts";

describe("@kkarimi/yazd-core", () => {
  it("lists cloned source plugins", () => {
    const registry = createYazdPluginRegistry({
      sourcePlugins: [
        {
          id: "gran",
          label: "Gran",
          async list() {
            return { items: [] };
          },
          async fetch(input) {
            return { item: { id: input.id, title: "Payment Ops" } };
          },
          async buildArtifacts(input) {
            return {
              bundle: {
                sourcePluginId: "gran",
                sourceItemId: input.id,
                title: "Payment Ops",
                artifacts: [],
              },
            };
          },
        },
      ],
    });

    const plugins = registry.listSourcePlugins();
    expect(plugins).toHaveLength(1);
    plugins[0]!.label = "Changed";

    expect(registry.getSourcePlugin("gran")?.label).toBe("Gran");
  });

  it("clones knowledge-base plugin kinds", () => {
    const plugin: YazdKnowledgeBasePlugin = {
      id: "obsidian",
      label: "Obsidian",
      kinds: ["obsidian-vault"],
      async previewPublish(input) {
        return {
          ...input.knowledgeBase,
          entries: [],
        };
      },
      async publish(input) {
        return {
          ...input.knowledgeBase,
          entries: [],
          publishedAt: "2026-04-09T00:00:00Z",
        };
      },
    };

    const registry = createYazdPluginRegistry({
      knowledgeBasePlugins: [plugin],
    });

    const loaded = registry.getKnowledgeBasePlugin("obsidian");
    expect(loaded?.kinds).toEqual(["obsidian-vault"]);
    expect(loaded?.kinds).not.toBe(plugin.kinds);
  });

  it("summarises review items by bucket", () => {
    expect(
      summariseYazdReviewItems([
        {
          bucket: "recovery",
          id: "issue:sync",
          payload: {},
          priority: 0,
          status: "error",
          subtitle: "sync-stale",
          summary: "Sync is stale",
          timestamp: "2026-04-09T00:00:00Z",
          title: "Sync stale",
        },
        {
          bucket: "publish",
          id: "artefact:notes",
          payload: {},
          priority: 1,
          status: "generated",
          subtitle: "notes",
          summary: "Draft notes ready",
          timestamp: "2026-04-09T00:00:01Z",
          title: "Notes draft",
        },
        {
          bucket: "approval",
          id: "run:approve",
          payload: {},
          priority: 2,
          status: "pending",
          subtitle: "approval",
          summary: "Waiting for approval",
          timestamp: "2026-04-09T00:00:02Z",
          title: "Approval run",
        },
      ]),
    ).toEqual({
      approval: 1,
      publish: 1,
      recovery: 1,
      total: 3,
    });
  });

  it("sorts review items by priority, timestamp, title, and id", () => {
    expect(
      sortYazdReviewItems([
        {
          bucket: "publish",
          id: "b",
          payload: {},
          priority: 2,
          status: "generated",
          subtitle: "publish",
          summary: "later",
          timestamp: "2026-04-09T00:00:00Z",
          title: "Beta",
        },
        {
          bucket: "recovery",
          id: "a",
          payload: {},
          priority: 0,
          status: "error",
          subtitle: "recovery",
          summary: "first",
          timestamp: "2026-04-08T00:00:00Z",
          title: "Alpha",
        },
        {
          bucket: "publish",
          id: "c",
          payload: {},
          priority: 2,
          status: "generated",
          subtitle: "publish",
          summary: "newer",
          timestamp: "2026-04-10T00:00:00Z",
          title: "Alpha",
        },
      ]).map((item) => item.id),
    ).toEqual(["a", "c", "b"]);
  });

  it("supports typed publish review items", () => {
    const item: YazdPublishReviewItem<{ id: string }, "artefact"> = {
      bucket: "publish",
      draft: { id: "notes-1" },
      id: "artefact:notes-1",
      key: "artefact:notes-1",
      kind: "artefact",
      meetingId: "meeting-1",
      payload: {
        draft: { id: "notes-1" },
        kind: "artefact",
      },
      priority: 2,
      status: "generated",
      subtitle: "notes",
      summary: "Draft notes ready",
      timestamp: "2026-04-09T00:00:01Z",
      title: "Notes draft",
    };

    expect(item.draft.id).toBe("notes-1");
    expect(item.kind).toBe("artefact");
  });

  it("builds typed review items", () => {
    const issue = buildYazdIssueReviewItem({
      id: "issue:sync",
      issue: { id: "sync" },
      key: "issue:sync",
      kind: "issue" as const,
      priority: 0,
      status: "error",
      subtitle: "sync-stale",
      summary: "Sync is stale",
      timestamp: "2026-04-09T00:00:00Z",
      title: "Sync stale",
    });
    const draft = buildYazdPublishReviewItem({
      draft: { id: "notes-1" },
      id: "artefact:notes-1",
      key: "artefact:notes-1",
      kind: "artefact" as const,
      meetingId: "meeting-1",
      priority: 2,
      status: "generated",
      subtitle: "notes",
      summary: "Draft notes ready",
      timestamp: "2026-04-09T00:00:01Z",
      title: "Notes draft",
    });
    const approval = buildYazdApprovalReviewItem({
      id: "run:approve",
      key: "run:approve",
      kind: "run" as const,
      meetingId: "meeting-1",
      priority: 3,
      request: { id: "run-1" },
      status: "pending",
      subtitle: "approval",
      summary: "Waiting for approval",
      timestamp: "2026-04-09T00:00:02Z",
      title: "Approval run",
    });

    expect(issue.payload.issue.id).toBe("sync");
    expect(draft.payload.draft.id).toBe("notes-1");
    expect(approval.payload.request.id).toBe("run-1");
  });

  it("supports reusable generic workflow action types", () => {
    const action: YazdCommandWorkflowAction = {
      args: ["hello"],
      command: "echo",
      id: "command-1",
      kind: "command",
      trigger: "approval",
    };

    expect(action.kind).toBe("command");
    expect(action.trigger).toBe("approval");
  });

  it("exports generic review lifecycle types", () => {
    const mode: YazdApprovalMode = "manual";
    const parseMode: YazdArtifactParseMode = "json";
    const status: YazdArtefactStatus = "generated";
    const attempt: YazdArtifactAttempt<"openai" | "codex"> = {
      model: "gpt-5",
      provider: "openai",
    };
    const history: YazdArtefactHistoryEntry = {
      action: "generated",
      at: "2026-04-10T00:00:00Z",
      note: "Initial draft",
    };

    expect(mode).toBe("manual");
    expect(parseMode).toBe("json");
    expect(status).toBe("generated");
    expect(attempt.provider).toBe("openai");
    expect(history.action).toBe("generated");
  });

  it("exports generic structured draft types", () => {
    const output: YazdStructuredOutput<"owner" | "participant"> = {
      actionItems: [
        {
          ownerRole: "owner",
          title: "Follow up",
        },
      ],
      decisions: ["Ship it"],
      followUps: ["Email team"],
      highlights: ["Launch blocked on review"],
      markdown: "# Draft",
      participantSummaries: [
        {
          actionItems: ["Follow up"],
          role: "participant",
          speaker: "Nima",
          summary: "Asked for a rollout plan",
        },
      ],
      sections: [
        {
          body: "Draft body",
          title: "Summary",
        },
      ],
      title: "Draft",
    };

    expect(output.actionItems[0]?.ownerRole).toBe("owner");
    expect(output.participantSummaries?.[0]?.role).toBe("participant");

    const cloned = cloneYazdStructuredOutput(output);
    expect(cloned).toEqual(output);
    expect(cloned).not.toBe(output);
    expect(cloned.actionItems).not.toBe(output.actionItems);
    expect(cloned.sections).not.toBe(output.sections);
    expect(cloned.participantSummaries).not.toBe(output.participantSummaries);
  });

  it("normalises generic structured output payloads", () => {
    expect(
      normaliseYazdStructuredOutput({
        actionItems: [
          {
            owner: "Nima",
            ownerRole: "owner",
            title: "Follow up",
          },
        ],
        decisions: ["Ship it"],
        followUps: ["Email team"],
        highlights: ["Launch blocked on review"],
        markdown: "# Draft",
        participantSummaries: [
          {
            actionItems: ["Follow up"],
            role: "participant",
            speaker: "Nima",
            summary: "Asked for a rollout plan",
          },
        ],
        sections: [{ body: "Draft body", title: "Summary" }],
        summary: "Draft body",
        title: "Draft",
      }),
    ).toEqual({
      actionItems: [
        {
          owner: "Nima",
          ownerRole: "owner",
          title: "Follow up",
        },
      ],
      decisions: ["Ship it"],
      followUps: ["Email team"],
      highlights: ["Launch blocked on review"],
      markdown: "# Draft",
      participantSummaries: [
        {
          actionItems: ["Follow up"],
          role: "participant",
          speaker: "Nima",
          summary: "Asked for a rollout plan",
        },
      ],
      sections: [{ body: "Draft body", title: "Summary" }],
      summary: "Draft body",
      title: "Draft",
    });

    expect(
      normaliseYazdStructuredOutput(
        {
          markdown: "# Draft",
        },
        {
          fallbackTitle: "Fallback title",
        },
      ),
    ).toEqual({
      actionItems: [],
      decisions: [],
      followUps: [],
      highlights: [],
      markdown: "# Draft",
      metadata: undefined,
      participantSummaries: undefined,
      sections: [],
      summary: undefined,
      title: "Fallback title",
    });
  });

  it("normalises generic artifact attempts and parse modes", () => {
    expect(
      normaliseYazdArtifactAttempt(
        {
          error: "boom",
          harnessId: "harness-1",
          model: "gpt-5",
          provider: "openai",
        },
        {
          providers: ["codex", "openai"] as const,
        },
      ),
    ).toEqual({
      error: "boom",
      harnessId: "harness-1",
      model: "gpt-5",
      provider: "openai",
    });

    expect(
      normaliseYazdArtifactAttempt(
        {
          model: "gpt-5",
          provider: "unsupported",
        },
        {
          providers: ["codex", "openai"] as const,
        },
      ),
    ).toEqual({
      model: "gpt-5",
      provider: undefined,
    });

    expect(normaliseYazdArtifactParseMode("json")).toBe("json");
    expect(normaliseYazdArtifactParseMode("markdown-fallback")).toBe("markdown-fallback");
    expect(normaliseYazdArtifactParseMode("xml")).toBeUndefined();
  });

  it("provides generic workflow run lifecycle helpers", () => {
    const run: {
      error?: string;
      finishedAt?: string;
      id: string;
      result?: string;
      startedAt: string;
      status: "pending";
    } = {
      id: "run-1",
      startedAt: "2026-04-10T00:00:00Z",
      status: "pending",
    };

    expect(yazdWorkflowActionName({ id: "action-1", name: "Notify team" })).toBe("Notify team");
    expect(buildYazdWorkflowRunId("match-1", "action-1")).toBe("match-1:action-1");
    expect(buildYazdApprovalWorkflowRunId("artefact-1", "action-1")).toBe(
      "approval:artefact-1:action-1",
    );
    expect(
      completeYazdWorkflowRun(run, "2026-04-10T00:01:00Z", {
        result: "done",
      }),
    ).toEqual({
      finishedAt: "2026-04-10T00:01:00Z",
      id: "run-1",
      result: "done",
      startedAt: "2026-04-10T00:00:00Z",
      status: "completed",
    });
    expect(failYazdWorkflowRun(run, "2026-04-10T00:01:00Z", new Error("boom"))).toEqual({
      error: "boom",
      finishedAt: "2026-04-10T00:01:00Z",
      id: "run-1",
      startedAt: "2026-04-10T00:00:00Z",
      status: "failed",
    });
    expect(skipYazdWorkflowRun(run, "2026-04-10T00:01:00Z", "no content")).toEqual({
      finishedAt: "2026-04-10T00:01:00Z",
      id: "run-1",
      result: "no content",
      startedAt: "2026-04-10T00:00:00Z",
      status: "skipped",
    });
  });

  it("builds dashboard data through the plugin pipeline", async () => {
    const settings: AppSettings = {
      agentId: "pi",
      granEndpoint: "",
      knowledgeBaseKind: "obsidian-vault",
      knowledgeBasePath: "/Users/nima/Documents/Vault",
    };

    const dashboard = await buildDashboard(settings);

    expect(dashboard.publishEntries.length).toBeGreaterThan(0);
    expect(dashboard.publishEntries[0]?.path).toContain("/Users/nima/Documents/Vault");
    expect(dashboard.reviewItems.some((item) => item.bucket === "approval")).toBe(true);
    expect(dashboard.reviewItems.some((item) => item.bucket === "publish")).toBe(true);
    expect(dashboard.publishState.status).toBe("awaiting-approval");
    expect(dashboard.sourceState?.status).toBe("sample");
    expect(dashboard.sourceState?.title).toBe("Weekly Sync");
    expect(dashboard.sourceOptions[0]?.id).toBe("gran:weekly-sync-2026-04-11");
  });

  it("surfaces published paths in dashboard publish state", async () => {
    const settings: AppSettings = {
      agentId: "pi",
      granEndpoint: "",
      knowledgeBaseKind: "obsidian-vault",
      knowledgeBasePath: "/Users/nima/Documents/Vault",
    };

    const dashboard = await buildDashboard(settings, {
      itemDecisions: {
        "approval:gran:weekly-sync-2026-04-11": {
          actedAt: "2026-04-11T10:00:00Z",
          decision: "approved",
        },
      },
      publishedItems: {
        "publish:gran:weekly-sync-2026-04-11": {
          paths: [
            "/Users/nima/Documents/Vault/Meetings/weekly-sync-briefing.md",
            "/Users/nima/Documents/Vault/Decisions/weekly-sync-briefing.md",
          ],
          publishedAt: "2026-04-11T10:05:00Z",
        },
      },
    });

    expect(dashboard.publishState.status).toBe("published");
    expect(dashboard.publishState.publishedPaths).toHaveLength(2);
    expect(dashboard.publishState.publishedAt).toBe("2026-04-11T10:05:00Z");
    expect(dashboard.activityItems[0]?.kind).toBe("publish");
    expect(dashboard.activityItems[1]?.kind).toBe("approval");
  });
});
