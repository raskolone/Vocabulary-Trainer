# Synchronizacja Notion → aplikacja

Stan na 7 września 2026. Kod jest gotowy i zbudowany, ale **nie jest jeszcze
wdrożony** — brakuje dwóch rzeczy, które trzeba zrobić ręcznie (sekcja
„Co zostało do zrobienia”).

## Po co to jest

Historia lekcji, profile kursantów i podsumowania powstają dziś w Notion
(`Teacher HQ`). Aplikacja miała te same dane wpisywane po raz drugi. Synchronizacja
usuwa tę podwójną pracę, nie odbierając Notion roli kopii zapasowej.

Ruch idzie **wyłącznie w jedną stronę**: Notion jest źródłem prawdy, aplikacja
tylko czyta. Zapis zwrotny wymagałby rozstrzygania konfliktów i groziłby pętlą,
w której jedna strona nadpisuje drugą.

Ponowne uruchomienie jest bezpieczne: dokument lekcji ma identyfikator strony
Notion jako własny klucz, więc druga synchronizacja aktualizuje ten sam rekord.

## Skąd i dokąd

| Notion | Aplikacja (`users/{uid}/lessonRecords`) |
|---|---|
| Temat lekcji | `topic` |
| Data lekcji | `date` |
| BLOK 1 — Lekcja w skrócie | `lessonSummary` |
| BLOK 2 — Nowe + Powtórka | `vocabularyText` |
| BLOK 2 — Corrections + Pronunciation | `thingsToImprove` |
| BLOK 3 — Homework | dopisywane do `thingsToImprove` |
| BLOK 4 — Next Lesson | `suggestedFollowUp` |

Adresy e-mail z bazy `Kursanci i grupy` trafiają do `users.email`, ale **tylko
wtedy, gdy konto ma adres zastępczy** `@student.vocabboost.com`. Adresu, który
kursant ma już poprawny, synchronizacja nie rusza — mógł go zmienić u siebie.

Importowane są lekcje ze statusem **Odbyta** albo **Podsumowanie**. Scenariusze
oznaczone jako „Pomysł” nie mają czego wnieść.

## Zmiany wprowadzone w Notion (7.09.2026)

- **`Historia Lekcji` → nowa kolumna `Kursant (relacja)`** wskazująca na bazę
  `Kursanci i grupy`, z dwustronnym polem `Lekcje` po stronie kursanta.
  Stara kolumna `Kursant` (pole wyboru) **została nietknięta** — zamiana typu
  w miejscu skasowałaby przypisania w 87 lekcjach. Synchronizacja czyta relację,
  a gdy jest pusta, wraca do pola wyboru i dopasowuje po nazwie.
- **`Kursanci i grupy` → nowa kolumna `Status współpracy`** (Aktywny /
  Nieaktywny). Puste pole znaczy „aktywny”, więc nowy kursant działa bez
  dodatkowej pracy. Nieaktywni nie są importowani i nie dostają powiadomień.
- **Beata Nosek** dodana jako rekord nieaktywny. Miała 7 lekcji w historii, ale
  nie miała własnej karty, więc relacja nie miała do czego wskazywać.
- **Monika Marcinek** oznaczona jako nieaktywna.

## Co zostało do zrobienia

### 1. Integracja Notion i sekret `NOTION_TOKEN`

1. `notion.so/my-integrations` → **New integration** (typ: internal),
   uprawnienia tylko do odczytu treści.
2. Skopiuj token (`ntn_…`).
3. **Udostępnij integracji obie bazy**: w Notion otwórz `Historia Lekcji`,
   menu `…` → **Connections** → wybierz integrację. To samo dla
   `Kursanci i grupy`. Bez tego API odpowiada 404 — Notion nie odróżnia
   „nie istnieje” od „nie masz dostępu”.
4. Zapisz token jako sekret:
   ```
   PATH="/opt/homebrew/opt/node@22/bin:$PATH" \
     firebase functions:secrets:set NOTION_TOKEN --project gen-lang-client-0425391821
   ```

### 2. Wdrożenie funkcji

```
export GOOGLE_APPLICATION_CREDENTIALS=~/.secrets/cribro/deploy-key.json
PATH="/opt/homebrew/opt/node@22/bin:$PATH" \
  firebase deploy --only functions --project gen-lang-client-0425391821
```

Wdrożą się dwie funkcje: `notifyStudentOnHomework` (powiadomienia e-mail,
gotowe od strony Resend) oraz `syncNotionLessons`.

Jeśli deploy odmówi z powodu niedopasowanej lokalizacji, popraw
`FUNCTION_REGION` w `functions/src/config.ts` na region bazy Firestore.
Region w `firebase.ts` (`getFunctions(app, 'us-central1')`) musi się zgadzać.

### 3. Pierwsze uruchomienie

Panel lektora → zakładka **Historia lekcji** → przycisk **Synchronizuj**.
Raport pokaże, ile lekcji weszło, ile pominięto i czego nie dało się dopasować.

Warto zacząć od przejrzenia lekcji oznaczonych `needsReview` — to te, w których
nie rozpoznano czterech bloków podsumowania.

## Czego świadomie nie ma

- **Harmonogramu.** Import uruchamia człowiek, dopóki nie okaże się nudny
  i przewidywalny. Cała logika siedzi w `syncLessons` i nie zależy od tego, kto
  ją wywołał — dołożenie wyzwalacza czasowego to kilka linii.
- **Zapisu zwrotnego do Notion.** Patrz „Po co to jest”.
- **Zakładania kont kursantom.** Lekcje trafiają wyłącznie do osób, które mają
  już konto w aplikacji; reszta ląduje w raporcie jako pominięta. Migracja kont
  to osobne zadanie.

## Pliki

- `functions/src/notion/client.ts` — klient API Notion (bez SDK, jak `resend.ts`)
- `functions/src/notion/parse.ts` — rozbiór podsumowania na pola rekordu
- `functions/src/notion/sync.ts` — dopasowanie kursantów i import lekcji
- `functions/src/index.ts` — funkcja `syncNotionLessons`
- `services/notionSync.ts`, `components/admin/NotionSyncButton.tsx` — strona aplikacji
