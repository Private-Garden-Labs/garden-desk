#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{Value, json};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex, atomic::AtomicBool, atomic::AtomicU64, atomic::Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

mod artifact_commands;
mod attachment_commands;
mod commands;
mod core_arguments;
mod core_transport;
mod diagnostics;
mod drop_commands;
mod package_integrity;
mod question_commands;
mod session_commands;
mod windows_setup;
#[cfg(windows)]
mod windows_setup_windows;

pub(crate) struct CoreBridge {
    child: Mutex<Option<CommandChild>>,
    exited: Arc<AtomicBool>,
    endpoint: String,
    next_id: AtomicU64,
    _package_locks: package_integrity::PackageLocks,
}

#[cfg(debug_assertions)]
fn forward_core_event(event: CommandEvent) {
    match event {
        CommandEvent::Stdout(bytes) => {
            print!("[core stdout] {}", String::from_utf8_lossy(&bytes));
        }
        CommandEvent::Stderr(bytes) => {
            eprint!("[core stderr] {}", String::from_utf8_lossy(&bytes));
        }
        CommandEvent::Error(error) => eprintln!("[core error] {error}"),
        CommandEvent::Terminated(status) => eprintln!(
            "[core terminated] code={:?} signal={:?}",
            status.code, status.signal
        ),
        _ => {}
    }
}

#[cfg(not(debug_assertions))]
fn forward_core_event(_event: CommandEvent) {}

impl CoreBridge {
    fn start(app: &AppHandle) -> Result<Self, String> {
        let data_root = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        let resource_root = app
            .path()
            .resource_dir()
            .map_err(|error| error.to_string())?;
        let workspace = data_root.join("state");
        let ready_file = data_root.join("core.ready");
        let core_resources = resource_root.join("resources/core");
        let package_locks =
            package_integrity::lock_packaged_runtime(&resource_root, &core_resources)?;
        fs::create_dir_all(&workspace).map_err(|error| error.to_string())?;
        remove_stale_ready_file(&ready_file)?;

        let mut arguments = vec![
            "--workspace".to_owned(),
            path_text(&workspace)?,
            "--model-store".to_owned(),
            path_text(&core_resources.join("models"))?,
            "--profile".to_owned(),
            "auto".to_owned(),
            "--migration-directory".to_owned(),
            path_text(&core_resources.join("migrations"))?,
            "--prompt-directory".to_owned(),
            path_text(&core_resources.join("prompts"))?,
            "--ready-file".to_owned(),
            path_text(&ready_file)?,
            "--parent-pid".to_owned(),
            std::process::id().to_string(),
        ];
        core_arguments::add_platform_arguments(&mut arguments, &core_resources)?;
        let command = app
            .shell()
            .sidecar("garden-desk-core")
            .map_err(|error| error.to_string())?
            .args(arguments);
        #[cfg(target_os = "macos")]
        let command = command.env("NODE_OPTIONS", "--jitless");
        let (mut events, child) = command.spawn().map_err(|error| error.to_string())?;
        let exited = Arc::new(AtomicBool::new(false));
        let terminated = exited.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = events.recv().await {
                if matches!(event, CommandEvent::Terminated(_)) {
                    terminated.store(true, Ordering::SeqCst);
                }
                forward_core_event(event);
            }
        });
        let endpoint = wait_for_ready_file(&ready_file)?;
        Ok(Self {
            child: Mutex::new(Some(child)),
            exited,
            endpoint,
            next_id: AtomicU64::new(1),
            _package_locks: package_locks,
        })
    }

    pub(crate) fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let result = self.call_inner(method, params);
        #[cfg(debug_assertions)]
        if let Err(error) = &result {
            eprintln!("[core rpc] {method} failed: {error}");
        }
        result
    }

    fn call_inner(&self, method: &str, params: Value) -> Result<Value, String> {
        let request = json!({
            "jsonrpc": "2.0",
            "id": self.next_id.fetch_add(1, Ordering::Relaxed),
            "method": method,
            "params": params,
            "protocolVersion": 1,
        });
        let response = core_transport::exchange(&self.endpoint, &format!("{request}\n"))?;
        let envelope: Value =
            serde_json::from_slice(&response).map_err(|error| error.to_string())?;
        if let Some(error) = envelope.get("error") {
            return Err(error
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("Garden Desk Core rejected the request.")
                .to_owned());
        }
        envelope
            .get("result")
            .cloned()
            .ok_or_else(|| "Garden Desk Core returned no result.".to_owned())
    }

    fn stop(&self) {
        let Ok(mut child) = self.child.lock() else {
            return;
        };
        let Some(child) = child.take() else {
            return;
        };
        if self.exited.load(Ordering::SeqCst) {
            return;
        }
        #[cfg(unix)]
        {
            // SAFETY: kill only sends a signal to the sidecar process id.
            unsafe { libc::kill(child.pid() as libc::pid_t, libc::SIGTERM) };
            let deadline = Instant::now() + Duration::from_secs(10);
            while !self.exited.load(Ordering::SeqCst) && Instant::now() < deadline {
                std::thread::sleep(Duration::from_millis(20));
            }
        }
        if !self.exited.load(Ordering::SeqCst) {
            let _ = child.kill();
        }
    }
}

pub(crate) fn path_text(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(str::to_owned)
        .ok_or_else(|| "Garden Desk requires UTF-8 application paths.".to_owned())
}

fn remove_stale_ready_file(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn wait_for_ready_file(path: &Path) -> Result<String, String> {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        match fs::read_to_string(path) {
            Ok(endpoint) if !endpoint.trim().is_empty() => return Ok(endpoint.trim().to_owned()),
            Ok(_) | Err(_) if Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(25));
            }
            Ok(_) | Err(_) => return Err("Garden Desk Core did not become ready.".to_owned()),
        }
    }
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let core = CoreBridge::start(app.handle()).map_err(std::io::Error::other)?;
            app.manage(core);
            app.manage(diagnostics::DebugSnapshots::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::append_user_message,
            attachment_commands::add_dropped_files,
            artifact_commands::open_artifact,
            artifact_commands::save_artifact,
            commands::add_dropped_folders,
            question_commands::cancel_agent,
            question_commands::answer_agent_question,
            question_commands::dismiss_agent_question,
            commands::choose_folder,
            commands::choose_files,
            session_commands::create_session,
            drop_commands::classify_dropped_paths,
            diagnostics::create_debug_snapshot,
            session_commands::delete_session,
            commands::desktop_bootstrap,
            commands::get_agent_run,
            commands::get_agent_trace,
            commands::list_agent_runs,
            commands::list_attachments,
            commands::list_messages,
            session_commands::list_sessions,
            commands::load_draft,
            commands::model_status,
            commands::open_catalog_folder,
            commands::open_folder,
            commands::open_release_page,
            attachment_commands::open_attachment,
            commands::remove_attachment,
            commands::reorder_folders,
            session_commands::rename_session,
            commands::revoke_folder,
            diagnostics::reveal_debug_snapshot,
            commands::save_draft,
            windows_setup::secure_workspace_status,
            commands::start_agent,
            commands::unload_model,
            windows_setup::configure_secure_workspace,
        ])
        .build(tauri::generate_context!())
        .expect("Garden Desk desktop failed");
    app.run(|app, event| {
        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. })
            && let Some(core) = app.try_state::<CoreBridge>()
        {
            core.stop();
        }
    });
}
