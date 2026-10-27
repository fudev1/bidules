fn main() {
    // la version affichée dans le panneau : v0.<nombre de pull requests fusionnées>, comptées sur la branche en cours
    let fusions = std::process::Command::new("git").args(["rev-list", "--count", "--first-parent", "--merges", "HEAD"]).output().ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| "?".into());
    println!("cargo:rustc-env=BIDULE_VERSION=v0.{fusions}");
    println!("cargo:rerun-if-changed=../.git/HEAD");
    println!("cargo:rerun-if-changed=../.git/logs/HEAD");
    tauri_build::build()
}
