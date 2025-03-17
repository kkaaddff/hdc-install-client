// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::env;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn call_hdc(app: tauri::AppHandle, args: Vec<String>) -> Result<(String, i32), String> {
    println!("args: {:?}", args);
    let sidecar_command = app.shell().sidecar("hdc").unwrap().args(args);
    let (mut rx, mut _child) = sidecar_command.spawn().unwrap();
    println!("hdc 执行成功");

    let mut stdout = String::new();
    let mut code = -1;

    // 接收并处理所有输出
    while let Some(line) = rx.recv().await {
        match line {
            CommandEvent::Stdout(line) => {
                stdout.push_str(&String::from_utf8_lossy(&line));
            }
            CommandEvent::Stderr(line) => {
                stdout.push_str("[错误] ");
                stdout.push_str(&String::from_utf8_lossy(&line));
            }
            CommandEvent::Error(err) => {
                return Err(format!("执行命令时出错: {}", err));
            }
            CommandEvent::Terminated(payload) => {
                code = payload.code.unwrap();
            }
            _ => {}
        }
    }
    println!("stdout: {}", stdout);
    println!("code: {}", code);

    Ok((stdout, code))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![call_hdc])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
