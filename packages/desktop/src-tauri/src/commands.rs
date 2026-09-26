use crate::{CoreBridge, path_text};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;

const RELEASE_PAGE_URL: &str = "https://gardendesk.ai/releases";

fn state_root(core: &CoreBridge) -> Result<PathBuf, String> {
    let status = core.call("status", json!({}))?;
    let workspace_root = status
        .get("workspace")
        .and_then(|workspace| workspace.get("rootPath"))
        .and_then(Value::as_str)
        .ok_or_else(|| "Garden Desk Core returned an invalid workspace path.".to_owned())?;
    Ok(Path::new(workspace_root).join(".garden-desk"))
}

#[tauri::command]
pub(crate) async fn desktop_bootstrap(
    app: AppHandle,
    core: State<'_, CoreBridge>,
) -> Result<Value, String> {
    let catalog_path = path_text(&state_root(&core)?.join("catalog.sqlite"))?;
    let folders = core.call("folders.list", json!({}))?;
    let global_sessions = core.call("sessions.list", json!({ "folderId": null, "limit": 5 }))?;
    let mut folder_sessions = Vec::new();
    let items = folders
        .as_array()
        .ok_or_else(|| "Garden Desk Core returned invalid folders.".to_owned())?;
    for folder in items {
        let folder_id = folder
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Garden Desk Core returned an invalid folder.".to_owned())?;
        let page = core.call(
            "sessions.list",
            json!({ "folderId": folder_id, "limit": 5 }),
        )?;
        folder_sessions.push(json!({ "folderId": folder_id, "page": page }));
    }
    Ok(json!({
        "appVersion": app.package_info().version.to_string(),
        "catalogPath": catalog_path,
        "commands": core.call("commands.list", json!({}))?,
        "folders": folders,
        "globalSessions": global_sessions,
        "folderSessions": folder_sessions,
        "model": core.call("model.status", json!({}))?,
    }))
}

#[tauri::command]
pub(crate) async fn model_status(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("model.status", json!({}))
}

#[tauri::command]
pub(crate) async fn unload_model(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("model.unload", json!({}))
}

#[tauri::command]
pub(crate) async fn choose_folder(
    app: AppHandle,
    core: State<'_, CoreBridge>,
) -> Result<Option<Value>, String> {
    let Some(selection) = app
        .dialog()
        .file()
        .set_title("Choose a folder for Garden Desk")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let path = selection.into_path().map_err(|error| error.to_string())?;
    Ok(Some(core.call(
        "folders.add",
        json!({ "rootPath": path_text(&path)? }),
    )?))
}

#[tauri::command]
pub(crate) async fn add_dropped_folders(
    core: State<'_, CoreBridge>,
    paths: Vec<String>,
) -> Result<Value, String> {
    for path in &paths {
        if !Path::new(path)
            .metadata()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            return Err("Only folders can be dropped on the sidebar.".to_owned());
        }
    }
    let mut folders = Vec::new();
    for path in paths {
        folders.push(core.call("folders.add", json!({ "rootPath": path }))?);
    }
    Ok(Value::Array(folders))
}

#[tauri::command]
pub(crate) async fn reorder_folders(
    core: State<'_, CoreBridge>,
    folder_ids: Vec<String>,
) -> Result<Value, String> {
    core.call("folders.reorder", json!({ "folderIds": folder_ids }))
}

#[tauri::command]
pub(crate) async fn choose_files(
    app: AppHandle,
    core: State<'_, CoreBridge>,
    session_id: String,
) -> Result<Value, String> {
    let Some(selections) = app
        .dialog()
        .file()
        .set_title("Attach files to this chat")
        .blocking_pick_files()
    else {
        return Ok(json!([]));
    };
    let mut attachments = Vec::new();
    for selection in selections {
        let path = selection.into_path().map_err(|error| error.to_string())?;
        attachments.push(core.call(
            "attachments.add",
            json!({ "sessionId": session_id, "path": path_text(&path)? }),
        )?);
    }
    Ok(Value::Array(attachments))
}

#[allow(deprecated)]
#[tauri::command]
pub(crate) async fn open_folder(
    app: AppHandle,
    core: State<'_, CoreBridge>,
    folder_id: String,
) -> Result<(), String> {
    let path = core.call("folders.resolvePath", json!({ "folderId": folder_id }))?;
    let path = path
        .as_str()
        .ok_or_else(|| "Garden Desk Core returned an invalid folder path.".to_owned())?;
    app.shell()
        .open(path, None)
        .map_err(|error| error.to_string())
}

#[allow(deprecated)]
#[tauri::command]
pub(crate) async fn open_catalog_folder(
    app: AppHandle,
    core: State<'_, CoreBridge>,
) -> Result<(), String> {
    let path = path_text(&state_root(&core)?)?;
    app.shell()
        .open(path, None)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn revoke_folder(
    core: State<'_, CoreBridge>,
    folder_id: String,
) -> Result<Value, String> {
    core.call("folders.revoke", json!({ "folderId": folder_id }))
}

#[allow(deprecated)]
#[tauri::command]
pub(crate) async fn open_release_page(app: AppHandle) -> Result<(), String> {
    app.shell()
        .open(RELEASE_PAGE_URL, None)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn list_messages(
    core: State<'_, CoreBridge>,
    session_id: String,
) -> Result<Value, String> {
    core.call("messages.list", json!({ "sessionId": session_id }))
}

#[tauri::command]
pub(crate) async fn append_user_message(
    core: State<'_, CoreBridge>,
    session_id: String,
    content: String,
) -> Result<Value, String> {
    core.call(
        "messages.append",
        json!({ "sessionId": session_id, "role": "user", "content": content }),
    )
}

#[tauri::command]
pub(crate) async fn save_draft(
    core: State<'_, CoreBridge>,
    session_id: String,
    content: String,
) -> Result<Value, String> {
    core.call(
        "drafts.save",
        json!({ "sessionId": session_id, "content": content }),
    )
}

#[tauri::command]
pub(crate) async fn load_draft(
    core: State<'_, CoreBridge>,
    session_id: String,
) -> Result<Value, String> {
    core.call("drafts.load", json!({ "sessionId": session_id }))
}

#[tauri::command]
pub(crate) async fn list_attachments(
    core: State<'_, CoreBridge>,
    session_id: String,
) -> Result<Value, String> {
    core.call("attachments.list", json!({ "sessionId": session_id }))
}

#[tauri::command]
pub(crate) async fn start_agent(
    core: State<'_, CoreBridge>,
    session_id: String,
    task: String,
    thinking: String,
    development_model: Option<String>,
) -> Result<Value, String> {
    crate::windows_setup::require_ready()?;
    let development_model = match development_model {
        Some(model) if cfg!(debug_assertions) => Some(model),
        Some(_) => {
            return Err("Development model selection is not available in this build.".to_owned());
        }
        None => None,
    };
    core.call(
        "agent.start",
        json!({
            "sessionId": session_id,
            "task": task,
            "thinking": thinking,
            "developmentModelId": development_model,
        }),
    )
}

#[tauri::command]
pub(crate) async fn get_agent_run(
    core: State<'_, CoreBridge>,
    run_id: String,
) -> Result<Value, String> {
    core.call("agent.get", json!({ "runId": run_id }))
}

#[tauri::command]
pub(crate) async fn get_agent_trace(
    core: State<'_, CoreBridge>,
    run_id: String,
) -> Result<Value, String> {
    core.call("agent.trace", json!({ "runId": run_id }))
}

#[tauri::command]
pub(crate) async fn list_agent_runs(
    core: State<'_, CoreBridge>,
    session_id: String,
) -> Result<Value, String> {
    core.call("agent.list", json!({ "sessionId": session_id }))
}

#[tauri::command]
pub(crate) async fn remove_attachment(
    core: State<'_, CoreBridge>,
    session_id: String,
    attachment_id: String,
) -> Result<Value, String> {
    core.call(
        "attachments.remove",
        json!({ "sessionId": session_id, "attachmentId": attachment_id }),
    )
}
