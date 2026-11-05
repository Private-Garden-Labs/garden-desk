use crate::CoreBridge;
use serde_json::{Value, json};
use tauri::{AppHandle, State};
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub(crate) async fn list_laws(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("laws.list", json!({}))
}

#[tauri::command]
pub(crate) async fn read_law(
    core: State<'_, CoreBridge>,
    id: String,
    source: String,
) -> Result<Value, String> {
    core.call("laws.read", json!({ "id": id, "source": source }))
}

#[tauri::command]
pub(crate) async fn list_law_citations(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("laws.citations", json!({}))
}

#[allow(deprecated)]
#[tauri::command]
pub(crate) async fn open_law_source(
    app: AppHandle,
    core: State<'_, CoreBridge>,
    id: String,
    source: String,
) -> Result<(), String> {
    let url = core.call("laws.sourceUrl", json!({ "id": id, "source": source }))?;
    let url = url
        .as_str()
        .ok_or_else(|| "Garden Desk Core returned an invalid law source.".to_owned())?;
    app.shell()
        .open(url, None)
        .map_err(|error| error.to_string())
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
