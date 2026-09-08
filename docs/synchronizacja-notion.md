# Synchronizacja Notion → aplikacja

Stan na 8 września 2026. Funkcje są **wdrożone i działające**:
`previewNotionSync`, `importNotionSelection` oraz `notifyStudentOnHomework`
(powiadomienia e-mail) stoją w regionie `us-central1`.

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

### 3. Jak się tego używa

Panel lektora, sekcja **Historia lekcji z Notion** — nad wyborem kursanta, bo
import dotyczy wszystkich naraz.

**Krok pierwszy: „Sprawdź Notion”.** Czyta wyłącznie właściwości stron, więc
kończy się w kilka sekund i niczego nie zapisuje. Przy każdej karcie widać, ile
lekcji na nią czeka, czy kursant ma konto, **po czym został rozpoznany** i ile
lekcji leży już w aplikacji.

Powód dopasowania jest istotny i dlatego widoczny. Kolejność kryteriów to
kolejność pewności: zapisane powiązanie → adres e-mail → imię i nazwisko →
nazwa użytkownika. Pozycje rozpoznane po nazwisku warto przejrzeć okiem, zanim
się je zaimportuje; przy powiązaniu i adresie nie ma o czym myśleć.

**Krok drugi: zaznaczenie i „Importuj”.** Domyślnie zaznaczeni są ci, którzy
mają konto i czekają na nich lekcje — jedyny przypadek bez skutków ubocznych.
Dostępne są też zaznaczenia zbiorcze (wszyscy / tylko z kontem / odznacz).

Kursant bez konta dostaje **drugi, osobny checkbox**: „Załóż konto i wyślij
hasło startowe”. Samo zaznaczenie kogoś do importu lekcji nigdy nie tworzy mu
konta. Hasła startowe pokazujemy raz, w oknie z wynikiem — trzeba je wtedy
zapisać.

Podział na dwa kroki nie jest kosmetyczny: jednym przebiegiem przez całe
archiwum przekraczaliśmy czas oczekiwania przeglądarki (`deadline-exceeded`),
bo treść każdej lekcji to osobne zapytanie do Notion.

Po imporcie warto przejrzeć lekcje oznaczone `needsReview` — to te, w których
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
- `functions/src/index.ts` — funkcje `previewNotionSync` i `importNotionSelection`
- `services/notionSync.ts`, `components/admin/NotionSyncButton.tsx`,
  `components/admin/NotionSyncResultModal.tsx` — strona aplikacji
- `tests/notionParse.test.ts`, `tests/notionMatch.test.ts` — parser podsumowań
  i rozpoznawanie kont

## Archiwum kursantów

Osobna rzecz niż „zawieś konto”. Zawieszenie odbiera dostęp komuś, kto nadal
się uczy; archiwum zamyka współpracę i zostawia historię lekcji oraz wyniki
nietknięte. Zarchiwizowani znikają z list i z przeglądu nauczyciela, wracają
przełącznikiem „Pokaż archiwum” przy liczniku wyników.

Pole `isArchived` w profilu, przycisk w karcie kursanta obok zawieszania.

## Znane ograniczenia

- **Usuwanie kont nie działa.** Na produkcji brakuje backendu (`server.ts` nie
  jest nigdzie wystawiony, Vercel serwuje sam frontend), a lokalnie
  `FIREBASE_SERVICE_ACCOUNT` w `.env` jest puste, więc Admin SDK nie ma czym się
  uwierzytelnić. Archiwizacja działa niezależnie, bo idzie prosto do Firestore.
- **Grupy** (Gulermak, Kramp) są w Notion kartami jak kursanci, ale nie mają
  odpowiednika w modelu aplikacji. Import ich nie obsługuje.
