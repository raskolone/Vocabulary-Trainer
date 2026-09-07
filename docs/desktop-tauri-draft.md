# Aplikacja desktopowa (Tauri) — szkic, do dokończenia

Stan na 7 września 2026. Praca wstrzymana świadomie, na rzecz funkcjonalności
aplikacji. To, co jest w repo, kompiluje się i uruchamia — nie jest to szkielet
do wyrzucenia, tylko wersja, której brakuje dopracowania i decyzji o dystrybucji.

## Co działa

- `npm run desktop:dev` — okno Tauri na serwerze deweloperskim.
- `npm run desktop:build` — buduje `.app` i `.dmg`
  (`src-tauri/target/release/bundle/`). Pierwszy build ~4 min, kolejne ~1 min.
- Aplikacja **sama uruchamia serwer**: jeśli port 3000 nie odpowiada, odpala
  `node --env-file-if-exists=.env dist/server.cjs` w katalogu projektu i pokazuje
  okno dopiero, gdy serwer wstanie. Przy zamknięciu ubija proces serwera.
- Sprawdzone: po ubiciu serwera deweloperskiego aplikacja podniosła własny
  w ~1 s i okno się otworzyło.

## Czego brakuje

1. **Okno startuje za innymi oknami.** `set_focus()` w `src-tauri/src/lib.rs`
   nie wysuwa go na wierzch — trzeba je kliknąć w Docku. Do sprawdzenia:
   `set_focus` po `show`, ewentualnie `NSApp activateIgnoringOtherApps`.
2. **Brak podpisu i notaryzacji.** Bez tego macOS pokaże ostrzeżenie
   „niezidentyfikowany deweloper" na każdej innej maszynie.
3. **Windows i Linux nieprzetestowane.** Konfiguracja jest wieloplatformowa,
   ale budowane i uruchamiane było wyłącznie macOS/arm64.
4. **Brak auto-update.** Tauri ma do tego plugin; wymaga podpisanych paczek
   i miejsca, z którego pobierać aktualizacje.

## Wiążące ograniczenie: to nie jest aplikacja do rozdania

Aplikacja **nie pakuje w siebie serwera ani klucza AI**. Uruchamia serwer
z katalogu projektu na tej maszynie i czyta klucz z `.env`, dokładnie tak jak
`npm run dev`. Wynika z tego jedno i trzeba to powiedzieć wprost:

> Zbudowany `.app` działa **tylko na maszynie, na której stoi to repozytorium**
> wraz z `node_modules` i `.env`. Skopiowany na inny komputer otworzy puste okno.

To był świadomy wybór, nie niedopatrzenie. Alternatywa — wkompilowanie serwera
i klucza w instalator — oznaczałaby, że **klucz Gemini jedzie do każdego, kto
dostanie aplikację**, a da się go z niej wyciągnąć. Dokładnie przed tym broni
się dziś `.env`, gdzie wariant `VITE_GEMINI_API_KEY` jest wyłączony
komentarzem, „bo Vite wkleja wartość do bundla wysyłanego do przeglądarki".

## Droga do wersji dla kursantów

Kolejność jest wymuszona, nie do wyboru:

1. **Wystawić `server.ts`** (Cloud Run albo podobne). Klucz zostaje na serwerze.
2. Skierować aplikację desktopową i PWA na ten sam publiczny adres — wtedy
   instalator nie zawiera nic wrażliwego i działa na dowolnej maszynie.
3. Dopiero wtedy podpis, notaryzacja i auto-update.

Warto przy tym pamiętać, że **po kroku 1 sama PWA jest już instalowalna** —
z ikoną w Docku i trybem offline. Tauri dokłada do tego natywne okno i mniejsze
zużycie pamięci niż karta przeglądarki, ale nie jest warunkiem, żeby aplikacja
dała się „zainstalować".

## Pliki

- `src-tauri/tauri.conf.json` — okno, ikony, cele budowania.
- `src-tauri/src/lib.rs` — uruchamianie i ubijanie serwera, pokazanie okna.
- `src-tauri/icons/` — wygenerowane z `public/cribro-icon.svg`.
