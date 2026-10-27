// Le transport du duel entre deux Bidules, par le relais sur internet (voir docs/adr/0003-duel-par-un-relais-sur-internet.md).
// Il ne connaît pas le jeu : il lance un défi ou le relève par son code, fait passer les messages du duel tels quels et dit quand c'est fini.

use serde_json::{json, Value};
use std::io::ErrorKind;
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::mpsc::{channel, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{Message, WebSocket};

// Le relais (relais/relais.js), mis en ligne sur le compte Cloudflare de Matteo.
pub const RELAIS: &str = "wss://duel.bidules.workers.dev";

#[derive(Debug, Clone, PartialEq)]
pub enum Evenement {
    // le défi est lancé : le code à donner au collègue
    Code(String),
    // le duel commence ; hote : c'est nous qui avons lancé le défi, nom : l'autre joueur
    Connecte { hote: bool, nom: String },
    // un message du duel, tel que l'autre l'a envoyé
    Message(String),
    // le défi ou le duel s'arrête : "quitte" (nous), "adversaire-parti", "coupe", "injoignable" (pas de relais),
    // "inconnu" (pas de défi à ce code), "expire" (personne n'est venu)
    Fin(String),
}

type Ws = WebSocket<MaybeTlsStream<TcpStream>>;
enum Sortie { Texte(String), Fermer }

#[derive(Default)]
struct Etat {
    connexion: Option<Sender<Sortie>>,   // le défi en cours, en attente de l'autre ou en duel
}

#[derive(Clone)]
pub struct Reseau {
    relais: String,
    etat: Arc<Mutex<Etat>>,
    signaler: Arc<dyn Fn(Evenement) + Send + Sync>,
}

// Se connecte au relais, en 5 secondes au plus ; rend aussi le flux, pour régler l'attente des lectures.
pub fn connecter(url: &str) -> Option<(Ws, TcpStream)> {
    let uri: tungstenite::http::Uri = url.parse().ok()?;
    let port = uri.port_u16().unwrap_or(if uri.scheme_str() == Some("wss") { 443 } else { 80 });
    let cible = (uri.host()?, port).to_socket_addrs().ok()?.next()?;
    let flux = TcpStream::connect_timeout(&cible, Duration::from_secs(5)).ok()?;
    flux.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
    flux.set_nodelay(true).ok()?;
    let reglage = flux.try_clone().ok()?;
    let (ws, _) = tungstenite::client_tls(url, flux).ok()?;
    Some((ws, reglage))
}

impl Reseau {
    pub fn new(relais: &str, signaler: impl Fn(Evenement) + Send + Sync + 'static) -> Self {
        Reseau { relais: relais.to_string(), etat: Arc::default(), signaler: Arc::new(signaler) }
    }

    fn signaler(&self, e: Evenement) { (self.signaler)(e) }

    // Lance un défi : son code arrive en Evenement::Code, le duel commence quand le collègue le relève.
    pub fn creer(&self, mon_nom: &str) { self.lancer("/creer".into(), mon_nom, true) }

    // Relève le défi d'un collègue par son code.
    pub fn rejoindre(&self, code: &str, mon_nom: &str) {
        let code: String = code.chars().filter(char::is_ascii_alphabetic).collect::<String>().to_uppercase();
        self.lancer(format!("/rejoindre/{code}"), mon_nom, false)
    }

    // Un défi, sans attendre : un fil garde la connexion au relais, lit les messages de l'autre et envoie les nôtres.
    fn lancer(&self, chemin: String, mon_nom: &str, hote: bool) {
        let (tx, rx) = channel();
        {
            let mut etat = self.etat.lock().unwrap();
            if etat.connexion.is_some() { return; }
            etat.connexion = Some(tx);
        }
        let (moi, url, mon_nom) = (self.clone(), format!("{}{chemin}", self.relais), mon_nom.to_string());
        thread::spawn(move || {
            let Some((mut ws, flux)) = connecter(&url) else { return moi.finir("injoignable") };
            if ws.send(Message::text(json!({"t": "nom", "nom": mon_nom}).to_string())).is_err() { return moi.finir("injoignable"); }
            moi.suivre(ws, flux, rx, hote);
        });
    }

    fn suivre(&self, mut ws: Ws, flux: TcpStream, rx: Receiver<Sortie>, hote: bool) {
        // en attente de l'autre, les messages viennent du relais ; une fois le duel lancé, de l'autre joueur
        let mut en_duel = false;
        let _ = flux.set_read_timeout(Some(Duration::from_millis(50)));
        // en attente, un signal toutes les 20 s pour que la connexion ne soit pas coupée comme inactive ;
        // qui relève un défi doit voir le duel commencer en 15 s, sinon le défi n'est plus là
        let debut = Instant::now();
        let mut signal = Instant::now();
        loop {
            if !en_duel {
                if !hote && debut.elapsed() > Duration::from_secs(15) { let _ = ws.close(None); return self.finir("coupe"); }
                if signal.elapsed() > Duration::from_secs(20) {
                    signal = Instant::now();
                    if ws.send(Message::Ping(Vec::new())).is_err() { return self.finir("coupe"); }
                }
            }
            loop {
                match rx.try_recv() {
                    Ok(Sortie::Texte(t)) => { if en_duel && ws.send(Message::text(t)).is_err() { return self.finir("coupe"); } }
                    Ok(Sortie::Fermer) | Err(TryRecvError::Disconnected) => {
                        let _ = ws.close(None); let _ = ws.flush();
                        return self.finir("quitte");
                    }
                    Err(TryRecvError::Empty) => break,
                }
            }
            match ws.read() {
                Ok(Message::Text(t)) if en_duel => self.signaler(Evenement::Message(t.as_str().to_string())),
                Ok(Message::Text(t)) => {
                    let v: Value = serde_json::from_str(t.as_str()).unwrap_or_default();
                    match v["t"].as_str() {
                        Some("code") => self.signaler(Evenement::Code(v["code"].as_str().unwrap_or("").to_string())),
                        Some("go") => {
                            en_duel = true;
                            let _ = flux.set_read_timeout(Some(Duration::from_millis(4)));
                            self.signaler(Evenement::Connecte { hote, nom: v["nom"].as_str().unwrap_or("?").to_string() });
                        }
                        Some("inconnu") => return self.finir("inconnu"),
                        Some("expire") => return self.finir("expire"),
                        _ => {}
                    }
                }
                Ok(Message::Close(_)) => return self.finir(if en_duel { "adversaire-parti" } else { "coupe" }),
                Ok(_) => {}
                Err(tungstenite::Error::Io(e)) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {}
                Err(tungstenite::Error::ConnectionClosed) | Err(tungstenite::Error::AlreadyClosed) =>
                    return self.finir(if en_duel { "adversaire-parti" } else { "coupe" }),
                Err(_) => return self.finir("coupe"),
            }
        }
    }

    fn finir(&self, raison: &str) {
        self.etat.lock().unwrap().connexion = None;
        self.signaler(Evenement::Fin(raison.into()));
    }

    // Un message du duel pour l'autre joueur ; rien s'il n'y a pas de duel.
    pub fn envoyer(&self, texte: String) {
        if let Some(tx) = &self.etat.lock().unwrap().connexion { let _ = tx.send(Sortie::Texte(texte)); }
    }

    // Quitte le duel en cours, ou le défi qui attend l'autre joueur.
    pub fn quitter(&self) {
        if let Some(tx) = &self.etat.lock().unwrap().connexion { let _ = tx.send(Sortie::Fermer); }
    }
}

// ---- Dans l'app : les commandes pour les pages, les événements vers elles, la fenêtre plein écran du duel ----

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// Le nom que les autres voient : le prénom de `git config user.name`, sinon le nom de la machine.
pub fn mon_nom() -> String {
    let lire = |cmd: &str, args: &[&str]| std::process::Command::new(cmd).args(args).output().ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).filter(|s| !s.is_empty());
    lire("git", &["config", "--global", "user.name"]).and_then(|n| n.split_whitespace().next().map(str::to_string))
        .or_else(|| lire("hostname", &[])).unwrap_or_else(|| "Bidule".into())
}

pub fn brancher(app: &AppHandle) {
    let h = app.clone();
    let reseau = Reseau::new(RELAIS, move |e| match e {
        Evenement::Code(code) => { let _ = h.emit("duel-code", code); }
        Evenement::Connecte { hote, nom } => {
            let _ = h.emit("duel-debut", ());
            let h2 = h.clone();
            let _ = h.run_on_main_thread(move || ouvrir_terrain(&h2, hote, &nom));
        }
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
pub fn duel_infos() -> Value { json!({"nom": mon_nom()}) }

#[tauri::command]
pub fn duel_creer(reseau: tauri::State<Reseau>) { reseau.creer(&mon_nom()) }

#[tauri::command]
pub fn duel_rejoindre(reseau: tauri::State<Reseau>, code: String) { reseau.rejoindre(&code, &mon_nom()) }

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
    use std::net::TcpListener;

    // Un faux relais sur la machine, qui fait comme relais/relais.js ; RELAIS_TEST=ws://... pour essayer le vrai (wrangler dev).
    fn relais() -> String {
        if let Ok(url) = std::env::var("RELAIS_TEST") { return url; }
        let ecoute = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = ecoute.local_addr().unwrap().port();
        let attente: Arc<Mutex<Option<(WebSocket<TcpStream>, String)>>> = Arc::default();
        thread::spawn(move || for flux in ecoute.incoming().flatten() {
            let attente = attente.clone();
            thread::spawn(move || {
                let mut chemin = String::new();
                let Ok(mut ws) = tungstenite::accept_hdr(flux, |req: &tungstenite::handshake::server::Request, r| {
                    chemin = req.uri().path().to_string(); Ok(r)
                }) else { return };
                let Ok(Message::Text(t)) = ws.read() else { return };
                let nom = serde_json::from_str::<Value>(t.as_str()).unwrap()["nom"].as_str().unwrap().to_string();
                if chemin == "/creer" {
                    ws.send(Message::text(r#"{"t":"code","code":"KZPQ"}"#)).unwrap();
                    *attente.lock().unwrap() = Some((ws, nom));
                    return;
                }
                let Some((mut a, nom_a)) = attente.lock().unwrap().take().filter(|_| chemin == "/rejoindre/KZPQ") else {
                    let _ = ws.send(Message::text(r#"{"t":"inconnu"}"#)); return;
                };
                a.send(Message::text(json!({"t": "go", "nom": nom}).to_string())).unwrap();
                ws.send(Message::text(json!({"t": "go", "nom": nom_a}).to_string())).unwrap();
                // fait passer les messages dans les deux sens, et ferme l'autre quand l'un part
                for w in [&a, &ws] { w.get_ref().set_read_timeout(Some(Duration::from_millis(5))).unwrap(); }
                let mut paire = [a, ws];
                loop {
                    for i in 0..2 {
                        match paire[i].read() {
                            Ok(Message::Text(t)) => { let _ = paire[1 - i].send(Message::Text(t)); }
                            Err(tungstenite::Error::Io(_)) | Ok(_) => {}
                            Err(_) => { let _ = paire[1 - i].close(None); let _ = paire[1 - i].flush(); return; }
                        }
                    }
                }
            });
        });
        format!("ws://127.0.0.1:{port}")
    }

    fn reseau(relais: &str) -> (Reseau, Receiver<Evenement>) {
        let (tx, rx) = channel();
        let tx = Mutex::new(tx);
        (Reseau::new(relais, move |e| { let _ = tx.lock().unwrap().send(e); }), rx)
    }
    fn attendre(rx: &Receiver<Evenement>) -> Evenement { rx.recv_timeout(Duration::from_secs(5)).expect("aucun événement") }

    // lance un défi chez l'hôte, le fait relever par l'invité, et attend que le duel commence des deux côtés
    fn duel() -> (Reseau, Receiver<Evenement>, Reseau, Receiver<Evenement>) {
        let url = relais();
        let ((hote, rx_h), (invite, rx_i)) = (reseau(&url), reseau(&url));
        hote.creer("Thibault");
        let Evenement::Code(code) = attendre(&rx_h) else { panic!("pas de code") };
        invite.rejoindre(&code.to_lowercase(), "Matteo");
        assert_eq!(attendre(&rx_h), Evenement::Connecte { hote: true, nom: "Matteo".into() });
        assert_eq!(attendre(&rx_i), Evenement::Connecte { hote: false, nom: "Thibault".into() });
        (hote, rx_h, invite, rx_i)
    }

    #[test]
    fn un_defi_releve_relie_les_deux_bidules_dans_les_deux_sens() {
        let (hote, rx_h, invite, rx_i) = duel();
        hote.envoyer("depuis l'hôte".into());
        assert_eq!(attendre(&rx_i), Evenement::Message("depuis l'hôte".into()));
        invite.envoyer("depuis l'invité".into());
        assert_eq!(attendre(&rx_h), Evenement::Message("depuis l'invité".into()));
    }

    #[test]
    fn quitter_previent_l_autre() {
        let (hote, rx_h, _invite, rx_i) = duel();
        hote.quitter();
        assert_eq!(attendre(&rx_h), Evenement::Fin("quitte".into()));
        assert_eq!(attendre(&rx_i), Evenement::Fin("adversaire-parti".into()));
    }

    #[test]
    fn un_code_sans_defi_est_inconnu() {
        let (invite, rx_i) = reseau(&relais());
        invite.rejoindre("ZZZZ", "Matteo");
        assert_eq!(attendre(&rx_i), Evenement::Fin("inconnu".into()));
    }

    #[test]
    fn quitter_un_defi_qui_attend_libere_pour_la_suivante() {
        let (hote, rx_h) = reseau(&relais());
        hote.creer("Thibault");
        assert!(matches!(attendre(&rx_h), Evenement::Code(_)));
        hote.creer("Thibault");
        hote.quitter();
        assert_eq!(attendre(&rx_h), Evenement::Fin("quitte".into()));
        hote.creer("Thibault");
        assert!(matches!(attendre(&rx_h), Evenement::Code(_)));
    }

    #[test]
    fn sans_relais_c_est_injoignable() {
        let port = TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        let (hote, rx_h) = reseau(&format!("ws://127.0.0.1:{port}"));
        hote.creer("Thibault");
        assert_eq!(attendre(&rx_h), Evenement::Fin("injoignable".into()));
    }
}
