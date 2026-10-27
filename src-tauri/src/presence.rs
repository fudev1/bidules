// La présence au relais et les amis (voir docs/adr/0004-amis-et-invitations-par-le-relais.md).
// Tant que l'app tourne, une connexion au relais dit qui est en ligne et fait passer les invitations ; elle se refait si elle tombe.
// Comme duel.rs, elle ne connaît pas les invitations : elle passe les messages tels quels, et le panneau décide.

use serde_json::{json, Value};
use std::io::ErrorKind;
use std::sync::mpsc::{channel, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tungstenite::Message;

use crate::duel::{connecter, RELAIS};

const LETTRES: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";

#[derive(Clone)]
pub struct Presence {
    sortie: Sender<String>,
    amis: Arc<Mutex<Vec<String>>>,   // les codes d'ami à suivre
}

impl Presence {
    // Lance la connexion ; chaque message du relais arrive à `signaler`, et {"t":"hors-ligne"} quand la connexion tombe.
    pub fn lancer(relais: &str, id: &str, nom: &str, amis: Vec<String>, signaler: impl Fn(Value) + Send + 'static) -> Self {
        let (sortie, rx) = channel();
        let p = Presence { sortie, amis: Arc::new(Mutex::new(amis)) };
        let (url, nom, amis) = (format!("{relais}/presence/{id}"), nom.to_string(), p.amis.clone());
        thread::spawn(move || loop {
            if !suivre(&url, &nom, &amis, &rx, &signaler) { return; }
            signaler(json!({"t": "hors-ligne"}));
            thread::sleep(Duration::from_secs(10));
        });
        p
    }

    // Un message pour le relais ({"t":"inviter"...}) ; perdu si la connexion est tombée.
    pub fn envoyer(&self, texte: String) { let _ = self.sortie.send(texte); }

    // Les amis ont changé : le relais dit tout de suite lesquels sont en ligne.
    pub fn suivre_amis(&self, ids: Vec<String>) {
        *self.amis.lock().unwrap() = ids;
        self.envoyer(String::new());
    }
}

// Une connexion, jusqu'à ce qu'elle tombe ; rend false si l'app ne s'en sert plus.
fn suivre(url: &str, nom: &str, amis: &Mutex<Vec<String>>, rx: &Receiver<String>, signaler: &impl Fn(Value)) -> bool {
    let Some((mut ws, flux)) = connecter(url) else { return true };
    let _ = flux.set_read_timeout(Some(Duration::from_millis(100)));
    if ws.send(Message::text(json!({"t": "nom", "nom": nom}).to_string())).is_err() { return true; }
    // la liste des amis en ligne, toutes les 20 s : elle garde aussi la connexion en vie
    let mut demande = Instant::now() - Duration::from_secs(60);
    loop {
        if demande.elapsed() > Duration::from_secs(20) {
            demande = Instant::now();
            let ids = amis.lock().unwrap().clone();
            if ws.send(Message::text(json!({"t": "presents", "ids": ids}).to_string())).is_err() { return true; }
        }
        loop {
            match rx.try_recv() {
                Ok(t) if t.is_empty() => demande = Instant::now() - Duration::from_secs(60),
                Ok(t) => { if ws.send(Message::text(t)).is_err() { return true; } }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => { let _ = ws.close(None); let _ = ws.flush(); return false; }
            }
        }
        match ws.read() {
            Ok(Message::Text(t)) => { if let Ok(v) = serde_json::from_str(t.as_str()) { signaler(v) } }
            Ok(Message::Close(_)) => return true,
            Ok(_) => {}
            Err(tungstenite::Error::Io(e)) if matches!(e.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {}
            Err(_) => return true,
        }
    }
}

// Un code d'ami tout neuf, six lettres au hasard.
fn nouveau_code() -> String {
    use std::hash::{BuildHasher, Hasher};
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    let mut n = h.finish();
    (0..6).map(|_| { let c = LETTRES[(n % LETTRES.len() as u64) as usize] as char; n /= LETTRES.len() as u64; c }).collect()
}

// Garde seulement les lettres, en majuscules : "kzp-qrs" devient "KZPQRS".
pub fn propre(code: &str) -> String {
    code.chars().filter(char::is_ascii_alphabetic).collect::<String>().to_uppercase()
}

// ---- Dans l'app : le code d'ami et les amis gardés sur la machine, les commandes du panneau ----

use tauri::{AppHandle, Emitter, Manager};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Ami { pub id: String, pub nom: String }

struct Amis { id: String, liste: Mutex<Vec<Ami>>, presence: Presence }

fn fichier(app: &AppHandle, nom: &str) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(nom))
}

fn garder(app: &AppHandle, liste: &[Ami]) {
    if let Some(p) = fichier(app, "amis.json") { crate::ecrire_entier(&p, &serde_json::to_string(liste).unwrap_or_default()); }
}

pub fn brancher(app: &AppHandle) {
    let lire = |nom| fichier(app, nom).and_then(|p| std::fs::read_to_string(p).ok());
    let id = lire("ami.txt").map(|s| propre(&s)).filter(|s| s.len() == 6).unwrap_or_else(|| {
        let id = nouveau_code();
        if let Some(p) = fichier(app, "ami.txt") {
            if let Some(d) = p.parent() { let _ = std::fs::create_dir_all(d); }
            let _ = std::fs::write(p, &id);
        }
        id
    });
    let liste: Vec<Ami> = lire("amis.json").and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
    let h = app.clone();
    let presence = Presence::lancer(RELAIS, &id, &crate::duel::mon_nom(), liste.iter().map(|a| a.id.clone()).collect(), move |v| {
        // un ami vu en ligne sous un autre nom : on le garde sous ce nom
        if let (true, Some(amis)) = (v["t"] == "presents", h.try_state::<Amis>()) {
            let mut liste = amis.liste.lock().unwrap();
            let mut change = false;
            for a in v["amis"].as_array().into_iter().flatten() {
                if let (Some(i), Some(n)) = (a["id"].as_str(), a["nom"].as_str()) {
                    if let Some(ami) = liste.iter_mut().find(|x| x.id == i && x.nom != n) { ami.nom = n.into(); change = true; }
                }
            }
            if change { garder(&h, &liste); }
        }
        let _ = h.emit("presence", v);
    });
    app.manage(Amis { id, liste: Mutex::new(liste), presence });
}

fn changer(app: &AppHandle, f: impl FnOnce(&mut Vec<Ami>)) -> Vec<Ami> {
    let amis = app.state::<Amis>();
    let mut liste = amis.liste.lock().unwrap();
    f(&mut liste);
    garder(app, &liste);
    amis.presence.suivre_amis(liste.iter().map(|a| a.id.clone()).collect());
    liste.clone()
}

#[tauri::command]
pub fn amis_infos(app: AppHandle) -> Value {
    let amis = app.state::<Amis>();
    let liste = amis.liste.lock().unwrap().clone();
    json!({"id": amis.id, "amis": liste})
}

// Ajoute un ami par son code d'ami ; son nom arrive quand il est en ligne. Rend la nouvelle liste.
#[tauri::command]
pub fn ami_ajouter(app: AppHandle, id: String, nom: Option<String>) -> Vec<Ami> {
    let id = propre(&id);
    let moi = app.state::<Amis>().id.clone();
    changer(&app, |l| {
        if id.len() != 6 || id == moi || l.iter().any(|a| a.id == id) { return; }
        l.push(Ami { id, nom: nom.unwrap_or_default() });
    })
}

#[tauri::command]
pub fn ami_retirer(app: AppHandle, id: String) -> Vec<Ami> { changer(&app, |l| l.retain(|a| a.id != id)) }

// Un message pour le relais, écrit par le panneau : {"t":"inviter"...}, {"t":"refuser"...}, {"t":"annuler"...}.
#[tauri::command]
pub fn presence_envoyer(app: AppHandle, texte: String) { app.state::<Amis>().presence.envoyer(texte) }

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{TcpListener, TcpStream};
    use tungstenite::WebSocket;

    // Un faux annuaire, qui fait comme la classe Annuaire de relais/relais.js.
    fn relais() -> String {
        let ecoute = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = ecoute.local_addr().unwrap().port();
        let bidules: Arc<Mutex<Vec<(String, String, Sender<String>)>>> = Arc::default();
        thread::spawn(move || for flux in ecoute.incoming().flatten() {
            let bidules = bidules.clone();
            thread::spawn(move || {
                let mut chemin = String::new();
                let Ok(mut ws): Result<WebSocket<TcpStream>, _> = tungstenite::accept_hdr(flux, |req: &tungstenite::handshake::server::Request, r| {
                    chemin = req.uri().path().to_string(); Ok(r)
                }) else { return };
                let id = chemin.trim_start_matches("/presence/").to_string();
                let Ok(Message::Text(t)) = ws.read() else { return };
                let nom = serde_json::from_str::<Value>(t.as_str()).unwrap()["nom"].as_str().unwrap().to_string();
                let (tx, rx) = channel();
                bidules.lock().unwrap().push((id.clone(), nom.clone(), tx));
                ws.get_ref().set_read_timeout(Some(Duration::from_millis(5))).unwrap();
                loop {
                    while let Ok(m) = rx.try_recv() { let _ = ws.send(Message::text(m)); }
                    let m: Value = match ws.read() {
                        Ok(Message::Text(t)) => serde_json::from_str(t.as_str()).unwrap(),
                        Err(tungstenite::Error::Io(_)) | Ok(_) => continue,
                        Err(_) => { bidules.lock().unwrap().retain(|b| b.0 != id); return; }
                    };
                    let liste = bidules.lock().unwrap().clone();
                    let ami = liste.iter().find(|b| m["a"] == b.0.as_str());
                    match m["t"].as_str() {
                        Some("presents") => {
                            let amis: Vec<Value> = liste.iter().filter(|b| m["ids"].as_array().unwrap().contains(&json!(b.0))).map(|b| json!({"id": b.0, "nom": b.1})).collect();
                            let _ = ws.send(Message::text(json!({"t": "presents", "amis": amis}).to_string()));
                        }
                        Some("inviter") => match ami {
                            Some(a) => { let _ = a.2.send(json!({"t": "invitation", "de": id, "nom": nom, "code": m["code"], "jeu": m["jeu"]}).to_string()); }
                            None => { let _ = ws.send(Message::text(json!({"t": "absent", "a": m["a"]}).to_string())); }
                        },
                        Some("refuser") => if let Some(a) = ami { let _ = a.2.send(json!({"t": "refus", "de": id, "nom": nom, "raison": m["raison"]}).to_string()); },
                        _ => {}
                    }
                }
            });
        });
        format!("ws://127.0.0.1:{port}")
    }

    fn presence(url: &str, id: &str, nom: &str, amis: &[&str]) -> (Presence, Receiver<Value>) {
        let (tx, rx) = channel();
        let tx = Mutex::new(tx);
        (Presence::lancer(url, id, nom, amis.iter().map(|s| s.to_string()).collect(), move |v| { let _ = tx.lock().unwrap().send(v); }), rx)
    }

    // attend un message de ce type, en passant les autres
    fn attendre(rx: &Receiver<Value>, t: &str) -> Value {
        let fin = Instant::now() + Duration::from_secs(5);
        loop {
            let v = rx.recv_timeout(fin.saturating_duration_since(Instant::now())).expect("aucun message");
            if v["t"] == t { return v; }
        }
    }

    #[test]
    fn un_ami_ajoute_est_vu_en_ligne() {
        let url = relais();
        let (_thibault, _) = presence(&url, "THIBAU", "Thibault", &[]);
        thread::sleep(Duration::from_millis(200));
        let (matteo, rx) = presence(&url, "MATTEO", "Matteo", &[]);
        assert_eq!(attendre(&rx, "presents")["amis"], json!([]));
        matteo.suivre_amis(vec!["THIBAU".into()]);
        assert_eq!(attendre(&rx, "presents")["amis"], json!([{"id": "THIBAU", "nom": "Thibault"}]));
    }

    #[test]
    fn une_invitation_arrive_et_son_refus_revient() {
        let url = relais();
        let (thibault, rx_t) = presence(&url, "THIBAU", "Thibault", &[]);
        let (matteo, rx_m) = presence(&url, "MATTEO", "Matteo", &["THIBAU"]);
        attendre(&rx_t, "presents");
        attendre(&rx_m, "presents");
        matteo.envoyer(json!({"t": "inviter", "a": "THIBAU", "code": "KZPQ", "jeu": "pong"}).to_string());
        let inv = attendre(&rx_t, "invitation");
        assert_eq!((inv["de"].as_str(), inv["nom"].as_str(), inv["code"].as_str()), (Some("MATTEO"), Some("Matteo"), Some("KZPQ")));
        thibault.envoyer(json!({"t": "refuser", "a": "MATTEO", "raison": "ne-pas-deranger"}).to_string());
        assert_eq!(attendre(&rx_m, "refus")["raison"], "ne-pas-deranger");
    }

    #[test]
    fn inviter_un_ami_hors_ligne() {
        let (matteo, rx) = presence(&relais(), "MATTEO", "Matteo", &[]);
        attendre(&rx, "presents");
        matteo.envoyer(json!({"t": "inviter", "a": "THIBAU", "code": "KZPQ", "jeu": "pong"}).to_string());
        assert_eq!(attendre(&rx, "absent")["a"], "THIBAU");
    }

    #[test]
    fn sans_relais_on_est_hors_ligne() {
        let port = TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        let (_p, rx) = presence(&format!("ws://127.0.0.1:{port}"), "MATTEO", "Matteo", &[]);
        attendre(&rx, "hors-ligne");
    }

    #[test]
    fn un_code_d_ami_a_six_lettres() {
        let c = nouveau_code();
        assert_eq!(c.len(), 6);
        assert!(c.bytes().all(|b| LETTRES.contains(&b)));
        assert_eq!(propre("kzp-qrs"), "KZPQRS");
    }
}
