use bram_audio_parser::load_audio_presentation;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn get_wav_data(path: &str) -> Result<Vec<Vec<f32>>, String> {
    match load_audio_presentation(path) {
        Ok(presentation) => Ok(vec![
            presentation.first_canal_points,
            presentation.second_canal_points,
        ]),

        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_wav_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
