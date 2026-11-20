//! Runs the shipped interface with its real IPC handlers in a disposable WKWebView library.
use tauri::{Listener, Manager, webview::PageLoadEvent};
fn main() {
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = format!("app.hearthread.smoke-{}", std::process::id());
    context.config_mut().app.windows[0].background_throttling =
        Some(tauri::utils::config::BackgroundThrottlingPolicy::Disabled);
    let app = hearthread_lib::builder()
        .on_page_load(|view, payload| {
            if payload.event() == PageLoadEvent::Finished && view.label() == "main" {
                view.eval(include_str!("../../tests/native-smoke.js"))
                    .unwrap();
            }
        })
        .build(context)
        .unwrap();
    let dir = app.path().app_data_dir().unwrap();
    let handle = app.handle().clone();
    app.listen("smoke-step", |event| eprintln!("smoke {}", event.payload()));
    app.listen("smoke-result", move |event| {
        println!("WKWebView {}", event.payload());
        let result: serde_json::Value = serde_json::from_str(event.payload()).unwrap();
        handle.exit(if result["ok"] == true { 0 } else { 1 });
    });
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(90));
        eprintln!("WKWebView smoke timeout");
        handle.exit(2)
    });
    app.run(move |app, event| {
        if let tauri::RunEvent::Ready = event {
            #[cfg(target_os = "macos")]
            {
                let _ = app.show();
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        if let tauri::RunEvent::Exit = event {
            let _ = std::fs::remove_dir_all(&dir);
        }
    });
}
