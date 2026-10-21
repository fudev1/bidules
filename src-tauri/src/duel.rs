// Le transport du duel entre deux Bidules du réseau local (voir docs/adr/0001-duel-en-reseau-local-avec-hote.md).
// Il ne connaît pas le jeu : il reçoit les défis, se connecte, fait passer les messages du duel tels quels et dit quand c'est fini.

use serde_json::{json, Value};
use std::io::ErrorKind;
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tungstenite::{Message, WebSocket};

// Le port où chaque Bidule attend les défis, tant que « Accepter les défis » est coché.
pub const PORT: u16 = 47800;
// Le temps laissé à l'autre pour accepter ou refuser un défi.
const REPONSE: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, PartialEq)]
pub enum Evenement {
    // un défi reçu, en attente de repondre()
    Defi { nom: String, bidule: String },
    // le duel commence ; hote : c'est nous qui avons lancé le défi, nom : l'autre joueur
    Connecte { hote: bool, nom: String },
    Refuse,
    Occupe,
    // un message du duel, tel que l'autre l'a envoyé
    Message(String),
    // le duel ou le défi s'arrête : "quitte" (nous), "adversaire-parti", "coupe", "injoignable", "sans-reponse"
    Fin(String),
}

type Ws = WebSocket<TcpStream>;
enum Sortie { Texte(String), Fermer }

#[derive(Default)]
struct Etat {
    ecoute: Option<Arc<AtomicBool>>,     // le drapeau qui arrête l'écoute en cours
    attente: Option<(Ws, String, Instant)>, // le défi reçu, le nom de celui qui l'a lancé, et quand
    connexion: Option<Sender<Sortie>>,   // le duel en cours
    occupe: bool,                        // un défi lancé ou un duel en cours
}

#[derive(Clone)]
pub struct Reseau {
    etat: Arc<Mutex<Etat>>,
    signaler: Arc<dyn Fn(Evenement) + Send + Sync>,
}

fn texte(ws: &mut Ws, v: Value) -> tungstenite::Result<()> { ws.send(Message::text(v.to_string())) }

// le prochain message texte en JSON, en attendant au plus `delai`
fn lire_json(ws: &mut Ws, delai: Duration) -> Option<Value> {
    ws.get_ref().set_read_timeout(Some(delai)).ok()?;
    loop {
        match ws.read() {
            Ok(Message::Text(t)) => return serde_json::from_str(t.as_str()).ok(),
            Ok(Message::Ping(_)) | Ok(Message::Pong(_)) => continue,
            _ => return None,
        }
    }
}

impl Reseau {
    pub fn new(signaler: impl Fn(Evenement) + Send + Sync + 'static) -> Self {
        Reseau { etat: Arc::default(), signaler: Arc::new(signaler) }
    }

    fn signaler(&self, e: Evenement) { (self.signaler)(e) }

    // Ouvre ou ferme l'écoute des défis ; rend le port écouté (port 0 : un port libre, pour les tests).
    pub fn ecouter(&self, port: u16, actif: bool) -> std::io::Result<u16> {
        if let Some(stop) = self.etat.lock().unwrap().ecoute.take() { stop.store(true, Ordering::SeqCst); }
        if !actif { return Ok(port); }
        // l'écoute qu'on vient d'arrêter garde le port jusqu'à son prochain tour (50 ms au plus)
        let mut essai = TcpListener::bind(("0.0.0.0", port));
        for _ in 0..10 {
            if !matches!(&essai, Err(e) if e.kind() == ErrorKind::AddrInUse) { break; }
            thread::sleep(Duration::from_millis(30));
            essai = TcpListener::bind(("0.0.0.0", port));
        }
        let ecoute = essai?;
        ecoute.set_nonblocking(true)?;
        let port = ecoute.local_addr()?.port();
        let stop = Arc::new(AtomicBool::new(false));
        self.etat.lock().unwrap().ecoute = Some(stop.clone());
        let moi = self.clone();
        thread::spawn(move || {
            while !stop.load(Ordering::SeqCst) {
                match ecoute.accept() {
                    Ok((flux, _)) => { let moi = moi.clone(); thread::spawn(move || moi.accueillir(flux)); }
                    Err(e) if e.kind() == ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(50)),
                    Err(_) => thread::sleep(Duration::from_millis(200)),
                }
            }
        });
        Ok(port)
    }

    // Une connexion arrivée sur le port des défis : seul un message de défi est accepté, et seulement si on est libre.
    fn accueillir(&self, flux: TcpStream) {
        let _ = flux.set_nonblocking(false);
        let _ = flux.set_read_timeout(Some(Duration::from_secs(3)));
        let Ok(mut ws) = tungstenite::accept(flux) else { return };
        let Some(defi) = lire_json(&mut ws, Duration::from_secs(3)) else { return };
        if defi["t"] != "defi" { return; }
        let nom = defi["nom"].as_str().unwrap_or("?").to_string();
        let bidule = defi["bidule"].as_str().unwrap_or("?").to_string();
        {
            let mut etat = self.etat.lock().unwrap();
            // un défi resté sans réponse plus longtemps que l'autre ne l'attend est oublié
            if etat.attente.as_ref().is_some_and(|a| a.2.elapsed() > REPONSE) { etat.attente = None; }
            if etat.occupe || etat.attente.is_some() { let _ = texte(&mut ws, json!({"t": "occupe"})); return; }
            etat.attente = Some((ws, nom.clone(), Instant::now()));
        }
        self.signaler(Evenement::Defi { nom, bidule });
    }

    // La réponse au défi reçu ; accepté, le duel commence sur cette connexion.
    pub fn repondre(&self, accepte: bool, mon_nom: &str) {
        let Some((mut ws, nom, _)) = self.etat.lock().unwrap().attente.take() else { return };
        if texte(&mut ws, json!({"t": "reponse", "ok": accepte, "nom": mon_nom})).is_err() || !accepte {
            let _ = ws.close(None); let _ = ws.flush();
            if accepte { self.signaler(Evenement::Fin("coupe".into())); }
            return;
        }
        self.relier(ws, false, nom);
    }

    // Lance un défi à l'adresse donnée ("ip" ou "ip:port"), sans attendre : la suite arrive en événements.
    pub fn defier(&self, adresse: &str, mon_nom: &str, bidule: &str) {
        {
            let mut etat = self.etat.lock().unwrap();
            if etat.occupe { return; }
            etat.occupe = true;
        }
        let adresse = if adresse.contains(':') { adresse.to_string() } else { format!("{adresse}:{PORT}") };
        let (moi, mon_nom, bidule) = (self.clone(), mon_nom.to_string(), bidule.to_string());
        thread::spawn(move || {
            let connecter = || -> Option<Ws> {
                let cible = adresse.to_socket_addrs().ok()?.next()?;
                let flux = TcpStream::connect_timeout(&cible, Duration::from_secs(3)).ok()?;
                flux.set_read_timeout(Some(Duration::from_secs(3))).ok()?;
                let (ws, _) = tungstenite::client(format!("ws://{adresse}/"), flux).ok()?;
                Some(ws)
            };
            let Some(mut ws) = connecter() else { return moi.finir("injoignable") };
            if texte(&mut ws, json!({"t": "defi", "nom": mon_nom, "bidule": bidule})).is_err() { return moi.finir("injoignable"); }
            match lire_json(&mut ws, REPONSE) {
                Some(r) if r["t"] == "reponse" && r["ok"] == true => {
                    let nom = r["nom"].as_str().unwrap_or("?").to_string();
                    moi.relier(ws, true, nom);
                }
                Some(r) if r["t"] == "reponse" => { moi.etat.lock().unwrap().occupe = false; moi.signaler(Evenement::Refuse); }
                Some(r) if r["t"] == "occupe" => { moi.etat.lock().unwrap().occupe = false; moi.signaler(Evenement::Occupe); }
                _ => moi.finir("sans-reponse"),
            }
        });
    }

    fn finir(&self, raison: &str) {
        let mut etat = self.etat.lock().unwrap();
        etat.occupe = false; etat.connexion = None;
        drop(etat);
        self.signaler(Evenement::Fin(raison.into()));
    }

    // Le duel en cours : un fil garde la connexion, lit les messages de l'autre et envoie les nôtres.
    fn relier(&self, mut ws: Ws, hote: bool, nom: String) {
        let (tx, rx) = channel();
        {
            let mut etat = self.etat.lock().unwrap();
            etat.occupe = true; etat.connexion = Some(tx);
        }
        let _ = ws.get_ref().set_read_timeout(Some(Duration::from_millis(4)));
        let _ = ws.get_ref().set_nodelay(true);
        self.signaler(Evenement::Connecte { hote, nom });
        let moi = self.clone();
        thread::spawn(move || loop {
            loop {
                match rx.try_recv() {
                    Ok(Sortie::Texte(t)) => { if ws.send(Message::text(t)).is_err() { return moi.finir("coupe"); } }
                    Ok(Sortie::Fermer) | Err(TryRecvError::Disconnected) => {
                        let _ = ws.close(None); let _ = ws.flush();
                        return moi.finir("quitte");
                    }
                    Err(TryRecvError::Empty) => break,
                }
            }
            match ws.read() {
                Ok(Message::Text(t)) => moi.signaler(Evenement::Message(t.as_str().to_string())),
                Ok(Message::Close(_)) => return moi.finir("adversaire-parti"),
                Ok(_) => {}
                Err(tungstenite::Error::Io(e)) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {}
                Err(tungstenite::Error::ConnectionClosed) | Err(tungstenite::Error::AlreadyClosed) => return moi.finir("adversaire-parti"),
                Err(_) => return moi.finir("coupe"),
            }
        });
    }

    // Un message du duel pour l'autre joueur ; rien s'il n'y a pas de duel.
    pub fn envoyer(&self, texte: String) {
        if let Some(tx) = &self.etat.lock().unwrap().connexion { let _ = tx.send(Sortie::Texte(texte)); }
    }

    // Quitte le duel en cours, ou refuse le défi en attente.
    pub fn quitter(&self) {
        let etat = self.etat.lock().unwrap();
        if let Some(tx) = &etat.connexion { let _ = tx.send(Sortie::Fermer); }
        drop(etat);
        self.repondre(false, "");
    }
}

// ---- Dans l'app : les commandes pour les pages, les événements vers elles, la fenêtre plein écran du duel ----

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// Le nom que les autres voient : le prénom de `git config user.name`, sinon le nom de la machine.
fn mon_nom() -> String {
    let lire = |cmd: &str, args: &[&str]| std::process::Command::new(cmd).args(args).output().ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).filter(|s| !s.is_empty());
    lire("git", &["config", "--global", "user.name"]).and_then(|n| n.split_whitespace().next().map(str::to_string))
        .or_else(|| lire("hostname", &[])).unwrap_or_else(|| "Bidule".into())
}

// L'adresse de cette machine sur le réseau local, à donner au collègue (aucun paquet ne part : connect() choisit seulement l'interface).
fn mon_adresse() -> Option<String> {
    let s = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    s.connect("8.8.8.8:80").ok()?;
    Some(s.local_addr().ok()?.ip().to_string())
}

pub fn brancher(app: &AppHandle) {
    let h = app.clone();
    let reseau = Reseau::new(move |e| match e {
        Evenement::Defi { nom, bidule } => { let _ = h.emit("duel-defi", json!({"nom": nom, "bidule": bidule})); }
        Evenement::Connecte { hote, nom } => {
            let h2 = h.clone();
            let _ = h.run_on_main_thread(move || ouvrir_terrain(&h2, hote, &nom));
        }
        Evenement::Refuse => { let _ = h.emit("duel-reponse", "refuse"); }
        Evenement::Occupe => { let _ = h.emit("duel-reponse", "occupe"); }
        Evenement::Message(t) => { let _ = h.emit_to("duel", "duel-msg", t); }
        Evenement::Fin(raison) => { let _ = h.emit("duel-fin", raison); }
    });
    app.manage(reseau);
}

// La fenêtre transparente du duel, sur tout l'écran du Bidule ; le Bidule se cache le temps du duel.
fn ouvrir_terrain(app: &AppHandle, hote: bool, nom: &str) {
    let quitter = || app.state::<Reseau>().quitter();
    let Some(main) = app.get_webview_window("main") else { return quitter() };
    let ecran = main.current_monitor().ok().flatten().or_else(|| main.primary_monitor().ok().flatten());
    let Some(ecran) = ecran else { return quitter() };
    // la fenêtre du duel précédent, encore sur son résultat
    if let Some(w) = app.get_webview_window("duel") { let _ = w.destroy(); }
    let f = ecran.scale_factor();
    let (pos, taille) = (ecran.position().to_logical::<f64>(f), ecran.size().to_logical::<f64>(f));
    let init = format!("window.DUEL = {{hote: {hote}, nom: {}}};", serde_json::to_string(nom).unwrap_or_default());
    let fenetre = WebviewWindowBuilder::new(app, "duel", WebviewUrl::App("duel.html".into()))
        .initialization_script(init)
        .inner_size(taille.width, taille.height)
        .position(pos.x, pos.y)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .resizable(false)
        .shadow(false)
        .skip_taskbar(true)
        .focused(true)
        .accept_first_mouse(true)
        .build();
    match fenetre {
        Ok(w) => { let _ = w.set_focus(); let _ = main.hide(); }
        Err(e) => { println!("[bidule] fenêtre du duel : {e}"); quitter(); }
    }
}

#[tauri::command]
pub fn duel_infos() -> Value { json!({"nom": mon_nom(), "adresse": mon_adresse()}) }

#[tauri::command]
pub fn duel_ecouter(reseau: tauri::State<Reseau>, actif: bool) -> Result<(), String> {
    reseau.ecouter(PORT, actif).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn duel_defier(reseau: tauri::State<Reseau>, adresse: String) { reseau.defier(adresse.trim(), &mon_nom(), "limace") }

#[tauri::command]
pub fn duel_repondre(reseau: tauri::State<Reseau>, accepte: bool) { reseau.repondre(accepte, &mon_nom()) }

#[tauri::command]
pub fn duel_envoyer(reseau: tauri::State<Reseau>, texte: String) { reseau.envoyer(texte) }

#[tauri::command]
pub fn duel_quitter(reseau: tauri::State<Reseau>) { reseau.quitter() }

// Ferme la fenêtre du duel et rend sa place au Bidule.
#[tauri::command]
pub fn duel_fermer(app: AppHandle) {
    if let Some(w) = app.get_webview_window("duel") { let _ = w.close(); }
    if let Some(m) = app.get_webview_window("main") { let _ = m.show(); }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::Receiver;

    fn reseau() -> (Reseau, Receiver<Evenement>) {
        let (tx, rx) = channel();
        let tx = std::sync::Mutex::new(tx);
        (Reseau::new(move |e| { let _ = tx.lock().unwrap().send(e); }), rx)
    }
    fn attendre(rx: &Receiver<Evenement>) -> Evenement { rx.recv_timeout(Duration::from_secs(5)).expect("aucun événement") }

    #[test]
    fn un_defi_accepte_relie_les_deux_bidules_dans_les_deux_sens() {
        let (invite, rx_i) = reseau();
        let (hote, rx_h) = reseau();
        let port = invite.ecouter(0, true).unwrap();
        hote.defier(&format!("127.0.0.1:{port}"), "Thibault", "limace");
        assert_eq!(attendre(&rx_i), Evenement::Defi { nom: "Thibault".into(), bidule: "limace".into() });
        invite.repondre(true, "Matteo");
        assert_eq!(attendre(&rx_i), Evenement::Connecte { hote: false, nom: "Thibault".into() });
        assert_eq!(attendre(&rx_h), Evenement::Connecte { hote: true, nom: "Matteo".into() });
        hote.envoyer("depuis l'hôte".into());
        assert_eq!(attendre(&rx_i), Evenement::Message("depuis l'hôte".into()));
        invite.envoyer("depuis l'invité".into());
        assert_eq!(attendre(&rx_h), Evenement::Message("depuis l'invité".into()));
    }

    #[test]
    fn un_defi_refuse_ne_relie_rien() {
        let (invite, rx_i) = reseau();
        let (hote, rx_h) = reseau();
        let port = invite.ecouter(0, true).unwrap();
        hote.defier(&format!("127.0.0.1:{port}"), "Thibault", "limace");
        attendre(&rx_i);
        invite.repondre(false, "Matteo");
        assert_eq!(attendre(&rx_h), Evenement::Refuse);
    }

    #[test]
    fn quitter_previent_l_autre() {
        let (invite, rx_i) = reseau();
        let (hote, rx_h) = reseau();
        let port = invite.ecouter(0, true).unwrap();
        hote.defier(&format!("127.0.0.1:{port}"), "Thibault", "limace");
        attendre(&rx_i);
        invite.repondre(true, "Matteo");
        attendre(&rx_i); attendre(&rx_h);
        hote.quitter();
        assert_eq!(attendre(&rx_h), Evenement::Fin("quitte".into()));
        assert_eq!(attendre(&rx_i), Evenement::Fin("adversaire-parti".into()));
    }

    #[test]
    fn un_bidule_qui_n_accepte_pas_les_defis_est_injoignable() {
        let (invite, _rx_i) = reseau();
        let (hote, rx_h) = reseau();
        let port = invite.ecouter(0, true).unwrap();
        invite.ecouter(0, false).unwrap();
        std::thread::sleep(Duration::from_millis(200));
        hote.defier(&format!("127.0.0.1:{port}"), "Thibault", "limace");
        assert_eq!(attendre(&rx_h), Evenement::Fin("injoignable".into()));
    }

    #[test]
    fn un_bidule_deja_en_duel_repond_occupe() {
        let (invite, rx_i) = reseau();
        let (hote, rx_h) = reseau();
        let (troisieme, rx_t) = reseau();
        let port = invite.ecouter(0, true).unwrap();
        hote.defier(&format!("127.0.0.1:{port}"), "Thibault", "limace");
        attendre(&rx_i);
        invite.repondre(true, "Matteo");
        attendre(&rx_i); attendre(&rx_h);
        troisieme.defier(&format!("127.0.0.1:{port}"), "Léa", "limace");
        assert_eq!(attendre(&rx_t), Evenement::Occupe);
    }

    #[test]
    fn couper_puis_rallumer_aussitot_l_ecoute_reprend_le_meme_port() {
        let (invite, rx_i) = reseau();
        let (hote, _rx_h) = reseau();
        let port = invite.ecouter(0, true).unwrap();
        invite.ecouter(port, false).unwrap();
        assert_eq!(invite.ecouter(port, true).unwrap(), port);
        hote.defier(&format!("127.0.0.1:{port}"), "Thibault", "limace");
        assert!(matches!(attendre(&rx_i), Evenement::Defi { .. }));
    }
}
