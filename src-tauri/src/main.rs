#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::de::IgnoredAny;
use serde::Deserialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

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
    surligner(&app, false);
}

// L'icône de la barre de menus reste en surbrillance tant que le panneau est ouvert, comme pour les autres apps (macOS).
fn surligner(app: &AppHandle, on: bool) {
    #[cfg(target_os = "macos")]
    if let Some(tray) = app.tray_by_id("bidule") {
        let _ = tray.with_inner_tray_icon(move |t| {
            if let (Some(item), Some(mtm)) = (t.ns_status_item(), objc2::MainThreadMarker::new()) {
                if let Some(b) = item.button(mtm) { b.highlight(on); }
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, on);
}

// Retour haptique du trackpad Force Touch (macOS) : "clic" (neutre), "cran" (alignement) ou "palier". Avec une souris ou sous Windows, rien.
#[tauri::command]
fn haptique(motif: String) {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::{NSHapticFeedbackManager, NSHapticFeedbackPattern as P, NSHapticFeedbackPerformanceTime, NSHapticFeedbackPerformer};
        let p = match motif.as_str() { "cran" => P::Alignment, "palier" => P::LevelChange, _ => P::Generic };
        NSHapticFeedbackManager::defaultPerformer().performFeedbackPattern_performanceTime(p, NSHapticFeedbackPerformanceTime::Now);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = motif;
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

fn prompt_times_lire() -> Vec<f64> {
    let home = std::env::var("HOME").unwrap_or_default();
    let cutoff = SystemTime::now() - Duration::from_secs(5 * 3600);
    let mut out = Vec::new();
    for root in [format!("{home}/.claude/projects"), format!("{home}/.claude-masana/projects")] {
        collect(Path::new(&root), cutoff, &mut out);
    }
    out
}

// Les heures des prompts des 7 derniers jours, pour les graphiques d'activité du panneau (onglet Claude).
fn prompts_semaine_lire() -> Vec<f64> {
    let home = std::env::var("HOME").unwrap_or_default();
    let cutoff = SystemTime::now() - Duration::from_secs(7 * 86400);
    let debut = cutoff.duration_since(SystemTime::UNIX_EPOCH).map_or(0.0, |d| d.as_secs_f64());
    let mut out = Vec::new();
    for root in [format!("{home}/.claude/projects"), format!("{home}/.claude-masana/projects")] {
        collect(Path::new(&root), cutoff, &mut out);
    }
    out.retain(|&t| t >= debut);
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
    // le dossier où tourne la session : seulement son dernier nom, pour la liste des sessions du panneau
    cwd: Option<String>,
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
    [".claude", ".claude-masana"].iter().filter_map(|d| std::fs::read_dir(format!("{home}/{d}/projects")).ok())
        .flat_map(|rd| rd.flatten().map(|e| e.path().join(&want))).find(|p| p.is_file())
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

// (tokens, modèle, activité, dossier du projet)
type Ctx = Option<(u64, Option<String>, Option<String>, Option<String>)>;
// Les journaux déjà lus : tant que l'un n'a pas changé (même taille, même date), on ne le relit pas.
static LAST_CTX: Mutex<Option<HashMap<PathBuf, (u64, SystemTime, Ctx)>>> = Mutex::new(None);

// Tokens dans le contexte d'après la dernière réponse (ou le dernier résumé), en lisant la fin du journal seulement.
fn last_context(path: &Path) -> Ctx {
    let meta = std::fs::metadata(path).ok()?;
    let (len, mtime) = (meta.len(), meta.modified().ok()?);
    if let Some((l, m, c)) = LAST_CTX.lock().unwrap().as_ref().and_then(|h| h.get(path)) {
        if *l == len && *m == mtime { return c.clone() }
    }
    let c = read_context(path, len);
    LAST_CTX.lock().unwrap().get_or_insert_with(HashMap::new).insert(path.to_path_buf(), (len, mtime, c.clone()));
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
        let mut cwd: Option<String> = None;
        for line in buf.split(|&b| b == b'\n') {
            let Ok(l) = serde_json::from_slice::<UsageLine>(line) else { continue };
            if l.is_sidechain == Some(true) { continue }
            if let Some(d) = l.cwd { cwd = Path::new(&d).file_name().map(|n| n.to_string_lossy().to_string()) }
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
        if found.is_some() || start == 0 { return found.map(|(t, m)| (t, m, act, cwd)) }
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
fn session_active_lire() -> Option<String> {
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

// L'état du Bidule, gardé d'un lancement à l'autre (index.html : garder) : humeur choisie, parties, caché ou non, réglages, sa place à l'écran.
// Un texte JSON, que l'app ne lit pas : seule la fenêtre du Bidule s'en sert. Écrit à côté puis renommé, pour ne jamais laisser un fichier coupé.
fn etat_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("etat.json"))
}
#[tauri::command]
fn lire_etat(app: AppHandle) -> Option<String> {
    std::fs::read_to_string(etat_path(&app)?).ok()
}
#[tauri::command]
fn garder_etat(app: AppHandle, etat: String) {
    let Some(p) = etat_path(&app) else { return };
    if let Some(d) = p.parent() { let _ = std::fs::create_dir_all(d); }
    let tmp = p.with_extension("json.tmp");
    if std::fs::write(&tmp, etat).is_ok() { let _ = std::fs::rename(tmp, p); }
}

// Le panneau prend toute la hauteur de l'écran sous la barre de menus, mais jamais plus que le plus petit écran branché :
// sur un grand écran externe, il garde la hauteur qu'il a sur l'écran du Mac.
fn hauteur_panneau(app: &AppHandle, p: &WebviewWindow) {
    let h = app.available_monitors().unwrap_or_default().iter()
        .map(|m| m.work_area().size.height as f64 / m.scale_factor())
        .fold(f64::INFINITY, f64::min);
    if h.is_finite() {
        let _ = p.set_size(LogicalSize::new(640.0, (h - 8.0).max(600.0)));
    }
}

// Le panneau au milieu de l'écran (menu du clic droit sur le Bidule, menu de l'icône).
#[tauri::command]
fn ouvrir_panneau(app: AppHandle) {
    if let Some(p) = app.get_webview_window("panel") {
        hauteur_panneau(&app, &p);
        let _ = p.center();
        let _ = p.show();
        let _ = p.set_focus();
        let _ = app.emit("demande-etat", ());
        surligner(&app, true);
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

fn contexte_lire() -> Option<Jauge> {
    let home = std::env::var("HOME").unwrap_or_default();
    let (path, model, source) = match desktop_session(&home).and_then(|(id, m)| Some((find_journal(&home, &id)?, m))) {
        Some((p, m)) => (p, m, "desktop"),
        None => (latest_journal(&home)?, None, "terminal"),
    };
    // Une conversation sans réponse depuis une demi-heure n'est plus « en cours » : le Bidule dort.
    let recent = std::fs::metadata(&path).and_then(|m| m.modified()).ok()? > SystemTime::now() - Duration::from_secs(1800);
    if !recent { return None }
    let (tokens, seen, act, _) = last_context(&path)?;
    // Plus rien d'écrit depuis 5 min : il attend sans doute une permission, ou s'est arrêté. Pas de bulle.
    let idle = std::fs::metadata(&path).and_then(|m| m.modified()).ok()?.elapsed().unwrap_or_default();
    let fresh = idle < Duration::from_secs(300);
    let attend = act.as_deref().is_some_and(|a| a != "pense") && idle >= Duration::from_secs(20);
    let activite = act.filter(|_| fresh);
    let model = model.or(seen).unwrap_or_default();
    let fenetre = window_for(&model).max(tokens);
    Some(Jauge { tokens, fenetre, pourcent: tokens as f64 * 100.0 / fenetre as f64, source, activite, attend })
}

// --- Les sessions de Claude Code, d'après ses hooks : chaque session note son état (travaille, attend, fini) dans ~/.bidules/sessions/<id>
// (hook.sh). Le Bidule montre l'ensemble des sessions, pas seulement celle qu'on regarde. Les hooks ne gardent que l'id de la session.
const HOOK_SH: &str = include_str!("hook.sh");
// La barre d'état de Claude Code (statusLine) : la seule à recevoir les limites de l'abonnement (5 h et semaine). Voir ligne.sh.
const LIGNE_SH: &str = include_str!("ligne.sh");
// (événement de Claude Code, filtre, état noté). Une permission accordée ou une question répondue : l'outil se termine (PostToolUse), il retravaille.
const HOOKS: [(&str, Option<&str>, &str); 6] = [
    ("UserPromptSubmit", None, "travaille"),
    ("PostToolUse", None, "travaille"),
    ("PreToolUse", Some("AskUserQuestion"), "attend"),
    ("Notification", Some("permission_prompt|elicitation_dialog|elicitation_url_dialog"), "attend"),
    ("Stop", None, "fini"),
    ("SessionEnd", None, "fin"),
];
// Un fichier partagé par les deux profils (lien symbolique) ne compte qu'une fois : sinon le second profil écraserait le premier.
fn reglages_claude(home: &str) -> Vec<PathBuf> {
    let mut vus = Vec::new();
    [".claude", ".claude-masana"].iter().map(|d| PathBuf::from(format!("{home}/{d}"))).filter(|d| d.is_dir()).map(|d| d.join("settings.json"))
        .filter(|p| { let c = std::fs::canonicalize(p).unwrap_or_else(|_| p.clone()); let neuf = !vus.contains(&c); vus.push(c); neuf }).collect()
}
// "oui" : les hooks de cette version sont posés partout ; "ancien" : il reste ceux d'une version précédente (à mettre à jour) ; "non" : aucun.
#[tauri::command(async)]
fn hooks_etat() -> &'static str {
    let home = std::env::var("HOME").unwrap_or_default();
    let fichiers = reglages_claude(&home);
    let textes: Vec<String> = fichiers.iter().map(|p| std::fs::read_to_string(p).unwrap_or_default()).collect();
    // la barre d'état doit nommer le profil de son fichier (une version précédente pouvait mettre celui de l'autre profil)
    let a_jour = |(t, p): (&String, &PathBuf)| t.contains("bidules/hook.sh") && t.contains("SessionEnd") && t.contains(&format!("ligne.sh\\\" {}\"", profil(p)));
    if !textes.is_empty() && textes.iter().zip(&fichiers).all(a_jour) && Path::new(&format!("{home}/.bidules/ligne.sh")).is_file() { "oui" }
    else if textes.iter().any(|t| t.contains(".bidules")) { "ancien" } else { "non" }
}
fn ecrire_hook_sh(home: &str) -> Result<(), String> {
    std::fs::create_dir_all(format!("{home}/.bidules")).map_err(|e| e.to_string())?;
    std::fs::write(format!("{home}/.bidules/hook.sh"), HOOK_SH).map_err(|e| e.to_string())?;
    std::fs::write(format!("{home}/.bidules/ligne.sh"), LIGNE_SH).map_err(|e| e.to_string())
}
// Le nom du profil de Claude Code d'un fichier de réglages : ~/.claude/settings.json -> claude.
fn profil(p: &Path) -> String {
    p.parent().and_then(|d| d.file_name()).map_or("claude".into(), |n| n.to_string_lossy().trim_start_matches('.').to_string())
}
// Notre barre d'état prend la place de celle qu'on avait (sa commande est gardée dans ~/.bidules/ligne-avant-<profil>, et ligne.sh la relance).
fn poser_ligne(home: &str, p: &Path, v: &mut serde_json::Value) -> Result<(), String> {
    let avant = format!("{home}/.bidules/ligne-avant-{}", profil(p));
    let cmd = format!("sh \"$HOME/.bidules/ligne.sh\" {}", profil(p));
    let racine = v.as_object_mut().unwrap();
    match racine.get_mut("statusLine").and_then(|l| l.as_object_mut()) {
        Some(l) => {
            let c = l.get("command").and_then(|c| c.as_str()).unwrap_or("").to_string();
            if !c.contains(".bidules") {
                if c.is_empty() { let _ = std::fs::remove_file(&avant); } else { std::fs::write(&avant, c).map_err(|e| e.to_string())?; }
            }
            l.insert("type".into(), "command".into());
            l.insert("command".into(), cmd.into());
        }
        None => {
            let _ = std::fs::remove_file(&avant);
            racine.insert("statusLine".into(), serde_json::json!({"type": "command", "command": cmd}));
        }
    }
    Ok(())
}
// Remet la barre d'état d'avant le Bidule, ou l'enlève s'il n'y en avait pas.
fn retirer_ligne(home: &str, p: &Path, v: &mut serde_json::Value) {
    let racine = v.as_object_mut().unwrap();
    let Some(l) = racine.get_mut("statusLine").and_then(|l| l.as_object_mut()) else { return };
    if !l.get("command").map_or(false, |c| c.to_string().contains(".bidules")) { return }
    match std::fs::read_to_string(format!("{home}/.bidules/ligne-avant-{}", profil(p))) {
        Ok(c) => { l.insert("command".into(), c.into()); }
        Err(_) => { racine.remove("statusLine"); }
    }
}
// Retire des réglages les hooks du Bidule (ceux qui parlent de ~/.bidules), et les listes ou l'objet « hooks » laissés vides. Le reste ne bouge pas.
fn retirer_hooks(v: &mut serde_json::Value) {
    let Some(racine) = v.as_object_mut() else { return };
    let Some(hooks) = racine.get_mut("hooks").and_then(|h| h.as_object_mut()) else { return };
    for liste in hooks.values_mut() {
        if let Some(a) = liste.as_array_mut() { a.retain(|h| !h.to_string().contains(".bidules")) }
    }
    hooks.retain(|_, l| l.as_array().map_or(true, |a| !a.is_empty()));
    if hooks.is_empty() { racine.remove("hooks"); }
}
fn lire_reglages(p: &Path) -> Result<(String, serde_json::Value), String> {
    let texte = std::fs::read_to_string(p).unwrap_or_default();
    let v = if texte.trim().is_empty() { serde_json::json!({}) } else { serde_json::from_str(&texte).map_err(|e| format!("{} illisible : {e}", p.display()))? };
    if !v.is_object() { return Err(format!("{} : pas un objet JSON", p.display())) }
    Ok((texte, v))
}
// Débrancher : les hooks du Bidule sont retirés des réglages de Claude Code, avec le script et l'état des sessions.
#[tauri::command(async)]
fn debrancher_hooks() -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    for p in reglages_claude(&home) {
        let (texte, mut v) = lire_reglages(&p)?;
        if !texte.contains(".bidules") { continue }
        retirer_hooks(&mut v);
        retirer_ligne(&home, &p, &mut v);
        std::fs::write(&p, serde_json::to_string_pretty(&v).unwrap() + "\n").map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(format!("{home}/.bidules/ligne-avant-{}", profil(&p)));
    }
    for f in ["hook.sh", "ligne.sh", "limites.json", "ligne-lancee"] { let _ = std::fs::remove_file(format!("{home}/.bidules/{f}")); }
    let _ = std::fs::remove_dir_all(format!("{home}/.bidules/sessions"));
    Ok(())
}
// Pose les hooks dans les réglages de Claude Code (et du second profil s'il existe), sans toucher au reste. Les anciens hooks du Bidule
// (ceux qui parlent de ~/.bidules) sont remplacés. La première fois, une copie du fichier d'origine est gardée à côté.
#[tauri::command(async)]
fn brancher_hooks() -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let fichiers = reglages_claude(&home);
    if fichiers.is_empty() { return Err("Claude Code n'est pas installé (pas de dossier ~/.claude)".into()) }
    ecrire_hook_sh(&home)?;
    for p in fichiers {
        let (texte, mut v) = lire_reglages(&p)?;
        retirer_hooks(&mut v);
        let hooks = v.as_object_mut().unwrap().entry("hooks").or_insert(serde_json::json!({})).as_object_mut().ok_or("« hooks » n'est pas un objet")?;
        for (evt, filtre, etat) in HOOKS {
            let mut h = serde_json::json!({"hooks": [{"type": "command", "command": format!("sh \"$HOME/.bidules/hook.sh\" {etat}")}]});
            if let Some(f) = filtre { h["matcher"] = f.into() }
            hooks.entry(evt).or_insert(serde_json::json!([])).as_array_mut().ok_or(format!("« {evt} » n'est pas une liste"))?.push(h);
        }
        poser_ligne(&home, &p, &mut v)?;
        let copie = p.with_extension("json.avant-bidule");
        if !texte.is_empty() && !copie.exists() { std::fs::write(copie, &texte).map_err(|e| e.to_string())?; }
        std::fs::write(&p, serde_json::to_string_pretty(&v).unwrap() + "\n").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct Session {
    etat: String,
    // secondes depuis le dernier changement d'état
    depuis: u64,
    // le dossier du projet (son dernier nom), la jauge de contexte
    projet: Option<String>,
    tokens: u64,
    fenetre: u64,
    pourcent: f64,
}
// Toutes les sessions connues par les hooks. Une session oubliée (fermée sans prévenir) disparaît : finie depuis 30 min,
// sans nouvelle depuis 1 h en travaillant, ou depuis 8 h en attendant.
fn sessions_lire() -> Vec<Session> {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut out = Vec::new();
    let Ok(rd) = std::fs::read_dir(format!("{home}/.bidules/sessions")) else { return out };
    for e in rd.flatten() {
        let p = e.path();
        let (Ok(etat), Some(age)) = (std::fs::read_to_string(&p), e.metadata().and_then(|m| m.modified()).ok().and_then(|m| m.elapsed().ok())) else { continue };
        let max = match etat.as_str() { "fini" => 1800, "travaille" => 3600, _ => 8 * 3600 };
        if age.as_secs() > max { let _ = std::fs::remove_file(&p); continue }
        let id = e.file_name().to_string_lossy().to_string();
        let ctx = find_journal(&home, &id).and_then(|j| last_context(&j));
        let (tokens, model, projet) = ctx.map_or((0, None, None), |c| (c.0, c.1, c.3));
        let fenetre = window_for(&model.unwrap_or_default()).max(tokens);
        out.push(Session { etat, depuis: age.as_secs(), projet, tokens, fenetre, pourcent: tokens as f64 * 100.0 / fenetre as f64 });
    }
    out
}

// Les limites de l'abonnement, d'après la barre d'état (ligne.sh) : le pourcentage utilisé et les secondes avant la remise à zéro.
// Une fenêtre déjà remise à zéro est à 0 %, jusqu'à la prochaine réponse de Claude.
#[derive(serde::Serialize)]
struct Limite { pourcent: f64, remise: u64 }
#[derive(serde::Serialize)]
struct Limites { cinq_h: Option<Limite>, semaine: Option<Limite>, lancee: bool }
fn limites_lire() -> Option<Limites> {
    let home = std::env::var("HOME").unwrap_or_default();
    let lancee = Path::new(&format!("{home}/.bidules/ligne-lancee")).exists();
    let v: serde_json::Value = std::fs::read_to_string(format!("{home}/.bidules/limites.json")).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    let now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).ok()?.as_secs();
    let l = |k: &str| {
        let (pc, r) = (v[k]["used_percentage"].as_f64()?, v[k]["resets_at"].as_f64()? as u64);
        Some(if r <= now { Limite { pourcent: 0.0, remise: 0 } } else { Limite { pourcent: pc, remise: r - now } })
    };
    Some(Limites { cinq_h: l("cinq_h"), semaine: l("semaine"), lancee })
}

// Le coût qu'aurait eu Claude Code avec l'API (issue #48) : les tokens de chaque réponse, additionnés par heure, modèle et projet.
// Les prix sont dans le panneau. Une réponse est écrite plusieurs fois dans le journal (une ligne par bloc), et une session reprise
// recopie les anciennes : on ne la compte qu'une fois, d'après son id et celui de la requête. Seulement les métadonnées, jamais le texte.
#[derive(Deserialize)]
struct CoutLine {
    #[serde(rename = "type")]
    kind: Option<String>,
    cwd: Option<String>,
    timestamp: Option<String>,
    #[serde(rename = "requestId")]
    request_id: Option<String>,
    message: Option<CoutMsg>,
}
#[derive(Deserialize)]
struct CoutMsg {
    id: Option<String>,
    model: Option<String>,
    usage: Option<CoutUsage>,
}
#[derive(Deserialize)]
struct CoutUsage {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
    cache_creation: Option<CacheEcrit>,
}
#[derive(Deserialize)]
struct CacheEcrit {
    ephemeral_1h_input_tokens: Option<u64>,
}
// (heure, modèle, projet, tokens : entrée, sortie, cache écrit pour 5 min, cache écrit pour 1 h, cache lu)
type Reponse = (u64, String, String, [u64; 5]);
static REPONSES: Mutex<Option<HashMap<PathBuf, (u64, SystemTime, HashMap<String, Reponse>)>>> = Mutex::new(None);

fn lire_reponses(p: &Path) -> HashMap<String, Reponse> {
    let mut out = HashMap::new();
    let Ok(f) = std::fs::File::open(p) else { return out };
    let mut projet = String::new();
    for line in BufReader::new(f).lines().map_while(Result::ok) {
        let Ok(l) = serde_json::from_str::<CoutLine>(&line) else { continue };
        // le projet : le dossier où la session a commencé (un cd en cours de route ne change pas de projet)
        if let (Some(d), true) = (&l.cwd, projet.is_empty()) { projet = Path::new(d).file_name().map_or(String::new(), |n| n.to_string_lossy().to_string()) }
        if l.kind.as_deref() != Some("assistant") { continue }
        let Some(m) = l.message else { continue };
        let (Some(id), Some(u), Some(t)) = (m.id, m.usage, l.timestamp.as_deref().and_then(iso_to_epoch)) else { continue };
        let modele = m.model.unwrap_or_default();
        if modele.starts_with('<') { continue }
        let h1 = u.cache_creation.and_then(|c| c.ephemeral_1h_input_tokens).unwrap_or(0);
        let ecrit = u.cache_creation_input_tokens.unwrap_or(0);
        let tk = [u.input_tokens.unwrap_or(0), u.output_tokens.unwrap_or(0), ecrit.saturating_sub(h1), h1, u.cache_read_input_tokens.unwrap_or(0)];
        out.insert(format!("{id}/{}", l.request_id.unwrap_or_default()), (t as u64 / 3600 * 3600, modele, projet.clone(), tk));
    }
    out
}

#[derive(serde::Serialize)]
struct Depense { heure: u64, modele: String, projet: String, tokens: [u64; 5] }
fn depenses_lire() -> Vec<Depense> {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut fichiers = Vec::new();
    for root in [format!("{home}/.claude/projects"), format!("{home}/.claude-masana/projects")] {
        walk(Path::new(&root), &mut |p| if p.extension().and_then(|x| x.to_str()) == Some("jsonl") { fichiers.push(p.to_path_buf()) });
    }
    let mut cache = REPONSES.lock().unwrap();
    let cache = cache.get_or_insert_with(HashMap::new);
    cache.retain(|p, _| fichiers.contains(p));
    let mut vues: HashMap<&String, &Reponse> = HashMap::new();
    for p in &fichiers {
        let Ok(meta) = std::fs::metadata(p) else { continue };
        let (len, mtime) = (meta.len(), meta.modified().unwrap_or(SystemTime::UNIX_EPOCH));
        if cache.get(p).map_or(true, |c| c.0 != len || c.1 != mtime) { cache.insert(p.clone(), (len, mtime, lire_reponses(p))); }
    }
    for c in cache.values() { for (k, r) in &c.2 { vues.insert(k, r); } }
    let mut somme: HashMap<(u64, &str, &str), [u64; 5]> = HashMap::new();
    for (h, m, pr, tk) in vues.into_values() {
        let s = somme.entry((*h, m, pr)).or_default();
        for i in 0..5 { s[i] += tk[i] }
    }
    somme.into_iter().map(|((heure, m, pr), tokens)| Depense { heure, modele: m.to_string(), projet: pr.to_string(), tokens }).collect()
}

// Les limites de l'abonnement, d'après claude.ai (issue #49) : le point d'accès dont se sert /usage dans Claude Code (api/oauth/usage, pas
// documenté, il peut changer), avec le jeton de connexion de Claude Code (Trousseau de macOS, ou .credentials.json ailleurs). On ne fait que
// le lire, sans jamais le renouveler : ce serait déconnecter Claude Code. Toutes les 5 min, le relevé de chaque profil s'ajoute à
// ~/.bidules/usage-<profil>.jsonl, gardé 8 jours, pour tracer la courbe et prévoir quand la limite sera atteinte.
const PROFILS: [&str; 2] = [".claude", ".claude-masana"];
static JETONS: Mutex<Option<HashMap<&'static str, String>>> = Mutex::new(None);
static ERREURS: Mutex<Option<HashMap<&'static str, String>>> = Mutex::new(None);
fn secondes() -> u64 { SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).map_or(0, |d| d.as_secs()) }
// "2026-10-18T16:59:00.123+00:00" -> secondes depuis 1970 (jours d'après l'algorithme de Howard Hinnant).
fn depuis_iso(s: &str) -> Option<u64> {
    let n = |a: usize, b: usize| s.get(a..b)?.parse::<i64>().ok();
    let (y, mo, d, h, mi, se) = (n(0, 4)?, n(5, 7)?, n(8, 10)?, n(11, 13)?, n(14, 16)?, n(17, 19)?);
    let y = if mo <= 2 { y - 1 } else { y };
    let (era, mp) = (y.div_euclid(400), if mo > 2 { mo - 3 } else { mo + 9 });
    let yoe = y - era * 400;
    let jours = era * 146097 + yoe * 365 + yoe / 4 - yoe / 100 + (153 * mp + 2) / 5 + d - 1 - 719468;
    let reste = &s[19..];
    let dec = match reste.rfind(['+', '-']) {
        Some(i) if reste.len() - i == 6 => (if &reste[i..i + 1] == "-" { -1 } else { 1 }) * (reste.get(i + 1..i + 3)?.parse::<i64>().ok()? * 3600 + reste.get(i + 4..i + 6)?.parse::<i64>().ok()? * 60),
        _ => 0,
    };
    Some((jours * 86400 + h * 3600 + mi * 60 + se - dec) as u64)
}
fn lire_jeton(home: &str, dir: &str) -> Option<String> {
    let lire = |t: &str| -> Option<String> {
        let v: serde_json::Value = serde_json::from_str(t).ok()?;
        let o = &v["claudeAiOauth"];
        if o["expiresAt"].as_u64().map_or(false, |e| e <= secondes() * 1000) { return None }
        o["accessToken"].as_str().map(String::from)
    };
    if let Some(j) = std::fs::read_to_string(format!("{home}/{dir}/.credentials.json")).ok().and_then(|t| lire(&t)) { return Some(j) }
    // Le Trousseau : « Claude Code-credentials », suivi, pour un autre dossier que ~/.claude (CLAUDE_CONFIG_DIR), des 8 premiers caractères
    // du sha256 de son chemin.
    let service = if dir == ".claude" { "Claude Code-credentials".to_string() } else {
        let o = std::process::Command::new("sh").args(["-c", "printf %s \"$1\" | shasum -a 256", "sh", &format!("{home}/{dir}")]).output().ok()?;
        format!("Claude Code-credentials-{}", String::from_utf8_lossy(&o.stdout).get(..8)?)
    };
    let o = std::process::Command::new("security").args(["find-generic-password", "-a", &std::env::var("USER").unwrap_or_default(), "-w", "-s", &service]).output().ok()?;
    lire(String::from_utf8_lossy(&o.stdout).trim())
}
// Le jeton passe par l'entrée de curl, pas par sa ligne de commande (visible des autres programmes).
fn appeler(jeton: &str, quoi: &str) -> Result<serde_json::Value, String> {
    use std::io::Write;
    let mut c = std::process::Command::new("curl")
        .args(["-sS", "-m", "15", "-w", "\n%{http_code}", "-H", "@-", "-H", "anthropic-beta: oauth-2025-04-20", "-H", "Content-Type: application/json", &format!("https://api.anthropic.com/api/oauth/{quoi}")])
        .stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).spawn().map_err(|e| e.to_string())?;
    let _ = c.stdin.take().unwrap().write_all(format!("Authorization: Bearer {jeton}\n").as_bytes());
    let o = c.wait_with_output().map_err(|e| e.to_string())?;
    let t = String::from_utf8_lossy(&o.stdout);
    let (corps, code) = t.rsplit_once('\n').unwrap_or(("", &t));
    match code.trim() {
        "200" => serde_json::from_str(corps).map_err(|e| e.to_string()),
        "000" => Err(format!("pas de réseau ({})", String::from_utf8_lossy(&o.stderr).trim())),
        c => Err(c.to_string()),
    }
}
// Un relevé : l'heure, et pour chaque fenêtre le pourcentage utilisé et l'heure de remise à zéro. Les fenêtres par modèle (semaine) à part.
fn releve(v: &serde_json::Value, t: u64) -> serde_json::Value {
    let f = |w: &serde_json::Value| -> serde_json::Value {
        match (w["utilization"].as_f64(), w["resets_at"].as_str().and_then(depuis_iso)) { (Some(p), r) => serde_json::json!([p, r]), _ => serde_json::Value::Null }
    };
    let mut modeles: Vec<serde_json::Value> = v["limits"].as_array().into_iter().flatten()
        .filter_map(|l| Some(serde_json::json!([l["scope"]["model"]["display_name"].as_str()?, l["percent"].as_f64()?, l["resets_at"].as_str().and_then(depuis_iso)])))
        .collect();
    for (k, nom) in [("seven_day_opus", "Opus"), ("seven_day_sonnet", "Sonnet")] {
        if let (serde_json::Value::Array(a), false) = (f(&v[k]), modeles.iter().any(|m| m[0] == nom)) { modeles.push(serde_json::json!([nom, a[0], a[1]])) }
    }
    serde_json::json!({"t": t, "cinq_h": f(&v["five_hour"]), "semaine": f(&v["seven_day"]), "modeles": modeles})
}
fn relever() {
    let home = std::env::var("HOME").unwrap_or_default();
    let t = secondes();
    let mut vus: Vec<(String, String)> = Vec::new();
    for dir in PROFILS {
        if !Path::new(&format!("{home}/{dir}")).is_dir() { continue }
        let erreur = |e: String| { ERREURS.lock().unwrap().get_or_insert_with(HashMap::new).insert(dir, e); };
        let mut jeton = JETONS.lock().unwrap().get_or_insert_with(HashMap::new).get(dir).cloned();
        let mut r = Err("401".to_string());
        for essai in 0..2 {
            // le jeton gardé a pu être renouvelé par Claude Code entre-temps : on le relit une fois
            if essai == 1 || jeton.is_none() { jeton = lire_jeton(&home, dir); }
            let Some(j) = &jeton else { break };
            r = appeler(j, "usage");
            if !matches!(&r, Err(c) if c == "401") { break }
        }
        let Some(j) = jeton else { erreur("jeton".into()); continue };
        JETONS.lock().unwrap().get_or_insert_with(HashMap::new).insert(dir, j.clone());
        let v = match r { Ok(v) => v, Err(e) => { erreur(e); continue } };
        ERREURS.lock().unwrap().get_or_insert_with(HashMap::new).remove(dir);
        let mut rl = releve(&v, t);
        let p = format!("{home}/.bidules/usage-{}.jsonl", dir.trim_start_matches('.'));
        // L'organisation du jeton (perso, Team...) : les limites vont avec elle. Deux profils sur la même : un seul relevé, et le second le dit.
        let org = appeler(&j, "profile").ok().map(|p| (p["organization"]["uuid"].as_str().unwrap_or("").to_string(), p["organization"]["name"].as_str().unwrap_or("").to_string()));
        if let Some((id, nom)) = &org {
            if let Some((_, autre)) = vus.iter().find(|(i, _)| i == id) { erreur(format!("meme:{autre}")); let _ = std::fs::remove_file(&p); continue }
            vus.push((id.clone(), dir.trim_start_matches('.').to_string()));
            rl["compte"] = serde_json::json!(nom);
        }
        let _ = std::fs::create_dir_all(format!("{home}/.bidules"));
        // les relevés d'un autre compte (jeton changé) ne vont pas sur la même courbe
        let garde: Vec<String> = std::fs::read_to_string(&p).unwrap_or_default().lines()
            .filter(|l| serde_json::from_str::<serde_json::Value>(l).ok().map_or(false, |v| v["t"].as_u64().map_or(false, |x| x + 8 * 86400 > t) && v["compte"] == rl["compte"]))
            .map(String::from).chain([rl.to_string()]).collect();
        let _ = std::fs::write(&p, garde.join("\n") + "\n");
    }
}
#[derive(serde::Serialize)]
struct Releves { profil: String, releves: Vec<serde_json::Value>, erreur: Option<String> }
fn usage_lire() -> Vec<Releves> {
    let home = std::env::var("HOME").unwrap_or_default();
    let erreurs = ERREURS.lock().unwrap().clone().unwrap_or_default();
    PROFILS.iter().filter(|d| Path::new(&format!("{home}/{d}")).is_dir()).map(|d| {
        let releves = std::fs::read_to_string(format!("{home}/.bidules/usage-{}.jsonl", d.trim_start_matches('.'))).unwrap_or_default()
            .lines().filter_map(|l| serde_json::from_str(l).ok()).collect();
        Releves { profil: d.trim_start_matches('.').to_string(), releves, erreur: erreurs.get(d).cloned() }
    }).collect()
}

// Les commandes qui lisent des fichiers tournent sur des fils à part (spawn_blocking). Ni sur le fil principal, ni sur ceux du moteur async :
// les commandes de la fenêtre (la déplacer, lire la souris) y passent aussi, et le Bidule saccaderait en attendant une lecture de journaux.
async fn a_part<T: Send + Default + 'static>(f: fn() -> T) -> T { tauri::async_runtime::spawn_blocking(f).await.unwrap_or_default() }
#[tauri::command]
async fn prompt_times() -> Vec<f64> { a_part(prompt_times_lire).await }
#[tauri::command]
async fn prompts_semaine() -> Vec<f64> { a_part(prompts_semaine_lire).await }
#[tauri::command]
async fn session_active() -> Option<String> { a_part(session_active_lire).await }
#[tauri::command]
async fn contexte() -> Option<Jauge> { a_part(contexte_lire).await }
#[tauri::command]
async fn sessions() -> Vec<Session> { a_part(sessions_lire).await }
#[tauri::command]
async fn limites() -> Option<Limites> { a_part(limites_lire).await }
#[tauri::command]
async fn depenses() -> Vec<Depense> { a_part(depenses_lire).await }
#[tauri::command]
async fn usage() -> Vec<Releves> { a_part(usage_lire).await }

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![log, quit, hide_panel, prompt_times, contexte, icone, session_active, haptique, hooks_etat, brancher_hooks, debrancher_hooks, sessions, limites, usage, prompts_semaine, depenses, montrer_bidule, ouvrir_panneau, lire_choix, garder_choix, lire_etat, garder_etat, bonbon_poser, bonbon_retirer, bonbon_clic])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Le panneau se cache quand il perd le focus ; on retient quand, pour qu'un clic sur l'icône ne le rouvre pas aussitôt.
            let hidden_at = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(5)));
            if let Some(panel) = app.get_webview_window("panel") {
                let p2 = panel.clone();
                let h2 = hidden_at.clone();
                let a2 = app.handle().clone();
                panel.on_window_event(move |e| {
                    if let WindowEvent::Focused(false) = e {
                        let _ = p2.hide();
                        *h2.lock().unwrap() = Instant::now();
                        surligner(&a2, false);
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
                            surligner(app, false);
                            return;
                        }
                        if h3.lock().unwrap().elapsed() < Duration::from_millis(300) {
                            return;
                        }
                        hauteur_panneau(app, &panel);
                        let scale = panel.scale_factor().unwrap_or(1.0);
                        let pos = rect.position.to_physical::<f64>(scale);
                        let size = rect.size.to_physical::<f64>(scale);
                        let width = panel.outer_size().map(|s| s.width as f64).unwrap_or(640.0 * scale);
                        let x = (pos.x + size.width / 2.0 - width / 2.0).max(0.0);
                        let _ = panel.set_position(PhysicalPosition::new(x, pos.y + size.height + 4.0));
                        let _ = panel.show();
                        let _ = panel.set_focus();
                        let _ = app.emit("demande-etat", ());
                        surligner(app, true);
                    }
                })
                .build(app)?;

            // Déjà branché : le script du hook est remis à jour à chaque lancement (une nouvelle version de l'app peut le changer).
            if hooks_etat() == "oui" { let _ = ecrire_hook_sh(&std::env::var("HOME").unwrap_or_default()); }
            std::thread::spawn(|| loop { relever(); std::thread::sleep(Duration::from_secs(300)); });
            // Claude a fini (hook) : le fichier change d'heure, le Bidule est prévenu.
            let h4 = app.handle().clone();
            std::thread::spawn(move || {
                let p = PathBuf::from(format!("{}/.bidules/claude-fini", std::env::var("HOME").unwrap_or_default()));
                let heure = || std::fs::metadata(&p).and_then(|m| m.modified()).ok();
                let mut avant = heure();
                loop {
                    std::thread::sleep(Duration::from_millis(400));
                    let h = heure();
                    if h.is_some() && h != avant { let _ = h4.emit("claude-fini", ()); }
                    avant = h;
                }
            });

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
