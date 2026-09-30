#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::de::IgnoredAny;
use serde::Deserialize;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WindowEvent};

#[tauri::command]
fn log(msg: String) {
    println!("[bidule] {msg}");
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn hide_panel(app: AppHandle) {
    if let Some(p) = app.get_webview_window("panel") {
        let _ = p.hide();
    }
}

// Pour deviner l'humeur, on ne retient que le type, l'heure et la forme du contenu de chaque ligne.
// Le texte des messages n'est jamais extrait dans une variable : il n'est ni utilisé, ni gardé, ni envoyé.
#[derive(Deserialize)]
struct Line {
    #[serde(rename = "type")]
    kind: Option<String>,
    timestamp: Option<String>,
    #[serde(rename = "isMeta")]
    is_meta: Option<bool>,
    #[serde(rename = "isSidechain")]
    is_sidechain: Option<bool>,
    message: Option<Msg>,
}
#[derive(Deserialize)]
struct Msg {
    content: Option<Content>,
}
#[derive(Deserialize)]
#[serde(untagged)]
enum Content {
    Blocks(Vec<Block>),
    Other(IgnoredAny),
}
#[derive(Deserialize)]
struct Block {
    #[serde(rename = "type")]
    kind: Option<String>,
}

fn iso_to_epoch(s: &str) -> Option<f64> {
    let n = |a: usize, l: usize| s.get(a..a + l)?.parse::<i64>().ok();
    let (y, mo, d, h, mi, se) = (n(0, 4)?, n(5, 2)?, n(8, 2)?, n(11, 2)?, n(14, 2)?, n(17, 2)?);
    let y2 = if mo <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let doy = (153 * ((mo + 9) % 12) + 2) / 5 + d - 1;
    let days = era * 146097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719468;
    Some((days * 86400 + h * 3600 + mi * 60 + se) as f64)
}

fn collect(dir: &Path, cutoff: SystemTime, out: &mut Vec<f64>) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        if p.is_dir() {
            collect(&p, cutoff, out);
            continue;
        }
        if p.extension().and_then(|x| x.to_str()) != Some("jsonl") {
            continue;
        }
        if e.metadata().and_then(|m| m.modified()).map(|m| m < cutoff).unwrap_or(true) {
            continue;
        }
        let Ok(f) = std::fs::File::open(&p) else { continue };
        for line in BufReader::new(f).lines().map_while(Result::ok) {
            let Ok(l) = serde_json::from_str::<Line>(&line) else { continue };
            if l.kind.as_deref() != Some("user") || l.is_meta == Some(true) || l.is_sidechain == Some(true) {
                continue;
            }
            // Un résultat d'outil est une liste avec un bloc "tool_result" : on ne regarde que le type des blocs.
            let human = match l.message.and_then(|m| m.content) {
                Some(Content::Blocks(b)) => !b.iter().any(|x| x.kind.as_deref() == Some("tool_result")),
                Some(Content::Other(_)) => true,
                None => false,
            };
            if human {
                if let Some(t) = l.timestamp.as_deref().and_then(iso_to_epoch) {
                    out.push(t);
                }
            }
        }
    }
}

#[tauri::command]
fn prompt_times() -> Vec<f64> {
    let home = std::env::var("HOME").unwrap_or_default();
    let cutoff = SystemTime::now() - Duration::from_secs(5 * 3600);
    let mut out = Vec::new();
    for root in [format!("{home}/.claude/projects"), format!("{home}/.claude-masana/projects")] {
        collect(Path::new(&root), cutoff, &mut out);
    }
    out
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![log, quit, hide_panel, prompt_times])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Le panneau se cache quand il perd le focus ; on retient quand, pour qu'un clic sur l'icône ne le rouvre pas aussitôt.
            let hidden_at = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(5)));
            if let Some(panel) = app.get_webview_window("panel") {
                let p2 = panel.clone();
                let h2 = hidden_at.clone();
                panel.on_window_event(move |e| {
                    if let WindowEvent::Focused(false) = e {
                        let _ = p2.hide();
                        *h2.lock().unwrap() = Instant::now();
                    }
                });
            }

            let menu = Menu::new(app)?;
            menu.append(&MenuItem::with_id(app, "open", "Ouvrir le panneau", true, None::<&str>)?)?;
            menu.append(&MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?)?;

            let h3 = hidden_at.clone();
            TrayIconBuilder::with_id("bidule")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Bidule")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "open" => {
                        if let Some(p) = app.get_webview_window("panel") {
                            let _ = p.center();
                            let _ = p.show();
                            let _ = p.set_focus();
                            let _ = app.emit("demande-etat", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, rect, .. } = event {
                        let app = tray.app_handle();
                        let Some(panel) = app.get_webview_window("panel") else { return };
                        if panel.is_visible().unwrap_or(false) {
                            let _ = panel.hide();
                            return;
                        }
                        if h3.lock().unwrap().elapsed() < Duration::from_millis(300) {
                            return;
                        }
                        let scale = panel.scale_factor().unwrap_or(1.0);
                        let pos = rect.position.to_physical::<f64>(scale);
                        let size = rect.size.to_physical::<f64>(scale);
                        let width = panel.outer_size().map(|s| s.width as f64).unwrap_or(380.0 * scale);
                        let x = (pos.x + size.width / 2.0 - width / 2.0).max(0.0);
                        let _ = panel.set_position(PhysicalPosition::new(x, pos.y + size.height + 4.0));
                        let _ = panel.show();
                        let _ = panel.set_focus();
                        let _ = app.emit("demande-etat", ());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
