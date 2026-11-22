mod store;
use store::{Change, Library, Record};
use tauri::{
    Manager, State,
    ipc::{InvokeBody, Request},
};

#[tauri::command]
async fn catalog(library: State<'_, Library>) -> Result<Vec<Record>, String> {
    library.records()
}
#[tauri::command]
async fn commit(library: State<'_, Library>, changes: Vec<Change>) -> Result<(), String> {
    library.commit(changes)
}
#[tauri::command]
async fn append_object(library: State<'_, Library>, request: Request<'_>) -> Result<(), String> {
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| "缺少分块标识".to_string())
    };
    let id = header("x-upload")?.parse().map_err(|_| "无效导入会话")?;
    let offset = header("x-offset")?.parse().map_err(|_| "无效分块位置")?;
    match request.body() {
        InvokeBody::Raw(bytes) => library.append(id, offset, bytes),
        // Android WebView can encode binary IPC bodies as JSON arrays.
        InvokeBody::Json(value) => library.append(
            id,
            offset,
            &serde_json::from_value::<Vec<u8>>(value.clone()).map_err(|e| e.to_string())?,
        ),
    }
}
#[tauri::command]
async fn begin_object(library: State<'_, Library>, size: u64) -> Result<u32, String> {
    library.begin(size)
}
#[tauri::command]
async fn finish_object(library: State<'_, Library>, id: u32) -> Result<String, String> {
    library.finish(id)
}
#[tauri::command]
async fn cancel_object(library: State<'_, Library>, id: u32) -> Result<(), String> {
    library.cancel(id)
}
#[tauri::command]
fn object_path(library: State<'_, Library>, digest: String) -> Result<std::path::PathBuf, String> {
    library.object(&digest)
}
#[tauri::command]
fn library_path(library: State<'_, Library>) -> std::path::PathBuf {
    library.root.clone()
}
pub fn builder() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let root = app.path().app_data_dir()?.join("library");
            app.manage(Library::open(&root).map_err(std::io::Error::other)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            catalog,
            commit,
            begin_object,
            append_object,
            finish_object,
            cancel_object,
            object_path,
            library_path
        ])
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    builder()
        .run(tauri::generate_context!())
        .expect("hearthread runtime failed")
}
