use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

/// Port, na którym stoi serwer z server.ts (patrz PORT w server.ts).
const PORT: u16 = 3000;

/// Ile czekamy na wstanie serwera, zanim i tak pokażemy okno.
const BOOT_TIMEOUT: Duration = Duration::from_secs(45);

/// Uchwyt do serwera uruchomionego przez aplikację.
///
/// Trzymamy go po to, żeby ubić go przy zamykaniu okna. Bez tego każde
/// uruchomienie zostawiałoby proces node trzymający port 3000, a kolejny
/// start aplikacji nie miałby gdzie postawić serwera.
struct ServerProcess(Mutex<Option<Child>>);

fn port_open() -> bool {
    let addr: SocketAddr = ([127, 0, 0, 1], PORT).into();
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

/// Katalog projektu, z którego uruchamiamy serwer.
///
/// Aplikacja świadomie nie pakuje serwera do siebie: klucz Gemini ma zostać
/// w pliku .env na tej maszynie, a nie w rozdawanym instalatorze. Domyślnie
/// bierzemy katalog repozytorium wkompilowany przy budowaniu, a `CRIBRO_APP_DIR`
/// pozwala wskazać inny bez przebudowy.
fn app_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("CRIBRO_APP_DIR") {
        return PathBuf::from(dir);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Uruchamia serwer tak samo, jak robi to `npm run dev` — z wczytaniem .env.
/// `npm start` tego nie robi, więc uruchomiony tak serwer nie miałby klucza AI.
fn spawn_server() -> Option<Child> {
    let dir = app_dir();
    Command::new("node")
        .arg("--env-file-if-exists=.env")
        .arg("dist/server.cjs")
        .current_dir(&dir)
        .spawn()
        .map_err(|e| eprintln!("[cribro] nie udało się uruchomić serwera w {dir:?}: {e}"))
        .ok()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();

            // Okno startuje ukryte i pokazuje się dopiero, gdy serwer odpowiada.
            // Inaczej użytkownik dostaje na starcie błąd połączenia, bo webview
            // próbuje otworzyć adres, którego jeszcze nikt nie obsługuje.
            std::thread::spawn(move || {
                let spawned = if port_open() {
                    // W trybie dev serwer podnosi już beforeDevCommand.
                    None
                } else {
                    spawn_server()
                };

                let start = Instant::now();
                while !port_open() && start.elapsed() < BOOT_TIMEOUT {
                    std::thread::sleep(Duration::from_millis(250));
                }

                if let Some(child) = spawned {
                    if let Some(slot) = handle.try_state::<ServerProcess>() {
                        if let Ok(mut guard) = slot.0.lock() {
                            *guard = Some(child);
                        }
                    }
                }

                if let Some(window) = handle.get_webview_window("main") {
                    // Pierwsze wczytanie poszło, zanim serwer wstał.
                    let _ = window.eval("window.location.replace('http://localhost:3000')");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("nie udało się zbudować aplikacji Tauri")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(slot) = app.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = slot.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
