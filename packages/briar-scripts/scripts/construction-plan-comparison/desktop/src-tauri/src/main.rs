use std::path::PathBuf;

use tauri::{AppHandle, Emitter, Manager};
use tauri::ipc::Channel;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// 工具资源目录（内嵌在 app bundle / 安装目录的 resources/tool 下）
/// 用 current_exe 推导，避免 app.path().resource_dir() 在部分环境卡住
fn tool_dir() -> Result<PathBuf, String> {
	let exe = std::env::current_exe().map_err(|e| format!("无法获取可执行文件路径: {}", e))?;
	let exe_dir = exe.parent().ok_or("无法获取可执行文件目录")?;

	#[cfg(target_os = "macos")]
	let resources_dir = exe_dir
		.parent()
		.ok_or("无法获取 Contents 目录")?
		.join("Resources");

	#[cfg(target_os = "windows")]
	let resources_dir = exe_dir.join("tool");

	#[cfg(not(any(target_os = "macos", target_os = "windows")))]
	let resources_dir = exe_dir.join("resources");

	let prod = resources_dir.join("tool");
	if prod.exists() {
		return Ok(prod);
	}

	// 开发/测试回退：从 src-tauri/resources/tool 读取
	let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
	let dev = manifest_dir.join("resources").join("tool");
	if dev.exists() {
		return Ok(dev);
	}

	Err(format!(
		"未找到工具资源目录，已尝试：{} 和 {}",
		prod.display(),
		dev.display()
	))
}

/// Bun sidecar 路径（仅用于环境检查，运行时仍走 Tauri sidecar API）
fn bun_sidecar_path() -> Result<PathBuf, String> {
	let exe = std::env::current_exe().map_err(|e| format!("无法获取可执行文件路径: {}", e))?;
	let exe_dir = exe.parent().ok_or("无法获取可执行文件目录")?;

	#[cfg(target_os = "windows")]
	return Ok(exe_dir.join("bun.exe"));

	#[cfg(not(target_os = "windows"))]
	return Ok(exe_dir.join("bun"));
}

/// 检查环境：内嵌 Bun sidecar 和 Python 虚拟环境
#[tauri::command]
fn check_environment() -> Result<(bool, String), String> {
	let tool = tool_dir()?;
	#[cfg(target_os = "windows")]
	let venv_python = tool.join("python_encoder").join(".venv").join("Scripts").join("python.exe");
	#[cfg(not(target_os = "windows"))]
	let venv_python = tool.join("python_encoder").join(".venv").join("bin").join("python");

	let bun_path = bun_sidecar_path()?;
	let mut messages = Vec::new();

	// 检查 Bun sidecar
	if bun_path.exists() {
		messages.push(format!("✓ 找到内嵌 bun: {}", bun_path.display()));
	} else {
		messages.push(format!(
			"✗ 未找到内嵌 bun: {}\n  请重新构建桌面应用",
			bun_path.display()
		));
	}

	// 检查 Python 虚拟环境
	if venv_python.exists() {
		messages.push(format!("✓ 找到内嵌 Python 虚拟环境: {}", venv_python.display()));
	} else {
		messages.push(format!(
			"✗ 未找到内嵌 Python 虚拟环境: {}\n  请重新构建桌面应用",
			venv_python.display()
		));
	}

	let ok = messages.iter().all(|m| m.starts_with("✓"));
	Ok((ok, messages.join("\n")))
}

/// 执行比对
#[tauri::command]
async fn run_comparison(
	app: AppHandle,
	docs: Vec<String>,
	on_log: Channel<String>,
) -> Result<String, String> {
	if docs.len() < 2 {
		return Err("至少需要 2 个文档".to_string());
	}

	on_log.send(format!("[debug] 收到文档参数 ({} 个):", docs.len())).map_err(|e| e.to_string())?;
	for (i, d) in docs.iter().enumerate() {
		on_log.send(format!("[debug] doc{}: '{}' 存在={}", i, d, std::path::Path::new(d).exists())).map_err(|e| e.to_string())?;
	}

	let tool = tool_dir()?;
	let script = tool.join("src").join("index.ts");

	// Windows 默认输出到桌面，macOS 保持下载目录不变
	#[cfg(target_os = "windows")]
	let base_dir = dirs::desktop_dir().unwrap_or_else(|| PathBuf::from("."));
	#[cfg(not(target_os = "windows"))]
	let base_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));

	let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
	let out = base_dir.join(format!("bid_compare_result_{}", timestamp));
	std::fs::create_dir_all(&out).map_err(|e| format!("创建输出目录失败: {}", e))?;

	let mut args = vec![
		"run".to_string(),
		"--cwd".to_string(),
		tool.to_string_lossy().to_string(),
		script.to_string_lossy().to_string(),
		"--output".to_string(),
		out.to_string_lossy().to_string(),
	];
	args.push("--docs".to_string());
	for doc in &docs {
		args.push(doc.clone());
	}

	on_log.send("开始执行比对...".to_string()).map_err(|e| e.to_string())?;
	on_log.send(format!("[debug] args 数量: {}", args.len())).map_err(|e| e.to_string())?;
	for (i, a) in args.iter().enumerate() {
		on_log.send(format!("[debug] arg{}: '{}'", i, a)).map_err(|e| e.to_string())?;
	}

	let sidecar = app
		.shell()
		.sidecar("bun")
		.map_err(|e| format!("无法加载 bun sidecar: {}", e))?;

	let (mut rx, child) = sidecar
		.args(&args)
		.spawn()
		.map_err(|e| format!("启动失败: {}", e))?;

	let mut stdout_lines = Vec::new();
	let mut exit_code: Option<i32> = None;
	while let Some(event) = rx.recv().await {
		match event {
			CommandEvent::Stdout(line) => {
				let line = String::from_utf8_lossy(&line).to_string();
				on_log.send(line.clone()).map_err(|e| e.to_string())?;
				stdout_lines.push(line);
			}
			CommandEvent::Stderr(line) => {
				let line = String::from_utf8_lossy(&line).to_string();
				on_log.send(format!("[stderr] {}", line)).map_err(|e| e.to_string())?;
			}
			CommandEvent::Error(e) => {
				on_log.send(format!("[error] {}", e)).map_err(|e| e.to_string())?;
			}
			CommandEvent::Terminated(payload) => {
				exit_code = payload.code;
				on_log.send(format!("[terminated] code={:?}", payload.code))
					.map_err(|e| e.to_string())?;
			}
			_ => {}
		}
	}

	// 等待子进程句柄释放
	let _ = child;

	if exit_code == Some(0) {
		let all_in_one = out.join("index.all-in-one.html");
		if all_in_one.exists() {
			Ok(all_in_one.to_string_lossy().to_string())
		} else {
			Err("未生成 index.all-in-one.html".to_string())
		}
	} else {
		Err(format!("比对失败，退出码: {:?}", exit_code))
	}
}

/// 用系统默认方式打开文件
#[tauri::command]
async fn open_file(app: AppHandle, path: String) -> Result<(), String> {
	app.opener()
		.open_path(path, None::<&str>)
		.map_err(|e| format!("打开失败: {}", e))?;
	Ok(())
}

/// 获取应用版本号
#[tauri::command]
fn get_version() -> String {
	env!("CARGO_PKG_VERSION").to_string()
}

/// 用系统文件选择器选择 PDF 文件
#[tauri::command]
async fn select_pdfs(app: AppHandle) -> Result<Vec<String>, String> {
	let files = app
		.dialog()
		.file()
		.add_filter("PDF", &["pdf"])
		.blocking_pick_files();

	match files {
		Some(paths) => {
			let result: Vec<String> = paths.into_iter().map(|f| f.to_string()).collect();
			Ok(result)
		}
		None => Ok(vec![]),
	}
}

fn main() {
	tauri::Builder::default()
		.plugin(tauri_plugin_shell::init())
		.plugin(tauri_plugin_opener::init())
		.plugin(tauri_plugin_dialog::init())
		.invoke_handler(tauri::generate_handler![
			check_environment,
			run_comparison,
			open_file,
			get_version,
			select_pdfs
		])
		.setup(|app| {
			let app_handle = app.handle().clone();
			let window = app.get_webview_window("main").expect("main window not found");
			window.on_window_event(move |event| {
				if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
					eprintln!("[drag-drop] 收到 {} 个路径", paths.len());
					for (i, p) in paths.iter().enumerate() {
						eprintln!("[drag-drop] path{}: {}", i, p.display());
					}
					let pdf_paths: Vec<String> = paths
						.iter()
						.filter(|p| {
							p.extension()
								.map(|ext| ext.eq_ignore_ascii_case("pdf"))
								.unwrap_or(false)
						})
						.map(|p| p.to_string_lossy().to_string())
						.collect();
					eprintln!("[drag-drop] 过滤后 PDF 路径: {:?}", pdf_paths);
					if !pdf_paths.is_empty() {
						let app_handle = app_handle.clone();
						tauri::async_runtime::spawn(async move {
							let _ = app_handle.emit("files-dropped", pdf_paths);
						});
					}
				}
			});
			Ok(())
		})
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn test_tool_dir_no_panic() {
		// current_exe 在测试模式下也能拿到路径，主要验证不 panic
		let _ = tool_dir();
	}

	#[test]
	fn test_bun_sidecar_path_no_panic() {
		let _ = bun_sidecar_path();
	}
}
