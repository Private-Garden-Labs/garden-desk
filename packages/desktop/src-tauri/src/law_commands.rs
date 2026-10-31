use crate::CoreBridge;
use serde_json::{Value, json};
use tauri::State;

#[tauri::command]
pub(crate) async fn list_laws(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("laws.list", json!({}))
}

#[tauri::command]
pub(crate) async fn set_law_enabled(
    core: State<'_, CoreBridge>,
    id: String,
    enabled: bool,
) -> Result<Value, String> {
    core.call("laws.setEnabled", json!({ "id": id, "enabled": enabled }))
}
