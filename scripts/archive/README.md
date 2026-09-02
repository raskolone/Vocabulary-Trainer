# Archiwum skryptów jednorazowych

Skrypty i pliki robocze z lipca i sierpnia 2026, które kiedyś przepisały
konkretny plik źródłowy — raz, po czym przestały być potrzebne. Zalegały
w katalogu głównym repozytorium (było ich tam 178 na 207 plików) i zagłuszały
pliki, które faktycznie budują aplikację.

Nic tutaj nie jest podpięte: żaden z tych plików nie jest wołany z `package.json`
ani importowany przez kod aplikacji. Sprawdzone przed przeniesieniem.

## Co tu leży

- `fix_*`, `patch_*`, `update_*`, `replace_*`, `remove_*`, `rewrite_*` — jednorazowe
  modyfikatory plików źródłowych.
- `check_*`, `test_*`, `get_*`, `query_*` — doraźne sondy do diagnostyki, nie testy
  automatyczne. W projekcie nie ma zestawu testów, więc nic ich nie uruchamia.
- `gen_yarn_*` wraz z `yarn_*_paths.json` — generatory ścieżek SVG dla dekoracji
  „włóczki" i ich wynik.
- Pliki danych, które karmiły wyłącznie te skrypty: `newSets.json`, `vocab.txt`,
  `dictionary.json`, `target_content.txt`, `replacement.txt`.
- `out.js` — nieaktualny bundle `data/generalVocabulary.ts` z esbuilda, artefakt
  budowania zacommitowany przez pomyłkę.

## Uwagi

Historia gita zachowana — wszystko przeniesione przez `git mv`, więc `git log
--follow` na dowolnym pliku nadal działa.

`tsconfig.json` wyklucza ten katalog. Bez tego `allowJs: true` wciągnąłby wszystkie
pliki `.cjs` i `.js` do typechecku: na poziomie głównym repozytorium chroniły je
wzorce `*.cjs` i `*.js`, ale te nie sięgają podkatalogów.

Skrypty czytające dane po ścieżce względnej zakładały uruchomienie z katalogu
głównego. Po przeniesieniu trzeba je odpalać z `scripts/archive/`, żeby trafiły
na swoje pliki wejściowe. Wyjątkiem są `translate_dict.ts` i `translate_free.ts`,
które zapisują `en.json` i `pl.json` — te dwa pliki zostały w katalogu głównym,
bo importuje je `i18n.ts`, więc przy ewentualnym ponownym użyciu ścieżki
wymagają poprawienia.

W użyciu pozostaje `scripts/backfill-task-owners.mjs` (uzupełnia `studentUid`
w starych zadaniach, opisany w README projektu) — dlatego został poziom wyżej.
