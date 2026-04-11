import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";

import {
  agentOptions,
  buildDashboard,
  clearAppReviewItems,
  defaultAppReviewState,
  describeReviewLoad,
  knowledgeBaseOptions,
  markAppReviewPublished,
  setAppReviewDecision,
  type AppBootstrap,
  type AppDashboard,
  type AppPublishEntry,
  type AppReviewAction,
  type AppReviewActionKind,
  type AppReviewState,
  type AppSettings,
  type AppValidationResult,
} from "./app-model.ts";
import "./styles.css";

type AppView = "overview" | "review" | "publish" | "roadmap" | "settings";

interface PublishResult {
  publishedAt: string;
  writtenPaths: string[];
}

interface ViewState {
  activeView: AppView;
  bootstrap: AppBootstrap | null;
  busyActionId: string | null;
  dashboard: AppDashboard | null;
  dashboardRequestId: number;
  dashboardStatus: "idle" | "loading" | "ready";
  draftSettings: AppSettings;
  message: string;
  reviewPreviewMode: "draft" | "source";
  reviewState: AppReviewState;
  saving: boolean;
  selectedPublishEntryId: string | null;
  selectedSourceItemId: string | null;
  validation: AppValidationResult | null;
}

const SETTINGS_STORAGE_KEY = "yazd-preview-settings";
const REVIEW_STATE_STORAGE_KEY = "yazd-preview-review-state";
const SELECTED_SOURCE_ITEM_STORAGE_KEY = "yazd-selected-source-item";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const state: ViewState = {
  activeView: "overview",
  bootstrap: null,
  busyActionId: null,
  dashboard: null,
  dashboardRequestId: 0,
  dashboardStatus: "idle",
  draftSettings: defaultSettings(),
  message: "",
  reviewPreviewMode: "draft",
  reviewState: defaultAppReviewState(),
  saving: false,
  selectedPublishEntryId: null,
  selectedSourceItemId: null,
  validation: null,
};

const isMacLike = /Mac|iPhone|iPad|iPod/.test(globalThis.navigator.userAgent);
const hasCustomWindowControls = isTauri() && !isMacLike;
const appWindow = isTauri() ? getCurrentWindow() : null;

const viewMeta: Record<AppView, { description: string; title: string }> = {
  overview: {
    description: "See the current queue, target, and runtime posture in one place.",
    title: "Overview",
  },
  publish: {
    description: "Preview where approved artifacts will land before anything writes.",
    title: "Publish",
  },
  review: {
    description: "Work the next decision instead of scanning a long page.",
    title: "Review Queue",
  },
  roadmap: {
    description: "Keep the architecture honest about what comes next.",
    title: "Roadmap",
  },
  settings: {
    description: "Only expose the setup users actually need.",
    title: "Settings",
  },
};

let granEventSource: EventSource | null = null;
let granPollHandle: number | undefined;
let granSubscriptionKey = "";

void init();

async function init(): Promise<void> {
  state.bootstrap = await loadBootstrap();
  state.reviewState = state.bootstrap.reviewState;
  state.draftSettings = state.bootstrap.settings;
  state.selectedSourceItemId = loadSelectedSourceItemId();
  state.validation = await validateKnowledgeBase(state.bootstrap.settings);
  state.message = "Local-first setup is ready.";
  await refreshDashboard(state.bootstrap.settings, state.reviewState, state.validation);
  syncGranSubscription(state.bootstrap.settings, state.dashboard?.runtime.eventsUrl, state.dashboard?.runtime.eventMode);
  render();
}

async function loadBootstrap(): Promise<AppBootstrap> {
  if (isTauri()) {
    return invoke<AppBootstrap>("load_bootstrap");
  }

  const savedSettings = globalThis.localStorage.getItem(SETTINGS_STORAGE_KEY);
  const savedReviewState = globalThis.localStorage.getItem(REVIEW_STATE_STORAGE_KEY);

  return {
    configPath: "Browser preview stores settings in localStorage.",
    reviewState: savedReviewState ? (JSON.parse(savedReviewState) as AppReviewState) : defaultAppReviewState(),
    reviewStatePath: "Browser preview stores review state in localStorage.",
    settings: savedSettings ? (JSON.parse(savedSettings) as AppSettings) : defaultSettings(),
  };
}

async function saveSettingsBootstrap(settings: AppSettings): Promise<AppBootstrap> {
  if (isTauri()) {
    return invoke<AppBootstrap>("save_settings", { settings });
  }

  globalThis.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  return {
    configPath: "Browser preview stores settings in localStorage.",
    reviewState: state.reviewState,
    reviewStatePath: "Browser preview stores review state in localStorage.",
    settings,
  };
}

async function persistReviewState(reviewState: AppReviewState): Promise<AppReviewState> {
  if (isTauri()) {
    return invoke<AppReviewState>("save_review_state", { reviewState });
  }

  globalThis.localStorage.setItem(REVIEW_STATE_STORAGE_KEY, JSON.stringify(reviewState));
  return reviewState;
}

async function validateKnowledgeBase(settings: AppSettings): Promise<AppValidationResult> {
  if (isTauri()) {
    return invoke<AppValidationResult>("validate_knowledge_base", {
      input: {
        kind: settings.knowledgeBaseKind,
        path: settings.knowledgeBasePath,
      },
    });
  }

  if (!settings.knowledgeBasePath.trim()) {
    return {
      errors: [],
      valid: true,
      warnings: [],
    };
  }

  return {
    errors: [],
    normalizedPath: settings.knowledgeBasePath.trim(),
    valid: true,
    warnings: ["Browser preview cannot validate the local filesystem path."],
  };
}

async function publishEntries(entries: AppPublishEntry[]): Promise<PublishResult> {
  if (isTauri()) {
    return invoke<PublishResult>("publish_entries", {
      entries: entries.map((entry) => ({
        content: entry.content,
        path: entry.path,
      })),
    });
  }

  const publishedAt = new Date().toISOString();
  globalThis.localStorage.setItem(
    "yazd-preview-published",
    JSON.stringify(
      entries.map((entry) => ({
        content: entry.content,
        path: entry.path,
        publishedAt,
      })),
    ),
  );
  return {
    publishedAt,
    writtenPaths: entries.map((entry) => entry.path),
  };
}

async function openPath(path: string): Promise<void> {
  if (isTauri()) {
    await invoke("open_path", { path });
    return;
  }

  throw new Error("Opening written files is only available in the desktop app.");
}

function defaultSettings(): AppSettings {
  return {
    agentId: "pi",
    granEndpoint: "",
    knowledgeBaseKind: "obsidian-vault",
    knowledgeBasePath: "",
  };
}

function currentSettings(): AppSettings {
  return state.draftSettings;
}

function savedSettings(): AppSettings {
  return state.bootstrap?.settings ?? currentSettings();
}

function render(): void {
  const bootstrap = state.bootstrap;
  if (!bootstrap || !state.dashboard) {
    app.innerHTML = `<main class="loading-shell"><p>Loading Yazd...</p></main>`;
    return;
  }

  const settings = currentSettings();
  const dashboard = state.dashboard;
  const reviewLoad = describeReviewLoad(dashboard.reviewItems);
  const hasConfiguredTarget = settings.knowledgeBasePath.trim().length > 0;
  const isOnboarding = !hasConfiguredTarget;
  const connectedTarget = settings.knowledgeBasePath.trim() || "No target selected";
  const meta = viewMeta[state.activeView];
  const nextReviewItem = dashboard.reviewItems[0];
  const primaryActionView: AppView = hasConfiguredTarget ? "review" : "settings";

  app.innerHTML = `
    <main class="app-shell ${isMacLike ? "platform-macos" : ""} ${isOnboarding ? "app-shell-onboarding" : ""}">
      <aside class="sidebar">
        <div class="sidebar-top">
          <section class="brand-block">
            <p class="brand-eyebrow">Yazd</p>
            <h1>Knowledge automation</h1>
            <p class="brand-copy">Local-first workflows, review, and publishing without pushing source complexity into the UI.</p>
          </section>
          <nav class="sidebar-nav" aria-label="Primary">
            ${renderNavButton("overview", "Home", iconHome())}
            ${
              hasConfiguredTarget
                ? `
                  ${renderNavButton("review", `Review <span class="nav-count">${dashboard.reviewItems.length}</span>`, iconInbox())}
                  ${renderNavButton("publish", "Publish", iconPublish())}
                  ${renderNavButton("roadmap", "Roadmap", iconRoadmap())}
                `
                : `
                  <div class="sidebar-note sidebar-note-compact">
                    <p>Review and publish appear after the first target is connected.</p>
                  </div>
                `
            }
          </nav>
        </div>

        <div class="sidebar-middle">
          ${
            hasConfiguredTarget
              ? `
                <section class="sidebar-panel">
                  <div class="sidebar-panel-header">
                    <span>Current focus</span>
                    <span>${nextReviewItem ? `P${nextReviewItem.priority}` : "Quiet"}</span>
                  </div>
                  ${
                    nextReviewItem
                      ? `
                        <button class="sidebar-row sidebar-row-featured" data-view="${primaryActionView}" type="button">
                          <span class="sidebar-row-marker priority-${nextReviewItem.priority}"></span>
                          <span class="sidebar-row-copy">
                            <strong>${nextReviewItem.title}</strong>
                            <small>${nextReviewItem.summary}</small>
                          </span>
                        </button>
                      `
                      : `
                        <div class="sidebar-note">
                          <p>No immediate review items. The landing screen can stay quiet until something needs attention.</p>
                        </div>
                      `
                  }
                </section>

                <section class="sidebar-panel">
                  <div class="sidebar-panel-header">
                    <span>Workspace</span>
                    <span>${settings.knowledgeBaseKind === "obsidian-vault" ? "Vault" : "Folder"}</span>
                  </div>
                  <div class="workspace-card">
                    <p class="workspace-path">${connectedTarget}</p>
                    <p class="workspace-meta">${agentOptions.find((option) => option.id === settings.agentId)?.label ?? "Unknown agent"}</p>
                    <button class="toolbar-button workspace-open-button" data-open-path="${escapeAttribute(settings.knowledgeBasePath)}" type="button">Open target</button>
                  </div>
                </section>
              `
              : `
                <section class="sidebar-panel">
                  <div class="sidebar-panel-header">
                    <span>Setup</span>
                    <span>First run</span>
                  </div>
                  <div class="sidebar-note">
                    <p>Choose where approved output should land first. Agent and runtime details can stay secondary until that path is real.</p>
                  </div>
                </section>
              `
          }
        </div>

        <div class="sidebar-bottom">
          ${
            hasConfiguredTarget || settings.granEndpoint.trim()
              ? `
                <section class="runtime-card">
                  <p class="runtime-label">Gran runtime</p>
                  <strong>${dashboard.runtime.state === "configured" ? "Configured" : dashboard.runtime.state === "error" ? "Needs attention" : "Planned"}</strong>
                  <p>${dashboard.runtime.detail}</p>
                </section>
              `
              : ""
          }

          <button class="settings-button ${state.activeView === "settings" ? "settings-button-active" : ""}" data-view="settings" type="button">
            <span class="settings-icon" aria-hidden="true">${iconSettings()}</span>
            <span>Settings</span>
          </button>
        </div>
      </aside>

      <section class="main-pane">
        <header class="topbar">
          <div class="topbar-main">
            <div class="drag-strip" data-tauri-drag-region>
              <span class="window-title">Yazd</span>
            </div>
            <div>
            <p class="topbar-eyebrow">${meta.title}</p>
            <h2>${meta.title}</h2>
            <p class="topbar-copy">${meta.description}</p>
            </div>
          </div>
          <div class="topbar-actions">
            ${
              hasConfiguredTarget
                ? `
                  <div class="target-chip">${state.dashboardStatus === "loading" ? "Refreshing..." : connectedTarget}</div>
                  <div class="soft-chip ${state.dashboardStatus === "loading" ? "soft-chip-active" : ""}">
                    ${state.dashboardStatus === "loading" ? "Syncing dashboard" : reviewLoad}
                  </div>
                `
                : `
                  <div class="soft-chip ${state.dashboardStatus === "loading" ? "soft-chip-active" : ""}">
                    ${state.dashboardStatus === "loading" ? "Checking setup" : "First-run setup"}
                  </div>
                `
            }
            <button class="toolbar-button" data-command="refresh" type="button" ${state.dashboardStatus === "loading" ? "disabled" : ""}>
              ${state.dashboardStatus === "loading" ? "Refreshing..." : "Refresh"}
            </button>
            <button class="toolbar-button" data-view="settings" type="button">Open settings</button>
            ${renderWindowControls()}
          </div>
        </header>

        <section class="content-pane">
          ${renderViewContent(state.activeView, bootstrap, settings, dashboard, reviewLoad)}
        </section>
      </section>
    </main>
  `;

  wireEvents();
}

function renderViewContent(
  view: AppView,
  bootstrap: AppBootstrap,
  settings: AppSettings,
  dashboard: AppDashboard,
  reviewLoad: string,
): string {
  switch (view) {
    case "overview":
      return `
        <section class="view-grid overview-grid zen-grid ${settings.knowledgeBasePath.trim() ? "" : "zen-grid-onboarding"}">
          <article class="pane-card hero-card zen-hero">
            <div class="zen-center">
              <p class="section-kicker">Start here</p>
              <h3>${settings.knowledgeBasePath.trim() ? "A calmer way to move work into your knowledge base." : "Point Yazd at where reviewed knowledge should live."}</h3>
              <p>
                ${settings.knowledgeBasePath.trim()
                  ? "The heavy detail is there when you need it. The default screen should mainly answer what the next step is."
                  : "Begin with the destination. Once the target is clear, review and publish can stay simple and intentional."}
              </p>
              <div class="zen-actions">
                <button class="primary-button zen-primary" data-view="${settings.knowledgeBasePath.trim() ? "review" : "settings"}" type="button">
                  ${settings.knowledgeBasePath.trim() ? "Open review queue" : "Choose target"}
                </button>
                <button class="toolbar-button" data-view="settings" type="button">Settings</button>
              </div>
            </div>
          </article>

          ${
            settings.knowledgeBasePath.trim()
              ? `
                <article class="pane-card quiet-card">
                  <div class="card-header">
                    <div>
                      <p class="section-kicker">Next step</p>
                      <h3>${dashboard.reviewItems[0]?.title ?? "Everything is quiet"}</h3>
                    </div>
                  </div>
                  <div class="callout-card">
                    <p class="callout-title">${dashboard.reviewItems[0]?.bucket ?? "No queue"}</p>
                    <p>${dashboard.reviewItems[0]?.summary ?? "When there is nothing urgent, Yazd should stay out of the way."}</p>
                  </div>
                </article>
              `
              : ""
          }

          <article class="pane-card quiet-card">
            <div class="card-header">
              <div>
                <p class="section-kicker">Target</p>
                <h3>${settings.knowledgeBaseKind === "obsidian-vault" ? "Knowledge vault" : "Knowledge folder"}</h3>
              </div>
            </div>
            <div class="callout-card">
              <p class="callout-title">${settings.knowledgeBasePath.trim() ? "Connected" : "Not connected"}</p>
              <p>${settings.knowledgeBasePath.trim() || "Select the local place where approved output should land."}</p>
            </div>
          </article>

          <article class="pane-card quiet-card">
            <div class="card-header">
              <div>
                <p class="section-kicker">Agent</p>
                <h3>${agentOptions.find((option) => option.id === settings.agentId)?.label ?? "Unknown agent"}</h3>
              </div>
            </div>
            <div class="callout-card">
              <p class="callout-title">${dashboard.runtime.eventMode === "sse" ? "Live" : dashboard.runtime.eventMode === "poll" ? "Polling" : "Configured"}</p>
              <p>Keep this selection lean. More knobs should appear only when they support a real workflow decision.</p>
            </div>
          </article>

          ${
            settings.knowledgeBasePath.trim()
              ? `
                <article class="pane-card quiet-card">
                  <div class="card-header">
                    <div>
                      <p class="section-kicker">Source</p>
                      <h3>${dashboard.sourceState?.title ?? "No source loaded"}</h3>
                    </div>
                  </div>
                  <div class="callout-card">
                    <p class="callout-title">${dashboard.sourceState?.status === "runtime" ? "Gran runtime" : "Built-in sample"}</p>
                    <p>${dashboard.sourceState?.detail ?? "The dashboard could not load a source item."}</p>
                  </div>
                  ${renderSourceSelector(dashboard)}
                  ${
                    dashboard.sourceState?.updatedAt
                      ? `<p class="muted">Updated ${formatTimestamp(dashboard.sourceState.updatedAt)}</p>`
                      : ""
                  }
                </article>
              `
              : ""
          }

          ${
            settings.knowledgeBasePath.trim()
              ? `
                <article class="pane-card quiet-card">
                  <div class="card-header">
                    <div>
                      <p class="section-kicker">Publish</p>
                      <h3>${renderPublishStateTitle(dashboard)}</h3>
                    </div>
                  </div>
                  <div class="callout-card">
                    <p class="callout-title">${renderPublishStateLabel(dashboard)}</p>
                    <p>${renderPublishStateDetail(dashboard)}</p>
                  </div>
                    ${
                      dashboard.publishState.status === "published" && dashboard.publishState.publishedPaths.length > 0
                        ? `
                          <div class="preview-list compact-list">
                            ${dashboard.publishState.publishedPaths.slice(0, 2).map((path) => `<p>${path}</p>`).join("")}
                          </div>
                        `
                        : ""
                    }
                </article>

                <article class="pane-card quiet-card">
                  <div class="card-header">
                    <div>
                      <p class="section-kicker">Recent activity</p>
                      <h3>${dashboard.activityItems[0]?.title ?? "Nothing yet"}</h3>
                    </div>
                  </div>
                  ${
                    dashboard.activityItems.length > 0
                      ? `
                        <div class="preview-list compact-list">
                          ${dashboard.activityItems
                            .slice(0, 3)
                            .map(
                              (item) => `
                                <p>
                                  <strong>${item.title}</strong><br />
                                  <span class="activity-detail">${item.detail}</span><br />
                                  <span class="muted">${formatTimestamp(item.at)}</span>
                                </p>
                              `,
                            )
                            .join("")}
                        </div>
                      `
                      : `
                        <div class="callout-card">
                          <p class="callout-title">No actions recorded</p>
                          <p>Approval and publish events will appear here once the workflow starts moving.</p>
                        </div>
                      `
                  }
                </article>
              `
              : ""
          }

          ${
            settings.knowledgeBasePath.trim()
              ? ""
              : `
                <article class="pane-card quiet-card">
                  <div class="card-header">
                    <div>
                      <p class="section-kicker">Workflow</p>
                      <h3>Review and publish stay earned</h3>
                    </div>
                  </div>
                  <div class="callout-card">
                    <p class="callout-title">Progressive by default</p>
                    <p>The queue and publish surfaces stay quiet until Yazd knows where approved work belongs.</p>
                  </div>
                </article>
              `
          }
        </section>
      `;
    case "review":
      return `
        <section class="view-grid detail-grid">
          <article class="pane-card">
            <div class="card-header">
              <div>
                <p class="section-kicker">Inbox</p>
                <h3>Prioritized queue</h3>
              </div>
              <span class="soft-chip">${reviewLoad}</span>
            </div>
            <div class="stack-list">
              ${dashboard.reviewItems
                .map(
                  (item) => `
                    <article class="review-card priority-${item.priority}">
                      <div>
                        <p class="item-meta">${item.bucket} · ${item.status}</p>
                        <h4>${item.title}</h4>
                        <p>${item.summary}</p>
                        <small class="card-subtitle">${item.subtitle}</small>
                      </div>
                      <div class="review-actions">
                        <span class="priority-badge">P${item.priority}</span>
                        <div class="action-row">
                          ${renderActionButtons(item.actions)}
                        </div>
                      </div>
                    </article>
                  `,
                )
                .join("")}
            </div>
          </article>

          <article class="pane-card side-card">
            <div class="card-header">
              <div>
                <p class="section-kicker">Review context</p>
                <h3>${state.reviewPreviewMode === "source" ? dashboard.draftPreview?.sourceTitle ?? "Source bundle" : dashboard.draftPreview?.title ?? "Nothing to preview yet"}</h3>
              </div>
              ${
                dashboard.draftPreview
                  ? `
                    <div class="segmented-control" role="tablist" aria-label="Review preview mode">
                      <button
                        class="segmented-button ${state.reviewPreviewMode === "draft" ? "segmented-button-active" : ""}"
                        data-review-preview-mode="draft"
                        type="button"
                      >
                        Draft
                      </button>
                      <button
                        class="segmented-button ${state.reviewPreviewMode === "source" ? "segmented-button-active" : ""}"
                        data-review-preview-mode="source"
                        type="button"
                      >
                        Source
                      </button>
                    </div>
                  `
                  : ""
              }
            </div>
            <div class="callout-card">
              <p class="callout-title">${state.reviewPreviewMode === "source" ? "Original source" : dashboard.draftPreview?.sourceTitle ?? "Awaiting source item"}</p>
              <p>${
                state.reviewPreviewMode === "source"
                  ? "Compare the original meeting bundle with the generated draft before approving anything."
                  : dashboard.draftPreview?.summary ?? "When a source bundle is available, Yazd should show the draft itself here so approval is grounded in the actual output."
              }</p>
            </div>
            ${renderSourceSelector(dashboard)}
            ${
              dashboard.draftPreview
                ? `
                  <div class="preview-meta">
                    ${
                      state.reviewPreviewMode === "draft"
                        ? `
                          <div class="mini-stat-list">
                            <article class="mini-stat">
                              <span>Decisions</span>
                              <strong>${dashboard.draftPreview.decisions.length}</strong>
                            </article>
                            <article class="mini-stat">
                              <span>Actions</span>
                              <strong>${dashboard.draftPreview.actionItems.length}</strong>
                            </article>
                          </div>
                          ${
                            dashboard.draftPreview.decisions.length > 0
                              ? `
                                <section class="preview-list-block">
                                  <p class="section-kicker">Decisions</p>
                                  <div class="preview-list">
                                    ${dashboard.draftPreview.decisions.map((item) => `<p>${item}</p>`).join("")}
                                  </div>
                                </section>
                              `
                              : ""
                          }
                          ${
                            dashboard.draftPreview.actionItems.length > 0
                              ? `
                                <section class="preview-list-block">
                                  <p class="section-kicker">Action items</p>
                                  <div class="preview-list">
                                    ${dashboard.draftPreview.actionItems
                                      .map(
                                        (item) => `
                                          <p>${item.owner ? `${item.owner}: ` : ""}${item.title}${item.dueDate ? ` (${item.dueDate})` : ""}</p>
                                        `,
                                      )
                                      .join("")}
                                  </div>
                                </section>
                              `
                              : ""
                          }
                        `
                        : ""
                    }
                    <section class="preview-pane">
                      <p class="section-kicker">${state.reviewPreviewMode === "source" ? "Transcript" : "Markdown"}</p>
                      <pre class="markdown-preview">${escapeHtml(state.reviewPreviewMode === "source" ? dashboard.draftPreview.sourceMarkdown : dashboard.draftPreview.markdown)}</pre>
                    </section>
                  </div>
                `
                : ""
            }
          </article>
        </section>
      `;
    case "publish":
      {
        const selectedEntry =
          dashboard.publishEntries.find((entry) => entry.artifactId === state.selectedPublishEntryId) ??
          dashboard.publishEntries[0];

      return `
        <section class="view-grid detail-grid">
          <article class="pane-card">
            <div class="card-header">
              <div>
                <p class="section-kicker">Destination</p>
                <h3>Publish preview</h3>
              </div>
              <span class="soft-chip">${dashboard.publishEntries.length} planned</span>
            </div>
            ${
              dashboard.publishEntries.length > 0
                ? `
                  <div class="stack-list">
                    ${dashboard.publishEntries
                      .map(
                        (entry) => `
                          <button
                            class="publish-card publish-card-button ${selectedEntry?.artifactId === entry.artifactId ? "publish-card-active" : ""}"
                            data-publish-entry-id="${entry.artifactId}"
                            type="button"
                          >
                            <div>
                              <p class="item-meta">${entry.action} · ${entry.artifactKind}</p>
                              <h4>${entry.path}</h4>
                              <p>${entry.reason ?? ""}</p>
                            </div>
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                `
                : `<p class="empty-copy">A target knowledge base is required before publish planning becomes concrete.</p>`
            }
          </article>

          <article class="pane-card side-card">
            <div class="card-header">
              <div>
                <p class="section-kicker">Content preview</p>
                <h3>${selectedEntry?.artifactKind ?? "Current output destination"}</h3>
              </div>
            </div>
            <div class="callout-card">
              <p class="callout-title">${selectedEntry?.path ?? (settings.knowledgeBaseKind === "obsidian-vault" ? "Obsidian vault" : "Folder target")}</p>
              <p>${selectedEntry?.reason ?? (settings.knowledgeBasePath.trim() || "No destination selected yet.")}</p>
            </div>
            <section class="publish-status-block">
              <div class="mini-stat-list">
                <article class="mini-stat">
                  <span>Status</span>
                  <strong>${renderPublishStateLabel(dashboard)}</strong>
                </article>
                <article class="mini-stat">
                  <span>Artifacts</span>
                  <strong>${dashboard.publishState.artifactCount}</strong>
                </article>
              </div>
              ${
                settings.knowledgeBasePath.trim()
                  ? `<button class="toolbar-button" data-open-path="${escapeAttribute(settings.knowledgeBasePath)}" type="button">Open target folder</button>`
                  : ""
              }
              <p class="publish-status-copy">${renderPublishStateDetail(dashboard)}</p>
            </section>
            ${
              selectedEntry
                ? `
                  <section class="preview-pane">
                    <p class="section-kicker">File contents</p>
                    <pre class="markdown-preview">${escapeHtml(selectedEntry.content)}</pre>
                  </section>
                `
                : `<button class="toolbar-button full-width" data-view="settings" type="button">Adjust setup</button>`
            }
            ${
              dashboard.publishState.status === "published" && dashboard.publishState.publishedPaths.length > 0
                ? `
                  <section class="preview-list-block">
                    <p class="section-kicker">Written paths</p>
                    <div class="preview-list">
                      ${dashboard.publishState.publishedPaths
                        .map(
                          (path) => `
                            <div class="path-row">
                              <p>${path}</p>
                              <button class="toolbar-button path-row-button" data-open-path="${escapeAttribute(path)}" type="button">Open</button>
                            </div>
                          `,
                        )
                        .join("")}
                    </div>
                  </section>
                `
                : ""
            }
          </article>
        </section>
      `;
      }
    case "roadmap":
      return `
        <section class="view-grid detail-grid">
          <article class="pane-card">
            <div class="card-header">
              <div>
                <p class="section-kicker">Priority order</p>
                <h3>What to tackle next</h3>
              </div>
            </div>
            <div class="stack-list">
              ${dashboard.todoItems
                .map(
                  (item) => `
                    <article class="todo-card">
                      <div>
                        <p class="item-meta">P${item.priority} · ${item.status}</p>
                        <h4>${item.title}</h4>
                        <p>${item.detail}</p>
                      </div>
                    </article>
                  `,
                )
                .join("")}
            </div>
          </article>

          <article class="pane-card side-card">
            <div class="card-header">
              <div>
                <p class="section-kicker">Integration seam</p>
                <h3>Gran should stay external</h3>
              </div>
            </div>
            <div class="callout-card">
              <p class="callout-title">${dashboard.runtime.label}</p>
              <p>${dashboard.runtime.detail}</p>
            </div>
          </article>
        </section>
      `;
    case "settings":
      return renderSettingsView(bootstrap, settings, state.validation);
  }
}

function renderSettingsView(
  bootstrap: AppBootstrap,
  settings: AppSettings,
  validation: AppValidationResult | null,
): string {
  const pathLabel = settings.knowledgeBaseKind === "obsidian-vault" ? "Vault path" : "Folder path";

  return `
    <section class="view-grid settings-grid">
      <article class="pane-card settings-card">
        <div class="card-header">
          <div>
            <p class="section-kicker">Setup</p>
            <h3>Only the knobs users need</h3>
          </div>
          <span class="soft-chip ${state.saving ? "soft-chip-active" : ""}">${state.saving ? "Saving..." : "Local config"}</span>
        </div>

        ${renderValidationBlock(validation)}

        <form id="settings-form" class="settings-form">
          <label class="field">
            <span>Knowledge base</span>
            <select name="knowledgeBaseKind">
              ${knowledgeBaseOptions
                .map(
                  (option) => `
                    <option value="${option.id}" ${option.id === settings.knowledgeBaseKind ? "selected" : ""}>
                      ${option.label}
                    </option>
                  `,
                )
                .join("")}
            </select>
            <small>${knowledgeBaseOptions.find((option) => option.id === settings.knowledgeBaseKind)?.description ?? ""}</small>
          </label>

          <label class="field">
            <span>${pathLabel}</span>
            <div class="field-row">
              <input
                name="knowledgeBasePath"
                type="text"
                value="${escapeAttribute(settings.knowledgeBasePath)}"
                placeholder="${settings.knowledgeBaseKind === "obsidian-vault" ? "/Users/nima/Documents/Obsidian Vault" : "/Users/nima/Documents/Notes"}"
              />
              <button type="button" class="toolbar-button" id="choose-folder">Choose</button>
            </div>
            <small>Start with the exact local destination. The publish plugin can stay interchangeable behind it.</small>
          </label>

          <label class="field">
            <span>Agent</span>
            <select name="agentId">
              ${agentOptions
                .map(
                  (option) => `
                    <option value="${option.id}" ${option.id === settings.agentId ? "selected" : ""}>
                      ${option.label}
                    </option>
                  `,
                )
                .join("")}
            </select>
            <small>${agentOptions.find((option) => option.id === settings.agentId)?.description ?? ""}</small>
          </label>

          <details class="advanced">
            <summary>Gran integration</summary>
            <label class="field advanced-field">
              <span>Local runtime URL</span>
              <input
                name="granEndpoint"
                type="text"
                value="${escapeAttribute(settings.granEndpoint)}"
                placeholder="http://127.0.0.1:4317"
              />
              <small>Optional for now. This should point at a local Gran runtime surface, not a remote Granola API.</small>
            </label>
          </details>

          <div class="form-footer">
            <p>${state.message || "Settings are stored locally."}<br /><span class="muted">${bootstrap.configPath}</span></p>
            <button type="submit" class="primary-button">Save setup</button>
          </div>
        </form>
      </article>

      <article class="pane-card side-card">
        <div class="card-header">
          <div>
            <p class="section-kicker">Current state</p>
            <h3>Setup summary</h3>
          </div>
        </div>
        <div class="summary-list">
          <article class="summary-row">
            <span>Target</span>
            <strong>${settings.knowledgeBasePath.trim() || "Not connected"}</strong>
          </article>
          <article class="summary-row">
            <span>Type</span>
            <strong>${settings.knowledgeBaseKind === "obsidian-vault" ? "Obsidian vault" : "Folder"}</strong>
          </article>
          <article class="summary-row">
            <span>Agent</span>
            <strong>${agentOptions.find((option) => option.id === settings.agentId)?.label ?? "Unknown"}</strong>
          </article>
          <article class="summary-row">
            <span>Gran</span>
            <strong>${settings.granEndpoint.trim() || "Optional"}</strong>
          </article>
          <article class="summary-row">
            <span>Review state</span>
            <strong>${bootstrap.reviewStatePath}</strong>
          </article>
        </div>
        ${
          settings.knowledgeBasePath.trim()
            ? `<button class="toolbar-button full-width" data-open-path="${escapeAttribute(settings.knowledgeBasePath)}" type="button">Open target folder</button>`
            : ""
        }
      </article>
    </section>
  `;
}

function renderValidationBlock(validation: AppValidationResult | null): string {
  if (!validation) {
    return "";
  }

  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    return "";
  }

  return `
    <section class="validation-block ${validation.valid ? "validation-warning" : "validation-error"}">
      ${
        validation.errors.length > 0
          ? `<p>${validation.errors.join(" ")}</p>`
          : `<p>${validation.warnings.join(" ")}</p>`
      }
      ${
        validation.normalizedPath
          ? `<small class="muted">${validation.normalizedPath}</small>`
          : ""
      }
    </section>
  `;
}

function renderSourceSelector(dashboard: AppDashboard): string {
  if (dashboard.sourceOptions.length <= 1) {
    return "";
  }

  return `
    <section class="source-selector">
      <p class="section-kicker">Recent sources</p>
      <div class="source-selector-list">
        ${dashboard.sourceOptions
          .map(
            (item) => `
              <button
                class="source-selector-button ${state.selectedSourceItemId === item.id ? "source-selector-button-active" : ""}"
                data-source-item-id="${item.id}"
                type="button"
              >
                <span class="source-selector-title">${item.title}</span>
                <span class="source-selector-meta">${item.updatedAt ? formatTimestamp(item.updatedAt) : item.summary ?? "Recent source item"}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderActionButtons(actions: readonly AppReviewAction[]): string {
  if (actions.length === 0) {
    return `<span class="action-hint">No actions</span>`;
  }

  return actions
    .map(
      (action) => `
        <button
          class="action-button ${action.tone ? `action-${action.tone}` : ""}"
          data-review-action="${action.kind}"
          data-review-item-id="${action.itemId}"
          type="button"
          ${state.busyActionId === action.itemId ? "disabled" : ""}
        >
          ${action.label}
        </button>
      `,
    )
    .join("");
}

function renderNavButton(view: AppView, label: string, icon: string): string {
  return `
    <button class="nav-button ${state.activeView === view ? "nav-button-active" : ""}" data-view="${view}" type="button">
      <span class="nav-icon" aria-hidden="true">${icon}</span>
      <span class="nav-label">${label}</span>
    </button>
  `;
}

function wireEvents(): void {
  const form = document.querySelector<HTMLFormElement>("#settings-form");
  const chooseFolderButton = document.querySelector<HTMLButtonElement>("#choose-folder");
  const knowledgeBaseSelect = document.querySelector<HTMLSelectElement>('select[name="knowledgeBaseKind"]');
  const knowledgeBasePathInput = document.querySelector<HTMLInputElement>('input[name="knowledgeBasePath"]');
  const granEndpointInput = document.querySelector<HTMLInputElement>('input[name="granEndpoint"]');
  const commandButtons = document.querySelectorAll<HTMLButtonElement>("[data-command]");
  const navButtons = document.querySelectorAll<HTMLButtonElement>("[data-view]");
  const openPathButtons = document.querySelectorAll<HTMLButtonElement>("[data-open-path]");
  const publishEntryButtons = document.querySelectorAll<HTMLButtonElement>("[data-publish-entry-id]");
  const sourceItemButtons = document.querySelectorAll<HTMLButtonElement>("[data-source-item-id]");
  const reviewPreviewButtons = document.querySelectorAll<HTMLButtonElement>("[data-review-preview-mode]");
  const reviewActionButtons = document.querySelectorAll<HTMLButtonElement>("[data-review-action]");
  const windowControlButtons = document.querySelectorAll<HTMLButtonElement>("[data-window-control]");

  const syncDraftFromForm = () => {
    if (!form) {
      return;
    }
    state.draftSettings = readFormSettings(form);
  };

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      syncDraftFromForm();
      const view = button.dataset.view;
      if (isAppView(view)) {
        state.activeView = view;
        render();
      }
    });
  });

  commandButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command;
      if (command === "refresh") {
        void refreshDashboardNow();
      }
    });
  });

  reviewActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.reviewAction;
      const itemId = button.dataset.reviewItemId;
      if (isReviewActionKind(kind) && itemId) {
        void handleReviewAction(kind, itemId);
      }
    });
  });

  publishEntryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const artifactId = button.dataset.publishEntryId;
      if (artifactId) {
        state.selectedPublishEntryId = artifactId;
        render();
      }
    });
  });

  openPathButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.openPath;
      if (path) {
        void handleOpenPath(path);
      }
    });
  });

  sourceItemButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sourceItemId = button.dataset.sourceItemId;
      if (sourceItemId) {
        state.selectedSourceItemId = sourceItemId;
        void refreshDashboardNow();
      }
    });
  });

  reviewPreviewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.reviewPreviewMode;
      if (mode === "draft" || mode === "source") {
        state.reviewPreviewMode = mode;
        render();
      }
    });
  });

  windowControlButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const control = button.dataset.windowControl;
      if (control) {
        void handleWindowControl(control);
      }
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nextSettings = readFormSettings(form);

    state.draftSettings = nextSettings;
    state.saving = true;
    state.message = "Saving local setup...";
    render();

    try {
      const validation = await validateKnowledgeBase(nextSettings);
      state.validation = validation;
      if (!validation.valid) {
        state.message = validation.errors.join(" ");
        return;
      }

      const normalizedSettings: AppSettings = validation.normalizedPath
        ? {
            ...nextSettings,
            knowledgeBasePath: validation.normalizedPath,
          }
        : nextSettings;

      state.bootstrap = await saveSettingsBootstrap(normalizedSettings);
      state.reviewState = state.bootstrap.reviewState;
      state.draftSettings = state.bootstrap.settings;
      state.message = validation.warnings[0] ?? "Setup saved locally.";
      await refreshDashboard(state.bootstrap.settings, state.reviewState, validation);
      syncGranSubscription(state.bootstrap.settings, state.dashboard?.runtime.eventsUrl, state.dashboard?.runtime.eventMode);
    } catch (error) {
      state.message = error instanceof Error ? error.message : String(error);
    } finally {
      state.saving = false;
      render();
    }
  });

  chooseFolderButton?.addEventListener("click", async () => {
    if (!form) {
      return;
    }

    if (isTauri()) {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose a knowledge base folder",
      });
      if (typeof selected === "string") {
        state.draftSettings = {
          ...readFormSettings(form),
          knowledgeBasePath: selected,
        };
        await previewDraftState();
        render();
      }
      return;
    }

    const fallback = globalThis.prompt(
      "Enter the local knowledge-base path",
      currentSettings().knowledgeBasePath,
    );
    if (fallback) {
      state.draftSettings = {
        ...readFormSettings(form),
        knowledgeBasePath: fallback,
      };
      await previewDraftState();
      render();
    }
  });

  knowledgeBaseSelect?.addEventListener("change", () => {
    syncDraftFromForm();
    void previewDraftState();
  });

  knowledgeBasePathInput?.addEventListener("change", () => {
    syncDraftFromForm();
    void previewDraftState();
  });

  granEndpointInput?.addEventListener("change", () => {
    syncDraftFromForm();
    void previewDraftState();
  });
}

async function previewDraftState(): Promise<void> {
  state.validation = await validateKnowledgeBase(state.draftSettings);
  await refreshDashboard(state.draftSettings, state.reviewState, state.validation);
}

async function refreshDashboardNow(): Promise<void> {
  state.message = "Refreshing dashboard...";
  render();

  try {
    await refreshDashboard(savedSettings(), state.reviewState, state.validation);
    state.message = "Dashboard refreshed.";
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
  } finally {
    render();
  }
}

async function handleOpenPath(path: string): Promise<void> {
  state.message = `Opening ${path}...`;
  render();

  try {
    await openPath(path);
    state.message = "Opened in the system file manager.";
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
  } finally {
    render();
  }
}

async function handleReviewAction(kind: AppReviewActionKind, itemId: string): Promise<void> {
  const dashboard = state.dashboard;
  if (!dashboard) {
    return;
  }

  const action = dashboard.reviewItems
    .flatMap((item) => item.actions)
    .find((candidate) => candidate.itemId === itemId && candidate.kind === kind);

  if (!action) {
    return;
  }

  if (kind === "open-settings") {
    state.activeView = "settings";
    render();
    return;
  }

  state.busyActionId = itemId;
  state.message = `Running ${action.label.toLowerCase()}...`;
  render();

  try {
    switch (kind) {
      case "approve":
        state.reviewState = setAppReviewDecision(state.reviewState, itemId, "approved");
        break;
      case "reject":
        state.reviewState = setAppReviewDecision(state.reviewState, itemId, "rejected");
        break;
      case "rerun":
        state.reviewState = clearAppReviewItems(
          state.reviewState,
          action.relatedItemIds ?? [itemId],
        );
        break;
      case "publish": {
        if (dashboard.publishEntries.length === 0) {
          throw new Error("There is no publish plan to write yet.");
        }
        const result = await publishEntries(dashboard.publishEntries);
        state.reviewState = markAppReviewPublished(
          state.reviewState,
          itemId,
          result.publishedAt,
          result.writtenPaths,
        );
        state.message = `Published ${result.writtenPaths.length} files locally.`;
        break;
      }
      case "open-settings":
        break;
    }

    state.reviewState = await persistReviewState(state.reviewState);
    if (state.bootstrap) {
      state.bootstrap = {
        ...state.bootstrap,
        reviewState: state.reviewState,
      };
    }
    await refreshDashboard(savedSettings(), state.reviewState, state.validation);
    syncGranSubscription(savedSettings(), state.dashboard?.runtime.eventsUrl, state.dashboard?.runtime.eventMode);

    if (kind !== "publish") {
      state.message = `${action.label} complete.`;
    }
  } catch (error) {
    state.message = error instanceof Error ? error.message : String(error);
  } finally {
    state.busyActionId = null;
    render();
  }
}

function syncGranSubscription(
  settings: AppSettings,
  eventsUrl?: string,
  eventMode?: "none" | "poll" | "sample" | "sse",
): void {
  const key = `${settings.granEndpoint}|${eventsUrl ?? ""}|${eventMode ?? "none"}`;
  if (granSubscriptionKey === key) {
    return;
  }

  granSubscriptionKey = key;
  closeGranSubscription();

  if (!settings.granEndpoint.trim()) {
    return;
  }

  const refresh = () => {
    void refreshDashboard(savedSettings(), state.reviewState, state.validation);
  };

  if (eventMode === "sse" && typeof EventSource !== "undefined") {
    const url = resolveGranUrl(settings.granEndpoint, eventsUrl ?? "/events");
    granEventSource = new EventSource(url);
    granEventSource.onmessage = refresh;
    granEventSource.onerror = () => {
      if (!granPollHandle) {
        granPollHandle = globalThis.setInterval(refresh, 60000);
      }
    };
    return;
  }

  if (eventMode === "poll") {
    granPollHandle = globalThis.setInterval(refresh, 60000);
  }
}

function closeGranSubscription(): void {
  if (granEventSource) {
    granEventSource.close();
    granEventSource = null;
  }
  if (granPollHandle) {
    globalThis.clearInterval(granPollHandle);
    granPollHandle = undefined;
  }
}

function resolveGranUrl(endpoint: string, candidate: string): string {
  if (/^https?:\/\//.test(candidate)) {
    return candidate;
  }
  return `${endpoint.replace(/\/+$/, "")}${candidate.startsWith("/") ? candidate : `/${candidate}`}`;
}

function isAppView(value: string | undefined): value is AppView {
  return (
    value === "overview" ||
    value === "review" ||
    value === "publish" ||
    value === "roadmap" ||
    value === "settings"
  );
}

function isReviewActionKind(value: string | undefined): value is AppReviewActionKind {
  return (
    value === "approve" ||
    value === "reject" ||
    value === "rerun" ||
    value === "publish" ||
    value === "open-settings"
  );
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value: string): string {
  return escapeAttribute(value);
}

function renderPublishStateTitle(dashboard: AppDashboard): string {
  switch (dashboard.publishState.status) {
    case "published":
      return "Published to knowledge base";
    case "ready":
      return "Ready to publish";
    case "awaiting-approval":
      return "Awaiting approval";
    case "unavailable":
      return "Publish not ready";
  }
}

function renderPublishStateLabel(dashboard: AppDashboard): string {
  switch (dashboard.publishState.status) {
    case "published":
      return dashboard.publishState.publishedAt
        ? `Published ${formatTimestamp(dashboard.publishState.publishedAt)}`
        : "Published";
    case "ready":
      return `${dashboard.publishState.artifactCount} files ready`;
    case "awaiting-approval":
      return "Waiting for approval";
    case "unavailable":
      return "No publish target yet";
  }
}

function renderPublishStateDetail(dashboard: AppDashboard): string {
  switch (dashboard.publishState.status) {
    case "published":
      return dashboard.publishState.publishedPaths.length > 0
        ? `Yazd last wrote ${dashboard.publishState.publishedPaths.length} files for ${dashboard.publishState.title ?? "this draft"}.`
        : "The publish step completed, but no written paths were recorded.";
    case "ready":
      return `The publish plan is ready and will write ${dashboard.publishState.artifactCount} files once approved.`;
    case "awaiting-approval":
      return "Approve the draft first so the publish plan can be materialized intentionally.";
    case "unavailable":
      return "Pick a vault or folder before Yazd can turn review into publish output.";
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function readFormSettings(form: HTMLFormElement): AppSettings {
  const formData = new FormData(form);
  return {
    agentId: String(formData.get("agentId") ?? "pi"),
    granEndpoint: String(formData.get("granEndpoint") ?? "").trim(),
    knowledgeBaseKind:
      String(formData.get("knowledgeBaseKind") ?? "obsidian-vault") === "folder"
        ? "folder"
        : "obsidian-vault",
    knowledgeBasePath: String(formData.get("knowledgeBasePath") ?? "").trim(),
  };
}

async function refreshDashboard(
  settings: AppSettings,
  reviewState: AppReviewState,
  validation: AppValidationResult | null,
): Promise<void> {
  const requestId = state.dashboardRequestId + 1;
  state.dashboardRequestId = requestId;
  state.dashboardStatus = "loading";
  render();

  const dashboard = await buildDashboard(
    settings,
    reviewState,
    validation ?? undefined,
    state.selectedSourceItemId ?? undefined,
  );
  if (requestId !== state.dashboardRequestId) {
    return;
  }

  state.dashboard = dashboard;
  state.selectedPublishEntryId = reconcileSelectedPublishEntryId(dashboard, state.selectedPublishEntryId);
  state.selectedSourceItemId = reconcileSelectedSourceItemId(dashboard, state.selectedSourceItemId);
  persistSelectedSourceItemId(state.selectedSourceItemId);
  state.dashboardStatus = "ready";
  render();
}

function reconcileSelectedPublishEntryId(
  dashboard: AppDashboard,
  currentSelection: string | null,
): string | null {
  if (dashboard.publishEntries.length === 0) {
    return null;
  }

  if (currentSelection && dashboard.publishEntries.some((entry) => entry.artifactId === currentSelection)) {
    return currentSelection;
  }

  return dashboard.publishEntries[0]?.artifactId ?? null;
}

function reconcileSelectedSourceItemId(
  dashboard: AppDashboard,
  currentSelection: string | null,
): string | null {
  if (dashboard.sourceOptions.length === 0) {
    return null;
  }

  if (currentSelection && dashboard.sourceOptions.some((item) => item.id === currentSelection)) {
    return currentSelection;
  }

  return dashboard.sourceOptions[0]?.id ?? null;
}

function loadSelectedSourceItemId(): string | null {
  try {
    return globalThis.localStorage.getItem(SELECTED_SOURCE_ITEM_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistSelectedSourceItemId(sourceItemId: string | null): void {
  try {
    if (!sourceItemId) {
      globalThis.localStorage.removeItem(SELECTED_SOURCE_ITEM_STORAGE_KEY);
      return;
    }
    globalThis.localStorage.setItem(SELECTED_SOURCE_ITEM_STORAGE_KEY, sourceItemId);
  } catch {
    // Ignore storage failures so the dashboard still works in restricted contexts.
  }
}

function iconHome(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  `;
}

function iconInbox(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 6h16l-1.8 11H5.8L4 6Z" />
      <path d="M8.5 12h7l1.5 2.5h-10L8.5 12Z" />
    </svg>
  `;
}

function iconPublish(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 4v11" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M5 19h14" />
    </svg>
  `;
}

function iconRoadmap(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 18V6" />
      <path d="M4 7h7l1.5 2H20v8h-7l-1.5-2H4" />
    </svg>
  `;
}

function iconSettings(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3.25" />
      <path d="m19.4 15-.8 1.4 1.1 1.9-1.9 1.9-1.9-1.1-1.4.8-.5 2.2H10l-.5-2.2-1.4-.8-1.9 1.1-1.9-1.9 1.1-1.9-.8-1.4L2.5 14v-4l2.1-.5.8-1.4-1.1-1.9 1.9-1.9 1.9 1.1 1.4-.8L10 2.5h4l.5 2.1 1.4.8 1.9-1.1 1.9 1.9-1.1 1.9.8 1.4 2.2.5v4Z" />
    </svg>
  `;
}

function renderWindowControls(): string {
  if (!hasCustomWindowControls) {
    return "";
  }

  return `
    <div class="window-controls">
      <button class="window-control-button" data-window-control="minimize" title="Minimize" type="button">
        ${iconMinimize()}
      </button>
      <button class="window-control-button" data-window-control="toggle-maximize" title="Maximize" type="button">
        ${iconMaximize()}
      </button>
      <button class="window-control-button window-control-close" data-window-control="close" title="Close" type="button">
        ${iconClose()}
      </button>
    </div>
  `;
}

async function handleWindowControl(control: string): Promise<void> {
  if (!appWindow) {
    return;
  }

  switch (control) {
    case "minimize":
      await appWindow.minimize();
      break;
    case "toggle-maximize":
      await appWindow.toggleMaximize();
      break;
    case "close":
      await appWindow.close();
      break;
  }
}

function iconMinimize(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M6 12h12" />
    </svg>
  `;
}

function iconMaximize(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  `;
}

function iconClose(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="m7 7 10 10" />
      <path d="m17 7-10 10" />
    </svg>
  `;
}
