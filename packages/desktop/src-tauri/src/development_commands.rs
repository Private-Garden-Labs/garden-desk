use crate::CoreBridge;
use serde_json::{Value, json};
use tauri::State;

/// Release builds stop development model operations before they reach Garden Desk Core.
fn development_only() -> Result<(), String> {
    if cfg!(debug_assertions) {
        Ok(())
    } else {
        Err("Development model operations are not available in this build.".to_owned())
    }
}

#[tauri::command]
pub(crate) async fn development_model_settings(
    core: State<'_, CoreBridge>,
) -> Result<Value, String> {
    development_only()?;
    core.call("development.models.settings", json!({}))
}

#[tauri::command]
pub(crate) async fn development_model_search(
    core: State<'_, CoreBridge>,
    query: String,
    api_key: Option<String>,
) -> Result<Value, String> {
    development_only()?;
    core.call(
        "development.models.search",
        json!({ "query": query, "apiKey": api_key }),
    )
}

#[tauri::command]
pub(crate) async fn development_model_save(
    core: State<'_, CoreBridge>,
    favorites: Value,
    api_key: Option<String>,
) -> Result<Value, String> {
    development_only()?;
    core.call(
        "development.models.save",
        json!({ "favorites": favorites, "apiKey": api_key }),
    )
}
