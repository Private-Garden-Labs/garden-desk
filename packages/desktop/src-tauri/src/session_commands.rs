use crate::CoreBridge;
use serde_json::{Value, json};
use tauri::State;

#[tauri::command]
pub(crate) async fn create_session(
    core: State<'_, CoreBridge>,
    folder_id: Option<String>,
) -> Result<Value, String> {
    core.call("sessions.create", json!({ "folderId": folder_id }))
}

#[tauri::command]
pub(crate) async fn delete_session(
    core: State<'_, CoreBridge>,
    session_id: String,
) -> Result<Value, String> {
    core.call("sessions.delete", json!({ "sessionId": session_id }))
}

#[tauri::command]
pub(crate) async fn rename_session(
    core: State<'_, CoreBridge>,
    session_id: String,
    title: String,
) -> Result<Value, String> {
    core.call(
        "sessions.rename",
        json!({ "sessionId": session_id, "title": title }),
    )
}

#[tauri::command]
pub(crate) async fn list_sessions(
    core: State<'_, CoreBridge>,
    folder_id: Option<String>,
    cursor: Option<String>,
) -> Result<Value, String> {
    let mut params = json!({ "folderId": folder_id, "limit": 5 });
    if let Some(cursor) = cursor {
        params["cursor"] = Value::String(cursor);
    }
    core.call("sessions.list", params)
}
