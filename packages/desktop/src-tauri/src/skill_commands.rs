use crate::{CoreBridge, path_text};
use serde_json::{Value, json};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;

fn location(core: &CoreBridge, key: &str) -> Result<String, String> {
    core.call("skills.locations", json!({}))?
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| "Garden Desk Core returned an invalid folder path.".to_owned())
}

#[tauri::command]
pub(crate) async fn list_skills(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("skills.list", json!({}))
}

#[tauri::command]
pub(crate) async fn skill_locations(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("skills.locations", json!({}))
}

#[tauri::command]
pub(crate) async fn add_skill_files(
    core: State<'_, CoreBridge>,
    paths: Vec<String>,
) -> Result<Value, String> {
    core.call("skills.install", json!({ "paths": paths }))
}

#[tauri::command]
pub(crate) async fn choose_skill_files(
    app: AppHandle,
    core: State<'_, CoreBridge>,
) -> Result<Option<Value>, String> {
    let Some(selections) = app
        .dialog()
        .file()
        .set_title("Add skills")
        .add_filter("Skill", &["md"])
        .blocking_pick_files()
    else {
        return Ok(None);
    };
    let mut paths = Vec::new();
    for selection in selections {
        let path = selection.into_path().map_err(|error| error.to_string())?;
        paths.push(path_text(&path)?);
    }
    if paths.is_empty() {
        return Ok(None);
    }
    Ok(Some(
        core.call("skills.install", json!({ "paths": paths }))?,
    ))
}

#[tauri::command]
pub(crate) async fn read_skill(core: State<'_, CoreBridge>, name: String) -> Result<Value, String> {
    core.call("skills.read", json!({ "name": name }))
}

#[tauri::command]
pub(crate) async fn write_skill(
    core: State<'_, CoreBridge>,
    name: String,
    content: String,
) -> Result<Value, String> {
    core.call("skills.write", json!({ "name": name, "content": content }))
}

#[tauri::command]
pub(crate) async fn remove_skill(
    core: State<'_, CoreBridge>,
    name: String,
) -> Result<Value, String> {
    core.call("skills.remove", json!({ "name": name }))
}

#[tauri::command]
pub(crate) async fn set_skill_enabled(
    core: State<'_, CoreBridge>,
    name: String,
    enabled: bool,
) -> Result<Value, String> {
    core.call(
        "skills.setEnabled",
        json!({ "name": name, "enabled": enabled }),
    )
}

#[allow(deprecated)]
#[tauri::command]
pub(crate) async fn open_prompt_folder(
    app: AppHandle,
    core: State<'_, CoreBridge>,
    folder: String,
) -> Result<(), String> {
    let key = match folder.as_str() {
        "skills" => "skillsPath",
        "built-in-skills" => "builtInSkillsPath",
        "system-prompts" => "systemPromptsPath",
        _ => return Err("The requested folder is not available.".to_owned()),
    };
    app.shell()
        .open(location(&core, key)?, None)
        .map_err(|error| error.to_string())
}
