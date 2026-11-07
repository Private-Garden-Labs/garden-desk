use crate::{CoreBridge, path_text};
use serde_json::{Value, json};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
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

fn pick_folder(app: &AppHandle, title: &str) -> Result<Option<String>, String> {
    let Some(selection) = app.dialog().file().set_title(title).blocking_pick_folder() else {
        return Ok(None);
    };
    let path = selection.into_path().map_err(|error| error.to_string())?;
    Ok(Some(path_text(&path)?))
}

#[tauri::command]
pub(crate) async fn company_packs(core: State<'_, CoreBridge>) -> Result<Value, String> {
    core.call("companyPacks.status", json!({}))
}

#[tauri::command]
pub(crate) async fn choose_company_pack(app: AppHandle) -> Result<Option<String>, String> {
    let Some(selection) = app
        .dialog()
        .file()
        .set_title("Import a company pack")
        .add_filter("Company pack", &["gdpack"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = selection.into_path().map_err(|error| error.to_string())?;
    Ok(Some(path_text(&path)?))
}

#[tauri::command]
pub(crate) async fn import_company_pack(
    core: State<'_, CoreBridge>,
    path: String,
    trust: Option<String>,
) -> Result<Value, String> {
    core.call(
        "companyPacks.import",
        json!({ "path": path, "trust": trust }),
    )
}

#[tauri::command]
pub(crate) async fn choose_company_pack_folder(
    app: AppHandle,
    core: State<'_, CoreBridge>,
) -> Result<Option<Value>, String> {
    let Some(path) = pick_folder(&app, "Choose the company pack folder")? else {
        return Ok(None);
    };
    Ok(Some(
        core.call("companyPacks.setFolder", json!({ "path": path }))?,
    ))
}

#[tauri::command]
pub(crate) async fn build_company_pack(
    app: AppHandle,
    core: State<'_, CoreBridge>,
    name: String,
    id: String,
    publisher: String,
) -> Result<Option<Value>, String> {
    let Some(source) = pick_folder(&app, "Choose the folder with the documents")? else {
        return Ok(None);
    };
    let Some(output) = pick_folder(&app, "Choose where to save the pack")? else {
        return Ok(None);
    };
    Ok(Some(core.call(
        "companyPacks.build",
        json!({
            "sourcePath": source,
            "name": name,
            "id": id,
            "publisher": publisher,
            "outputDirectory": output,
        }),
    )?))
}
