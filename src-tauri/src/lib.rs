use reqwest;
use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use walkdir::WalkDir;
use zip::ZipArchive;

#[tauri::command]
async fn call_hdc(app: tauri::AppHandle, download_url: String) -> Result<(String, i32), String> {
    println!("download_url: {:?}", download_url);

    let mut stdout = String::new();
    let mut code = -1;

    let status_msg = "正在检查设备连接状态...\n";
    stdout.push_str(status_msg);
    app.emit("hdc-output", status_msg).unwrap();

    let list_command = app
        .shell()
        .sidecar("hdc")
        .unwrap()
        .args(&["list", "targets"]);
    let (mut rx_list, mut _child_list) = list_command.spawn().unwrap();

    let mut devices_output = String::new();

    while let Some(event) = rx_list.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let line_str = String::from_utf8_lossy(&line).to_string();
                devices_output.push_str(&line_str);
                stdout.push_str(&line_str);
                app.emit("hdc-output", &line_str).unwrap();
            }
            CommandEvent::Stderr(line) => {
                let line_str = format!("[错误] {}", String::from_utf8_lossy(&line));
                devices_output.push_str(&line_str);
                stdout.push_str(&line_str);
                app.emit("hdc-output", &line_str).unwrap();
            }
            CommandEvent::Error(err) => {
                let err_msg = format!("执行命令时出错: {}\n", err);
                stdout.push_str(&err_msg);
                app.emit("hdc-output", &err_msg).unwrap();
            }
            CommandEvent::Terminated(payload) => {
                code = payload.code.unwrap_or_default();
            }
            _ => {}
        }
    }

    if devices_output.contains("[Empty]") || devices_output.contains("[错误]") {
        let no_device_msg = "没有可操作设备，开启鸿蒙手机开发者模式并检测设备连接后重试\n";
        stdout.push_str(no_device_msg);
        app.emit("hdc-output", no_device_msg).unwrap();
        let no_device_msg = "https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-developer-mode-V5\n";
        app.emit("hdc-output", no_device_msg).unwrap();
        return Ok((stdout, 1));
    }

    let temp_dir = env::temp_dir();
    let file_name = download_url.split('/').last().unwrap_or("app.hap");
    let file_path = temp_dir.join(file_name);

    if file_path.exists() {
        let cache_msg = format!("找到本地缓存文件: {}\n", file_path.display());
        stdout.push_str(&cache_msg);
        app.emit("hdc-output", &cache_msg).unwrap();
    } else {
        let download_start_msg = format!("开始下载文件: {}\n", download_url);
        stdout.push_str(&download_start_msg);
        app.emit("hdc-output", &download_start_msg).unwrap();

        let response = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()
            .map_err(|e| format!("创建HTTP客户端失败: {}", e))?
            .get(&download_url)
            .send()
            .await
            .map_err(|e| format!("下载文件失败: {}", e))?;

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("读取文件内容失败: {}", e))?;

        fs::write(&file_path, &bytes).map_err(|e| format!("保存文件失败: {}", e))?;

        let download_complete_msg = format!("文件下载完成: {}\n", file_path.display());
        stdout.push_str(&download_complete_msg);
        app.emit("hdc-output", &download_complete_msg).unwrap();
    }

    let app_path = if file_name.to_lowercase().ends_with(".zip") {
        let extract_msg = format!("检测到ZIP文件，开始解压: {}\n", file_path.display());
        stdout.push_str(&extract_msg);
        app.emit("hdc-output", &extract_msg).unwrap();

        let extract_dir = file_path.parent().unwrap_or(&temp_dir);
        let zip_base_name = Path::new(file_name).file_stem().unwrap_or_default();
        let extract_folder = extract_dir.join(zip_base_name);

        if !extract_folder.exists() {
            let create_dir_msg = format!("创建解压目录: {}\n", extract_folder.display());
            stdout.push_str(&create_dir_msg);
            app.emit("hdc-output", &create_dir_msg).unwrap();

            fs::create_dir_all(&extract_folder).map_err(|e| format!("创建解压目录失败: {}", e))?;

            let extract_start_msg = format!("开始解压文件到: {}\n", extract_folder.display());
            stdout.push_str(&extract_start_msg);
            app.emit("hdc-output", &extract_start_msg).unwrap();

            let file = fs::File::open(&file_path).map_err(|e| format!("打开ZIP文件失败: {}", e))?;
            let mut archive =
                ZipArchive::new(file).map_err(|e| format!("读取ZIP文件失败: {}", e))?;

            for i in 0..archive.len() {
                let mut file = archive
                    .by_index(i)
                    .map_err(|e| format!("访问ZIP文件内容失败: {}", e))?;
                let outpath = match file.enclosed_name() {
                    Some(path) => extract_folder.join(path),
                    None => continue,
                };

                if file.name().ends_with('/') {
                    fs::create_dir_all(&outpath).map_err(|e| format!("创建目录失败: {}", e))?;
                } else {
                    if let Some(p) = outpath.parent() {
                        if !p.exists() {
                            fs::create_dir_all(p).map_err(|e| format!("创建父目录失败: {}", e))?;
                        }
                    }
                    let mut outfile =
                        fs::File::create(&outpath).map_err(|e| format!("创建文件失败: {}", e))?;
                    io::copy(&mut file, &mut outfile)
                        .map_err(|e| format!("写入文件失败: {}", e))?;
                }
            }

            let extract_complete_msg = format!("文件解压完成\n");
            stdout.push_str(&extract_complete_msg);
            app.emit("hdc-output", &extract_complete_msg).unwrap();
        } else {
            let dir_exists_msg = format!("解压目录已存在: {}\n", extract_folder.display());
            stdout.push_str(&dir_exists_msg);
            app.emit("hdc-output", &dir_exists_msg).unwrap();
        }

        let search_msg = "开始查找.hap文件...\n";
        stdout.push_str(search_msg);
        app.emit("hdc-output", search_msg).unwrap();

        let mut hap_file: Option<PathBuf> = None;

        for entry in WalkDir::new(extract_dir) {
            let entry = entry.map_err(|e| format!("遍历目录失败: {}", e))?;
            let path = entry.path();

            if path.is_file()
                && path
                    .extension()
                    .map_or(false, |ext| ext.to_string_lossy().to_lowercase() == "hap")
            {
                hap_file = Some(path.to_path_buf());
                break;
            }
        }

        match hap_file {
            Some(path) => {
                let found_msg = format!("找到.hap文件: {}\n", path.display());
                stdout.push_str(&found_msg);
                app.emit("hdc-output", &found_msg).unwrap();
                path
            }
            None => {
                let error_msg = "在解压包中未找到.hap文件\n";
                stdout.push_str(error_msg);
                app.emit("hdc-output", error_msg).unwrap();
                return Ok((stdout, 1));
            }
        }
    } else {
        file_path
    };

    let install_start_msg = "开始安装应用...\n";
    stdout.push_str(install_start_msg);
    app.emit("hdc-output", install_start_msg).unwrap();

    let install_command = app
        .shell()
        .sidecar("hdc")
        .unwrap()
        .args(&["install", app_path.to_str().unwrap()]);
    let (mut rx_install, mut _child_install) = install_command.spawn().unwrap();

    while let Some(event) = rx_install.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let line_str = String::from_utf8_lossy(&line).to_string();
                stdout.push_str(&line_str);
                app.emit("hdc-output", &line_str).unwrap();
            }
            CommandEvent::Stderr(line) => {
                let line_str = format!("[错误] {}", String::from_utf8_lossy(&line));
                stdout.push_str(&line_str);
                app.emit("hdc-output", &line_str).unwrap();
            }
            CommandEvent::Error(err) => {
                let err_msg = format!("执行命令时出错: {}\n", err);
                stdout.push_str(&err_msg);
                app.emit("hdc-output", &err_msg).unwrap();
            }
            CommandEvent::Terminated(payload) => {
                code = payload.code.unwrap_or_default();
                let status_msg = if code == 0 {
                    "应用安装成功!\n"
                } else {
                    "应用安装失败!\n"
                };
                stdout.push_str(status_msg);
                app.emit("hdc-output", status_msg).unwrap();
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
