use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
  knowledge_base_kind: String,
  knowledge_base_path: String,
  agent_id: String,
  gran_endpoint: String,
}

impl Default for AppSettings {
  fn default() -> Self {
    Self {
      knowledge_base_kind: "obsidian-vault".into(),
      knowledge_base_path: String::new(),
      agent_id: "pi".into(),
      gran_endpoint: String::new(),
    }
  }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppReviewDecisionRecord {
  acted_at: String,
  decision: String,
  note: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppPublishedRecord {
  paths: Vec<String>,
  published_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppReviewState {
  item_decisions: HashMap<String, AppReviewDecisionRecord>,
  published_items: HashMap<String, AppPublishedRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppBootstrap {
  config_path: String,
  review_state: AppReviewState,
  review_state_path: String,
  settings: AppSettings,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValidateKnowledgeBaseInput {
  kind: String,
  path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppValidationResult {
  errors: Vec<String>,
  normalized_path: Option<String>,
  valid: bool,
  warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishEntryInput {
  content: String,
  path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishResult {
  published_at: String,
  written_paths: Vec<String>,
}

fn config_directory(app: &AppHandle) -> Result<PathBuf, String> {
  let directory = app
    .path()
    .app_config_dir()
    .map_err(|error| error.to_string())?;
  fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
  Ok(directory)
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
  let mut directory = config_directory(app)?;
  directory.push("settings.json");
  Ok(directory)
}

fn review_state_path(app: &AppHandle) -> Result<PathBuf, String> {
  let mut directory = config_directory(app)?;
  directory.push("review-state.json");
  Ok(directory)
}

fn read_json_file<T>(path: &PathBuf) -> Result<Option<T>, String>
where
  T: for<'de> Deserialize<'de>,
{
  if !path.exists() {
    return Ok(None);
  }

  let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
  let parsed = serde_json::from_str(&content).map_err(|error| error.to_string())?;
  Ok(Some(parsed))
}

fn write_json_file<T>(path: &PathBuf, value: &T) -> Result<(), String>
where
  T: Serialize,
{
  let content = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
  fs::write(path, content).map_err(|error| error.to_string())
}

fn read_settings(path: &PathBuf) -> Result<AppSettings, String> {
  Ok(read_json_file(path)?.unwrap_or_default())
}

fn read_review_state(path: &PathBuf) -> Result<AppReviewState, String> {
  Ok(read_json_file(path)?.unwrap_or_default())
}

fn build_bootstrap(app: &AppHandle) -> Result<AppBootstrap, String> {
  let config_path = settings_path(app)?;
  let review_state_path = review_state_path(app)?;
  let settings = read_settings(&config_path)?;
  let review_state = read_review_state(&review_state_path)?;

  Ok(AppBootstrap {
    config_path: config_path.display().to_string(),
    review_state,
    review_state_path: review_state_path.display().to_string(),
    settings,
  })
}

#[tauri::command]
fn load_bootstrap(app: AppHandle) -> Result<AppBootstrap, String> {
  build_bootstrap(&app)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<AppBootstrap, String> {
  let config_path = settings_path(&app)?;
  write_json_file(&config_path, &settings)?;
  build_bootstrap(&app)
}

#[tauri::command]
fn save_review_state(app: AppHandle, review_state: AppReviewState) -> Result<AppReviewState, String> {
  let path = review_state_path(&app)?;
  write_json_file(&path, &review_state)?;
  Ok(review_state)
}

#[tauri::command]
fn validate_knowledge_base(input: ValidateKnowledgeBaseInput) -> Result<AppValidationResult, String> {
  let trimmed_path = input.path.trim();
  if trimmed_path.is_empty() {
    return Ok(AppValidationResult {
      errors: vec![],
      normalized_path: None,
      valid: true,
      warnings: vec![],
    });
  }

  let path = PathBuf::from(trimmed_path);
  if !path.exists() {
    return Ok(AppValidationResult {
      errors: vec!["The selected path does not exist.".into()],
      normalized_path: None,
      valid: false,
      warnings: vec![],
    });
  }

  if !path.is_dir() {
    return Ok(AppValidationResult {
      errors: vec!["The selected path is not a directory.".into()],
      normalized_path: None,
      valid: false,
      warnings: vec![],
    });
  }

  let normalized_path = fs::canonicalize(&path)
    .map_err(|error| error.to_string())?
    .display()
    .to_string();

  let mut warnings = Vec::new();
  if input.kind == "obsidian-vault" {
    let mut obsidian_marker = PathBuf::from(&normalized_path);
    obsidian_marker.push(".obsidian");
    if !obsidian_marker.exists() {
      warnings.push(
        "This directory does not contain a .obsidian folder yet, so it may not be an existing Obsidian vault."
          .into(),
      );
    }
  }

  Ok(AppValidationResult {
    errors: vec![],
    normalized_path: Some(normalized_path),
    valid: true,
    warnings,
  })
}

#[tauri::command]
fn publish_entries(entries: Vec<PublishEntryInput>) -> Result<PublishResult, String> {
  let published_at = chrono::Utc::now().to_rfc3339();
  let mut written_paths = Vec::with_capacity(entries.len());

  for entry in entries {
    let path = PathBuf::from(&entry.path);
    let parent = path
      .parent()
      .ok_or_else(|| format!("Could not determine a parent directory for {}", entry.path))?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    fs::write(&path, entry.content).map_err(|error| error.to_string())?;
    written_paths.push(path.display().to_string());
  }

  Ok(PublishResult {
    published_at,
    written_paths,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      load_bootstrap,
      publish_entries,
      save_review_state,
      save_settings,
      validate_knowledge_base
    ])
    .run(tauri::generate_context!())
    .expect("error while running Yazd application");
}
