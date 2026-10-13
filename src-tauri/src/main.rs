#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::de::IgnoredAny;
use serde::Deserialize;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder, WindowEvent};

#[tauri::command]
fn log(msg: String) {
    println!("[bidule] {msg}");
}

// Un bonbon laissé par Candy : une petite fenêtre transparente posée là où elle l'a laissé (sa propre fenêtre la suit partout,
// elle ne peut pas porter un bonbon resté en arrière). Cliquer dessus prévient la fenêtre principale.
#[tauri::command]
async fn bonbon_poser(app: AppHandle, id: u32, x: f64, y: f64, couleur: String) -> Result<(), String> {
    if !["menthe", "rose", "jaune"].contains(&couleur.as_str()) {
        return Err(format!("couleur de bonbon inconnue : {couleur}"));
    }
    WebviewWindowBuilder::new(&app, format!("bonbon-{id}"), WebviewUrl::App("bonbon.html".into()))
        .initialization_script(format!("window.BONBON = {{id: {id}, couleur: '{couleur}'}};"))
        .inner_size(32.0, 24.0)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .shadow(false)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .focused(false)
        .accept_first_mouse(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn bonbon_retirer(app: AppHandle, id: u32) {
    if let Some(w) = app.get_webview_window(&format!("bonbon-{id}")) {
        let _ = w.close();
    }
}

#[tauri::command]
fn bonbon_clic(app: AppHandle, id: u32) {
    let _ = app.emit("bonbon-clic", id);
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

// Les commandes qui lisent des fichiers tournent hors du fil principal (async) : sinon elles bloquent la fenêtre et le Bidule saccade.
#[tauri::command(async)]
fn prompt_times() -> Vec<f64> {
    let home = std::env::var("HOME").unwrap_or_default();
    let cutoff = SystemTime::now() - Duration::from_secs(5 * 3600);
    let mut out = Vec::new();
    for root in [format!("{home}/.claude/projects"), format!("{home}/.claude-masana/projects")] {
        collect(Path::new(&root), cutoff, &mut out);
    }
    out
}

// Jauge de contexte de la conversation en cours dans Claude Desktop (onglet Code). Desktop range chaque session dans
// claude-code-sessions/…/local_*.json (id du journal, modèle, dernier focus) ; le journal est le même que celui de Claude Code,
// dans ~/.claude/projects. On n'y lit que les quantités de tokens de la dernière réponse, jamais le texte ni le titre.
#[derive(Deserialize)]
struct DesktopSession {
    #[serde(rename = "cliSessionId")]
    cli_session_id: Option<String>,
    #[serde(rename = "lastFocusedAt")]
    last_focused_at: Option<f64>,
    #[serde(rename = "isArchived")]
    is_archived: Option<bool>,
    model: Option<String>,
}
#[derive(Deserialize)]
struct UsageLine {
    #[serde(rename = "type")]
    kind: Option<String>,
    subtype: Option<String>,
    #[serde(rename = "isSidechain")]
    is_sidechain: Option<bool>,
    message: Option<UsageMsg>,
    #[serde(rename = "compactMetadata")]
    compact: Option<Compact>,
}
#[derive(Deserialize)]
struct UsageMsg {
    model: Option<String>,
    usage: Option<Usage>,
    content: Option<ActContent>,
}
// Pour la bulle de pensée : le type de chaque bloc et le nom de l'outil appelé. Le texte des blocs n'est pas désérialisé.
#[derive(Deserialize)]
#[serde(untagged)]
enum ActContent {
    Blocks(Vec<ActBlock>),
    Other(IgnoredAny),
}
#[derive(Deserialize)]
struct ActBlock {
    #[serde(rename = "type")]
    kind: Option<String>,
    name: Option<String>,
}
#[derive(Deserialize)]
struct Usage {
    input_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
}
#[derive(Deserialize)]
struct Compact {
    #[serde(rename = "postTokens")]
    post_tokens: Option<u64>,
}
#[derive(serde::Serialize)]
struct Jauge {
    tokens: u64,
    fenetre: u64,
    pourcent: f64,
    source: &'static str,
    // Ce que fait Claude : "pense", le nom de l'outil en cours, ou rien quand il a fini de répondre.
    activite: Option<String>,
    // Un outil demandé sans résultat depuis 20 s : il attend sans doute une permission (ou une longue commande).
    attend: bool,
}

fn walk(dir: &Path, f: &mut dyn FnMut(&Path)) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        if p.is_dir() { walk(&p, f) } else { f(&p) }
    }
}

// Session Desktop qui a eu le focus en dernier : (id du journal, modèle).
fn desktop_session(home: &str) -> Option<(String, Option<String>)> {
    let mut best: Option<(f64, String, Option<String>)> = None;
    walk(Path::new(&format!("{home}/Library/Application Support/Claude/claude-code-sessions")), &mut |p| {
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if !name.starts_with("local_") || !name.ends_with(".json") { return }
        let Ok(txt) = std::fs::read_to_string(p) else { return };
        let Ok(s) = serde_json::from_str::<DesktopSession>(&txt) else { return };
        let (Some(id), Some(t)) = (s.cli_session_id, s.last_focused_at) else { return };
        if s.is_archived == Some(true) || best.as_ref().is_some_and(|b| b.0 >= t) { return }
        best = Some((t, id, s.model));
    });
    best.map(|(_, id, m)| (id, m))
}

fn find_journal(home: &str, id: &str) -> Option<PathBuf> {
    let want = format!("{id}.jsonl");
    let rd = std::fs::read_dir(format!("{home}/.claude/projects")).ok()?;
    rd.flatten().map(|e| e.path().join(&want)).find(|p| p.is_file())
}

// Journal Claude Code le plus récent (terminal), s'il a bougé dans la dernière demi-heure.
fn latest_journal(home: &str) -> Option<PathBuf> {
    let cutoff = SystemTime::now() - Duration::from_secs(1800);
    let mut best: Option<(SystemTime, PathBuf)> = None;
    walk(Path::new(&format!("{home}/.claude/projects")), &mut |p| {
        if p.extension().and_then(|x| x.to_str()) != Some("jsonl") || p.components().any(|c| c.as_os_str() == "subagents") { return }
        let Some(m) = std::fs::metadata(p).and_then(|m| m.modified()).ok() else { return };
        if m > cutoff && best.as_ref().map_or(true, |b| m > b.0) { best = Some((m, p.to_path_buf())) }
    });
    best.map(|b| b.1)
}

type Ctx = Option<(u64, Option<String>, Option<String>)>;
// Le dernier journal lu : tant qu'il n'a pas changé (même taille, même date), on ne le relit pas.
static LAST_CTX: Mutex<Option<(PathBuf, u64, SystemTime, Ctx)>> = Mutex::new(None);

// Tokens dans le contexte d'après la dernière réponse (ou le dernier résumé), en lisant la fin du journal seulement.
fn last_context(path: &Path) -> Ctx {
    let meta = std::fs::metadata(path).ok()?;
    let (len, mtime) = (meta.len(), meta.modified().ok()?);
    if let Some((p, l, m, c)) = LAST_CTX.lock().unwrap().as_ref() {
        if p == path && *l == len && *m == mtime { return c.clone() }
    }
    let c = read_context(path, len);
    *LAST_CTX.lock().unwrap() = Some((path.to_path_buf(), len, mtime, c.clone()));
    c
}

fn read_context(path: &Path, len: u64) -> Ctx {
    let mut f = std::fs::File::open(path).ok()?;
    for tail in [2u64 << 20, 16 << 20, len] {
        let start = len.saturating_sub(tail);
        f.seek(SeekFrom::Start(start)).ok()?;
        let mut buf = Vec::new();
        f.by_ref().take(tail).read_to_end(&mut buf).ok()?;
        let mut found = None;
        let mut act: Option<String> = None;
        for line in buf.split(|&b| b == b'\n') {
            let Ok(l) = serde_json::from_slice::<UsageLine>(line) else { continue };
            if l.is_sidechain == Some(true) { continue }
            if l.kind.as_deref() == Some("system") && l.subtype.as_deref() == Some("compact_boundary") {
                if let Some(t) = l.compact.and_then(|c| c.post_tokens) { found = Some((t, None)) }
            } else if l.kind.as_deref() == Some("user") {
                act = Some("pense".into());      // un prompt ou le résultat d'un outil : Claude reprend la main
            } else if l.kind.as_deref() == Some("assistant") {
                let Some(m) = l.message else { continue };
                if let Some(ActContent::Blocks(b)) = &m.content {
                    for x in b {
                        match x.kind.as_deref() {
                            Some("tool_use") => act = x.name.clone().or(Some("outil".into())),
                            Some("thinking") => act = Some("pense".into()),
                            Some("text") => act = None,
                            _ => {}
                        }
                    }
                }
                let Some(u) = m.usage else { continue };
                let t = u.input_tokens.unwrap_or(0) + u.cache_creation_input_tokens.unwrap_or(0) + u.cache_read_input_tokens.unwrap_or(0);
                if t > 0 { found = Some((t, m.model)) }
            }
        }
        if found.is_some() || start == 0 { return found.map(|(t, m)| (t, m, act)) }
    }
    None
}

// Taille de la fenêtre : 1 M pour les modèles récents (Opus et Sonnet compactent vers 930 k), 200 k pour Haiku et les anciens.
fn window_for(model: &str) -> u64 {
    let old = ["claude-3", "haiku", "sonnet-4-", "opus-4-"].iter().any(|k| model.contains(k));
    if model.contains("[1m]") || !old { 1_000_000 } else { 200_000 }
}

// L'icône de la barre de menu, dessinée par la fenêtre du Bidule (une image PNG de 64 × 36).
#[tauri::command]
fn icone(app: AppHandle, png: Vec<u8>) {
    if let (Some(tray), Ok(im)) = (app.tray_by_id("bidule"), tauri::image::Image::from_bytes(&png)) { let _ = tray.set_icon(Some(im)); }
}

// La session de Claude Desktop qui a le focus : de petits fichiers, relus souvent pour réagir vite quand on change de session.
#[tauri::command(async)]
fn session_active() -> Option<String> {
    desktop_session(&std::env::var("HOME").unwrap_or_default()).map(|(id, _)| id)
}

const ICONE_REPOS: &[u8] = include_bytes!("../icons/tray-repos.png");

// Le Bidule choisi, gardé d'un lancement à l'autre dans un petit fichier du dossier de l'app. Rien au premier lancement.
fn choix_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("bidule.txt"))
}
#[tauri::command]
fn lire_choix(app: AppHandle) -> Option<String> {
    std::fs::read_to_string(choix_path(&app)?).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}
#[tauri::command]
fn garder_choix(app: AppHandle, style: String) {
    let Some(p) = choix_path(&app) else { return };
    if let Some(d) = p.parent() { let _ = std::fs::create_dir_all(d); }
    let _ = std::fs::write(p, style);
}

// Le panneau au milieu de l'écran (menu du clic droit sur le Bidule, menu de l'icône).
#[tauri::command]
fn ouvrir_panneau(app: AppHandle) {
    if let Some(p) = app.get_webview_window("panel") {
        let _ = p.center();
        let _ = p.show();
        let _ = p.set_focus();
        let _ = app.emit("demande-etat", ());
    }
}

// Cacher le Bidule (menu du clic droit sur lui, panneau) ou le faire revenir (panneau, menu de l'icône). Caché, l'icône se fige au repos.
#[tauri::command]
fn montrer_bidule(app: AppHandle, oui: bool) {
    let Some(w) = app.get_webview_window("main") else { return };
    if oui { let _ = w.show(); } else {
        let _ = w.hide();
        if let (Some(tray), Ok(im)) = (app.tray_by_id("bidule"), tauri::image::Image::from_bytes(ICONE_REPOS)) { let _ = tray.set_icon(Some(im)); }
    }
    let _ = app.emit("bidule-visible", oui);
}

#[tauri::command(async)]
fn contexte() -> Option<Jauge> {
    let home = std::env::var("HOME").unwrap_or_default();
    let (path, model, source) = match desktop_session(&home).and_then(|(id, m)| Some((find_journal(&home, &id)?, m))) {
        Some((p, m)) => (p, m, "desktop"),
        None => (latest_journal(&home)?, None, "terminal"),
    };
    // Une conversation sans réponse depuis une demi-heure n'est plus « en cours » : le Bidule dort.
    let recent = std::fs::metadata(&path).and_then(|m| m.modified()).ok()? > SystemTime::now() - Duration::from_secs(1800);
    if !recent { return None }
    let (tokens, seen, act) = last_context(&path)?;
    // Plus rien d'écrit depuis 5 min : il attend sans doute une permission, ou s'est arrêté. Pas de bulle.
    let idle = std::fs::metadata(&path).and_then(|m| m.modified()).ok()?.elapsed().unwrap_or_default();
    let fresh = idle < Duration::from_secs(300);
    let attend = act.as_deref().is_some_and(|a| a != "pense") && idle >= Duration::from_secs(20);
    let activite = act.filter(|_| fresh);
    let model = model.or(seen).unwrap_or_default();
    let fenetre = window_for(&model).max(tokens);
    Some(Jauge { tokens, fenetre, pourcent: tokens as f64 * 100.0 / fenetre as f64, source, activite, attend })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![log, quit, hide_panel, prompt_times, contexte, icone, session_active, montrer_bidule, ouvrir_panneau, lire_choix, garder_choix, bonbon_poser, bonbon_retirer, bonbon_clic])
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
            menu.append(&MenuItem::with_id(app, "show", "Afficher le Bidule", true, None::<&str>)?)?;
            menu.append(&MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?)?;

            let h3 = hidden_at.clone();
            TrayIconBuilder::with_id("bidule")
                .icon(tauri::image::Image::from_bytes(ICONE_REPOS)?)
                .tooltip("Bidule")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "show" => montrer_bidule(app.clone(), true),
                    "open" => ouvrir_panneau(app.clone()),
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
                        let width = panel.outer_size().map(|s| s.width as f64).unwrap_or(440.0 * scale);
                        let x = (pos.x + size.width / 2.0 - width / 2.0).max(0.0);
                        let _ = panel.set_position(PhysicalPosition::new(x, pos.y + size.height + 4.0));
                        let _ = panel.show();
                        let _ = panel.set_focus();
                        let _ = app.emit("demande-etat", ());
                    }
                })
                .build(app)?;

            // Bidule fermé : l'icône se fige sur la limace au repos.
            if let Some(main) = app.get_webview_window("main") {
                let h = app.handle().clone();
                main.on_window_event(move |e| {
                    if let WindowEvent::Destroyed = e {
                        if let (Some(tray), Ok(im)) = (h.tray_by_id("bidule"), tauri::image::Image::from_bytes(ICONE_REPOS)) { let _ = tray.set_icon(Some(im)); }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
