use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct BunServer(Mutex<Option<Child>>);

/// Resolve the full path to `bun` binary.
/// macOS GUI apps don't inherit the user's shell PATH, so we check common locations.
fn find_bun() -> String {
    let candidates = if cfg!(target_os = "windows") {
        vec![]
    } else {
        let home = std::env::var("HOME").unwrap_or_default();
        vec![
            format!("{}/.bun/bin/bun", home),
            "/usr/local/bin/bun".to_string(),
            "/opt/homebrew/bin/bun".to_string(),
        ]
    };
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return path.clone();
        }
    }
    "bun".to_string()
}

impl Drop for BunServer {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(ref mut child) = *guard {
                let _ = child.kill();
            }
        }
    }
}

fn wait_for_server(_url: &str, max_attempts: u32) -> bool {
    for _ in 0..max_attempts {
        if std::net::TcpStream::connect("127.0.0.1:3030").is_ok() {
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
    }
    false
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

            let bun = find_bun();
            let child = Command::new(&bun)
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

            // Wait for server to be ready, then navigate the window to it
            wait_for_server("127.0.0.1:3030", 20);

            if let Some(window) = app.get_webview_window("main") {
                let url = tauri::Url::parse("http://localhost:3030").unwrap();
                let _ = window.navigate(url);
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
