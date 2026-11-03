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
    source: Option<String>,
) -> Result<Value, String> {
    core.call(
        "laws.setEnabled",
        json!({ "id": id, "enabled": enabled, "source": source }),
    )
}

#[tauri::command]
pub(crate) async fn list_data_packs(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("dataPacks.list", json!({}))
}

#[tauri::command]
pub(crate) async fn save_data_pack_key(
    core: State<'_, CoreBridge>,
    key: String,
) -> Result<Value, String> {
    core.call("dataPacks.saveKey", json!({ "key": key }))
}

#[tauri::command]
pub(crate) async fn install_data_pack(
    core: State<'_, CoreBridge>,
    id: String,
) -> Result<Value, String> {
    core.call("dataPacks.install", json!({ "id": id }))
}
