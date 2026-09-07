// Bez konsoli w wersji wydaniowej na Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cribro_desktop_lib::run()
}
