use base64::{engine::general_purpose, Engine as _};
use bram_audio_parser::load_presentation;
use bram_input_exporter::export_inputs;

#[tauri::command]
fn get_wav_data(path: &str, rate: u32) -> Result<Vec<Vec<f32>>, String> {
    match load_presentation(path, rate) {
        Ok(presentation) => Ok(vec![
            presentation.left_channel_points,
            presentation.right_channel_points,
        ]),

        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn read_audio_file_b64(path: &str) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let base64 = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:audio/wav;base64,{}", base64))
}

#[tauri::command]
fn export_barm_data(path: &str, data: Vec<u8>, rate: u8) -> Result<String, String> {
    match export_inputs(path, &data, rate) {
        Ok(_) => Ok("Export successful.".to_string()),
        Err(e) => Err(format!("Error exporting barm: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_wav_data,
            read_audio_file_b64,
            export_barm_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
