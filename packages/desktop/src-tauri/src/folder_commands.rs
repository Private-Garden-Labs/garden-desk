use crate::CoreBridge;
use serde_json::{Value, json};
use tauri::State;

#[tauri::command]
pub(crate) async fn sample_folder_files(
    core: State<'_, CoreBridge>,
    folder_id: String,
) -> Result<Value, String> {
    core.call("folders.sampleFiles", json!({ "folderId": folder_id }))
}
