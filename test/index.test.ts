import { describe, expect, it } from "vitest";

import {
  createYazdPluginRegistry,
  summariseYazdReviewItems,
  sortYazdReviewItems,
  type YazdKnowledgeBasePlugin,
  type YazdPublishReviewItem,
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
});
