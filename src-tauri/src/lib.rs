use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct BunServer(Mutex<Option<Child>>);

impl Drop for BunServer {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(ref mut child) = *guard {
                let _ = child.kill();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Start the Bun API server as a child process
            let resource_dir = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            // In dev mode, server files are at project root; in production, bundled in resources/_up_/
            let server_dir = if cfg!(debug_assertions) {
                std::env::current_dir().unwrap_or_else(|_| resource_dir.clone())
            } else {
                resource_dir.join("_up_")
            };

            let child = Command::new("bun")
                .arg("run")
                .arg("server/index.ts")
                .current_dir(&server_dir)
                .env("PORT", "3030")
                .spawn();

            match child {
                Ok(c) => {
                    log::info!("Bun server started (pid: {})", c.id());
                    app.manage(BunServer(Mutex::new(Some(c))));
                }
                Err(e) => {
                    log::error!("Failed to start Bun server: {}", e);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<BunServer>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                            log::info!("Bun server stopped");
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
