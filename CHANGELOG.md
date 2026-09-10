# CRIBRO ENGLISH (Recall) — Log Zmian i Stan Aplikacji

> **Cel pliku:** Niniejszy dokument stanowi kompletne, ustrukturyzowane źródło wiedzy o projekcie, architekturze, modułach biznesowych oraz wszystkich zmianach wdrożonych w systemie w ciągu ostatnich 24 godzin. Plik został przygotowany tak, aby każdy programista lub agent/edytor AI (Cursor, Windsurf, Claude Code, Antigravity, Copilot) w nowej sesji mógł natychmiast zrozumieć kontekst i kontynuować rozwój aplikacji bez konieczności ponownej analizy historii git.

---

## 1. Przegląd Platformy i Funkcjonalności

CRIBRO ENGLISH (Recall) to zaawansowana platforma edukacyjna do intensywnej nauki języka angielskiego, łącząca pracę lektora na żywo, synchronizację notatek z Notion, inteligentne prace domowe z oceną AI oraz zautomatyzowany mailing transakcyjny.

### 👥 Role i Uprawnienia w Aplikacji
1. **Kursant (`user`)**:
   - **Dashboard**: Podsumowanie dni z rzędu (streaks), przetłumaczonych zdań, fiszek i ocenionych prac.
   - **Prace domowe**: Interaktywne zadania (tłumaczenia, znajdowanie błędów, luki, puzzle zdań) z natychmiastową oceną AI oraz komentarzami lektora.
   - **Historia lekcji**: Wgląd w odbyte lekcje z Notion podzielone na 4 standardowe bloki (*Words & Phrases*, *Grammar & Accuracy*, *Pronunciation*, *Homework*).
   - **Fiszki & SRS**: Spaced Repetition System z profesjonalną wymową audio TTS.
   - **Testy i Egzaminy**: Rozwiązywanie testów diagnostycznych i okresowych.
   - **Powiadomienia Real-time**: Wyskakujące powiadomienia o nowych zadaniach, ocenionych pracach i testach.
2. **Nauczyciel (`teacher`)**:
   - **Zarządzanie lekcjami**: Import i synchronizacja z Notion, weryfikacja w stagingu, edycja bloków lekcji.
   - **Tworzenie prac domowych**: Generator prac domowych z automatycznym wyciąganiem słówek i zagadnień z lekcji.
   - **Zatwierdzanie wysyłki e-mail**: Potwierdzanie wysłania pracy domowej do kursanta przez e-mail z podglądem danych ucznia i nadawcy.
   - **Sprawdzanie zadań**: Przegląd nadesłanych prac, edycja feedbacku AI, wystawianie ocen i wskazówek.
   - **Generator testów AI**: Tworzenie testów sprawdzających opartych o historię lekcji.
3. **Administrator (`admin`)**:
   - Pełen dostęp do narzędzi nauczyciela oraz:
   - **Zarządzanie użytkownikami**: Tworzenie kont, resetowanie haseł, przypisywanie ról.
   - **Ustawienia systemowe**: Konfiguracja klucza Resend API, parametrów modeli AI, bazy tematów i materiałów.
   - **Mailing**: Podgląd logów wysyłki, szablonów, skrzynki odbiorczej (inbox) i wskaźników dostarczalności.
   - **Centrum diagnostyki**: Przegląd raportów błędów (Bug Reports) i logów serwera.

---

## 2. Architektura Techniczna i Stos Technologiczny

- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS, Lucide React, Canvas Confetti.
- **Backend**: Node.js / Express (`server.ts`), endpointy pod `/api/*`, autoryzacja Firebase Auth Bearer token.
- **Baza danych & Auth**: Firebase Firestore w czasie rzeczywistym, Firebase Authentication, Firebase Admin SDK.
- **Sztuczna Inteligencja**:
  - Google Gemini (Gemini 2.5 Flash / 3.6 Flash / Structured JSON outputs).
  - OpenAI (GPT-4o-mini / GPT-4o) jako fallback.
- **Synteza mowy (TTS)**: ElevenLabs Multilingual V2, OpenAI TTS (`tts-1`), GCP TTS z podwójnym cache (dysk serwera + Firebase Storage).
- **Mailing**: Resend API (`resend.com`), szablony responsywne HTML/CSS (`functions/src/emailTemplate.ts`), skrzynka webhooków i symulacji.
- **Integracja Notion**: Notion API Client, parser bloków i baz danych, silnik dopasowywania lekcji do bazy kursantów.

---

## 3. Szczegółowy Rejestr Zmian z Ostatnich 24 Godzin

### A. Konfiguracja Resend API i Refaktoryzacja Mailingu
- **Przeniesienie klucza API do Ustawień Admina**:
  - Usunięto pola wprowadzania i zapisywania klucza Resend API z widoku mailingu (`AdminMailingScreen.tsx`).
  - W `components/settings/SettingsScreen.tsx` dodano dedykowaną, zabezpieczoną kartę **"Konfiguracja Resend API (Mailing)"** dostępną wyłącznie dla ról `admin` oraz `teacher`.
  - Wdrożono odczyt aktualnego stanu konfiguracji z backendu (`/api/mailing/status`), maskowanie klucza (`re_••••••••`), przełącznik widoczności oraz bezpieczny zapis do `.env` i Firestore (`system/mailing`) przez `/api/mailing/save-key`.
- **Ujednolicenie nazewnictwa**:
  - Zmieniono nazwę zakładki w całym systemie z *„Poczta & Mailing”* / *„Mailing & Powiadomienia e-mail”* na proste i czytelne **„Mailing”** ([Sidebar.tsx](components/dashboard/Sidebar.tsx), [AdminPanel.tsx](components/admin/AdminPanel.tsx), [AdminMailingScreen.tsx](components/admin/AdminMailingScreen.tsx)).
- **Konfiguracja nadawców i adresów**:
  - Skonfigurowano oficjalne adresy nadawców z szybkim przełącznikiem w interfejsie: `wyrozumski@maciej.pro` oraz `maciej@learnwithmaciej.com`.
  - Dodano automatyczne formatowanie imion w polskim wołaczu (np. *„Witaj Maćku!”* zamiast mianownika) w szablonach e-mail.
  - Skonfigurowano nagłówek `Reply-To`, usunięto przedrostki `[TEST]` ze standardowych tematów wiadomości.
  - Zaimplementowano backendową symulację wiadomości przychodzących i akcje skrzynki odbiorczej przez bezpieczne endpointy API.

### B. Moduł Pracy Domowej i Potwierdzenie Wysyłki E-mail
- **Modal potwierdzenia wysyłki e-maila przez nauczyciela**:
  - Utworzono komponent [HomeworkEmailConfirmationModal.tsx](components/admin/HomeworkEmailConfirmationModal.tsx).
  - Po przypisaniu lub wygenerowaniu pracy domowej, przed wysłaniem powiadomienia e-mail wyświetla się modal z:
    - Rzeczywistym imieniem kursanta pobranym z profilu bazy danych,
    - Wyborem i potwierdzeniem adresu skrzynki nadawcy (`wyrozumski@maciej.pro` / `maciej@learnwithmaciej.com`),
    - Potwierdzeniem adresu e-mail odbiorcy,
    - Pełnym zestawieniem zadań składających się na pracę domową (tłumaczenia, luki, błędy, puzzle zdań).
  - Nauczyciel ma możliwość zatwierdzenia wysyłki lub pominięcia wysyłania e-maila (zapis samej pracy w platformie).
- **Powiadomienia Real-time o oddanych pracach**:
  - Dodano nasłuchiwacz Firestore na nowe/oddane prace domowe kursantów z dedykowanym komponentem powiadomień dla lektora ([TeacherHomeworkNotification.tsx](components/dashboard/TeacherHomeworkNotification.tsx)).
  - Dodano licznik nieprzejrzanych prac w menu bocznym (badge w `Sidebar.tsx`).
- **Usprawnienia sprawdzania prac i AI Evaluation**:
  - Wdrożono motywujący, konstruktywny prompt ewaluacji AI dla lektora w [aiSuggestions.ts](services/aiSuggestions.ts).
  - Zabezpieczono renderowanie odpowiedzi typu *fill-in-the-blank* (obsługa zarówno stringów, jak i obiektów `{ blankWord, sentence }` w [StudentHomeworkScreen.tsx](components/dashboard/StudentHomeworkScreen.tsx) i panelu nauczyciela).
  - Zaimplementowano wyskakujące okno z podsumowaniem dla kursanta po sprawdzeniu pracy ([StudentHomeworkGradedModal.tsx](components/dashboard/StudentHomeworkGradedModal.tsx)) z blokadą przeskakiwania ekranu.
- **Nowy typ zadania: Korekta błędów w zdaniu (Find Errors / Spot the Mistakes) w Pracy Domowej i Testach**:
  - **Praca domowa (`find_errors`)**:
    - **Ekran Pracy Domowej Lektora ([HomeworkScreen.tsx](components/dashboard/HomeworkScreen.tsx))**:
      - Naprawiono widoczność: kafelek „2. Poprawianie błędów w zdaniach” został w pełni powiązany z typem `find_errors` (zamiast dotychczasowego pustego lub zastępczego `fill_in_the_blank`).
      - Zaimplementowano dedykowany generator AI (`generateFindErrors`) tworzący zdania z celowymi błędami na bazie wybranych lekcji, słownictwa oraz sekcji `thingsToImprove` i `corrections`.
      - Zbudowano formularz edycji dla lektora: pola na zdanie z błędem (`incorrectSentence`), poprawną wersję (`correctSentence`), wskazówkę naprowadzającą (`hint`), kontekst PL (`polishHint`) oraz wyjaśnienie (`explanation`).
      - W podglądzie zadania oraz w widoku kursanta dodano odznakę błędu, rozwijaną wskazówkę oraz przycisk **„Kopiuj zdanie do edycji”** ułatwiający szybkie poprawienie felernego fragmentu.
    - **Modal Zadania Specjalnego Lektora ([TeacherSpecialTaskModal.tsx](components/admin/TeacherSpecialTaskModal.tsx))**:
      - Dodano przełącznik typu zadania w nagłówku modalu (`Tłumaczenie` vs `Poprawianie błędów`).
      - Zintegrowano generator `generateFindErrors` w dwustopniowym pipeline AI oraz dostosowano listę wygenerowanych zdań i tryb edycji inline do obsługi specyficznych pól `find_errors`.
    - **Kreator Prac Domowych ([HomeworkComposer.tsx](components/admin/HomeworkComposer.tsx))**:
      - W podglądzie pozycji dodano wyświetlanie wskazówki (`💡 Wskazówka: {item.hint}`).
    - **Ewaluacja AI ([geminiService.ts](services/geminiService.ts))**:
      - Zaktualizowano `evaluateTeacherHomework` o bezpośrednią obsługę ewaluacji nadesłanych przez kursanta poprawek zdań typu `find_errors`.
  - **Testy (`find_mistake`)**:
    - **Generator Testów AI ([server.ts](server.ts))**:
      - W `typeRulesMap['find_mistake']` nakazano modelowi do KAŻDEGO zdania z błędem obowiązkowo dodawać w nawiasie zwięzłą wskazówkę naprowadzającą ułatwiającą pracę kursantowi (np. `(wskazówka: zły przyimek)`, `(wskazówka: 3. osoba l. pojedynczej)`).
      - W endpointzie oceniania `/api/gemini/grade-test` dodano instrukcję weryfikującą poprawność naprawy błędu i zachowania struktury zdania.
    - **Interfejs Rozwiązywania Testu ([TestQuestionFields.tsx](components/tests/TestQuestionFields.tsx))**:
      - Wdrożono funkcję `extractSentenceHint` inteligentnie wyodrębniającą wskazówkę z nawiasów na końcu zdania.
      - W `SentenceListTask` zdanie z błędem jest czyszczone ze wskazówki, a wskazówka wyświetla się w eleganckim boksie `💡 Wskazówka: ...`.
      - Przycisk **„Kopiuj do edycji”** wkleja do pola odpowiedzi wyłącznie czyste zdanie z błędem bez nawiasu wskazówki.
      - Wyeliminowano powielanie promptu w nagłówku `TestQuestionHeader` oraz błędne renderowanie opcji jednokrotnego wyboru (radio) dla tego typu pytań.
    - **Podgląd i Edycja w Panelu Lektora ([AdminTestGenerator.tsx](components/admin/AdminTestGenerator.tsx), [TestPreviewModal.tsx](components/admin/TestPreviewModal.tsx))**:
      - Ujednolicono prezentację zadań w formie listy zdań ze złotymi odznakami błędu i podglądem klucza odpowiedzi.

### C. Zaawansowana Synchronizacja z Notion i Układ 4 Bloków
- **Granularna selekcja lekcji w synchronizacji z Notion**:
  - W modalu synchronizacji [StudentNotionSyncModal.tsx](components/admin/StudentNotionSyncModal.tsx) dodano możliwość precyzyjnego wyboru, które lekcje z bazy Notion mają zostać zaimportowane, a które pominięte, zapobiegając duplikowaniu pracy i wielokrotnemu importowi tych samych zajęć.
  - Zaimplementowano trwałą czarną listę odrzuconych lekcji (`rejectionBlacklist`) w dokumencie `notionSyncState`.
  - Wprowadzono sekcję lekcji oczekujących na zatwierdzenie w stagingu z elastyczną weryfikacją AI.
- **Ochrona widoku kursanta**:
  - Wprowadzono filtr blokujący wyświetlanie kursantom wersji roboczych (drafts / pending confirmation) — uczeń widzi wyłącznie lekcje oficjalnie zatwierdzone przez lektora.
- **Ścisły 4-blokowy format lekcji Notion**:
  - Wymuszono spójny podział każdej lekcji na 4 standardowe bloki Notion:
    1. `Words & Phrases` (słownictwo i wyrażenia)
    2. `Grammar & Accuracy` (struktury gramatyczne i poprawki językowe)
    3. `Pronunciation` (trudne dźwięki, akcent i wymowa fonetyczna)
    4. `Homework` (zadania domowe i materiały utrwalające)
  - Ukryto wiązanie ze scenariuszami na rzecz bezpośredniego, czytelnego układu blokowego Notion.
  - Dodano narzędzie retroaktywnego czyszczenia i migracji starszych lekcji do nowego formatu ([CleanLessonsModal.tsx](components/admin/CleanLessonsModal.tsx)).
- **Toggle Heading widoku „Do potwierdzenia” (Notion-style)**:
  - Sekcja lekcji oczekujących na potwierdzenie została przekształcona w kompaktowy **Toggle Heading** w stylu Notion ([AdminPanel.tsx](components/admin/AdminPanel.tsx)).
  - Domyślnie zwinięty widok zajmuje minimalną przestrzeń na ekranie, prezentując w jednym wierszu kluczowe metryki (liczbę lekcji oczekujących, podział na nowe wpisy i aktualizacje).
  - Rozwijanie i zwijanie jednym kliknięciem z animacją chevronu.
- **Weryfikacja istnienia lekcji w bazie kursanta & Opcja „Zaktualizuj rekord” (Update records)**:
  - Zaimplementowano algorytm weryfikujący, czy dana lekcja ze stagingu Notion istnieje już w historii kursanta (dopasowanie po `notionPageId`, dacie spotkania lub znormalizowanym tytule tematu).
  - Wpisy istniejące są wyraźnie oznaczone plakietką `🔄 Istnieje w bazie (Aktualizacja: YYYY-MM-DD)` i wyposażone w dedykowany przycisk **„Zaktualizuj rekord”**.
  - Kliknięcie „Zaktualizuj rekord” natychmiastowo konwertuje i aktualizuje istniejący rekord do najnowszego układu 4 bloków Notion (`structuredBlocks`, `vocabularyText`, `corrections`, `homeworkText`), synchronizuje powiązane zestawy fiszek w tle oraz usuwa zbędny szkic roboczy, eliminując duplikaty w bazie.
- **Wyraźne podsumowanie nowości wg dat na samej górze**:
  - Na samej górze panelu lekcji wprowadzono wyeksponowany baner analityczny badający osie czasu.
  - System porównuje daty lekcji z Notion z najnowszą potwierdzoną datą w bazie kursanta, jasno informując lektora:
    - Która lekcja jest najświeższa chronologicznie (`📅 YYYY-MM-DD — Temat`),
    - Ile wpisów to całkowicie nowe lekcje,
    - Ile wpisów to aktualizacje istniejących zajęć,
    - Jakie konkretnie nowe terminy pojawiły się w Notion ponad dotychczasową historię ucznia.

### D. Baza Kursantów: Checkboxy, Opcje Rekordu (Notion Fetch) i Operacje Masowe
- **Tick boxy (checkboxy) w bazie kursantów**:
  - Wdrożono kolumnę tick boxów w [StudentDatabaseScreen.tsx](components/admin/StudentDatabaseScreen.tsx) dla każdego kursanta oraz nadrzędny checkbox w nagłówku tabeli (z obsługą stanu częściowego zaznaczenia `indeterminate` i szybkiego zaznaczania/odznaczania wszystkich przefiltrowanych).
- **Rozszerzone opcje rekordu i bezpośredni Notion Fetch**:
  - Dodano dedykowany przycisk oraz pozycję w menu rozwijanym `...` (**Więcej opcji**) umożliwiającą natychmiastowe uruchomienie **Pobierz / Zaktualizuj z Notion** dla konkretnego kursanta przy użyciu zintegrowanego modalu [StudentNotionSyncModal.tsx](components/admin/StudentNotionSyncModal.tsx).
  - Dodatkowe szybkie akcje w menu wiersza: przejście do profilu, planer lekcji, prace domowe, szybka edycja adresu e-mail oraz bezpieczne usuwanie kursanta.
- **Pływający pasek akcji masowych (Bulk Action Bar)**:
  - Automatycznie pojawia się na dole ekranu po zaznaczeniu $\ge 1$ kursantów.
  - Wyświetla licznik zaznaczonych, przycisk **Modyfikuj wspólne**, przycisk **Usuń** (styl `danger`) oraz przycisk odznaczenia wszystkich.
- **Modal modyfikacji wspólnych elementów (Bulk Edit Modal)**:
  - Pozwala na jednoczesną zmianę poziomu zaawansowania (CEFR: A1–C2), uprawnień/roli (`user`, `teacher`, `admin`) oraz preferencji mailingu (włączenie/wyłączenie powiadomień) z opcją *(Bez zmian)* dla pól nieedytowanych.
  - Narzędzia pomocnicze w [utils/studentDatabaseUtils.ts](utils/studentDatabaseUtils.ts).
- **Bezpieczne usuwanie (Bulk Delete & Single Delete)**:
  - Modal masowego usuwania z listą usuwanych użytkowników, wyraźnym ostrzeżeniem o nieodwracalności oraz usunięciem kont zarówno z bazy Firestore, jak i z systemu Firebase Authentication.

### F. Zmiana Kolejności Zadań (Reordering) oraz Nowy Standard E-mail ze Stopką-Wizytówką
- **Zmiana kolejności zadań przed przypisaniem kursantowi (Reordering)**:
  - **Kreator prac domowych ([HomeworkComposer.tsx](components/admin/HomeworkComposer.tsx))**:
    - W kroku 4 („Sprawdź i przypisz”) dodano możliwość zmiany kolejności całych bloków/typów ćwiczeń (`moveSection`) oraz pojedynczych zadań wewnątrz sekcji (`moveItem`) przy pomocy przycisków góra/dół (`ChevronUp`, `ChevronDown`).
    - Każde zadanie otrzymało wyraźny numer porządkowy odzwierciedlający dokładną sekwencję, w jakiej uczeń będzie je wykonywać.
  - **Generator zadań specjalnych AI ([TeacherSpecialTaskModal.tsx](components/admin/TeacherSpecialTaskModal.tsx))**:
    - W liście wygenerowanych przez modele AI zdań dodano przyciski przesuwania `moveSentence` w górę i w dół, pozwalając lektorowi dowolnie ułożyć kolejność pytań przed zapisaniem i przypisaniem zadania.
  - **Generator testów ([AdminTestGenerator.tsx](components/admin/AdminTestGenerator.tsx))**:
    - Oprócz istniejącego przestawiania pytań głównych, dodano funkcję `moveSentenceInQuestion` z przyciskami góra/dół dla zdań podrzędnych (np. w pytaniach złożonych z wielu zdań do tłumaczenia lub korekty), z automatyczną synchronizacją i reindeksacją klucza odpowiedzi.
  - **Ręczny edytor pracy domowej ([HomeworkScreen.tsx](components/dashboard/HomeworkScreen.tsx))**:
    - W formularzu tworzenia/edycji zadań lektora dodano przyciski góra/dół dla ćwiczeń tłumaczeniowych (`moveTranslationItem`) oraz zdań z błędami do korekty (`moveErrorCorrectionItem`).
- **Uproszczenie treści e-maila z powiadomieniem o pracy domowej**:
  - Zgodnie z wytycznymi usunięto szczegółowe listowanie treści zadań i zdań w wiadomości e-mail — mail zawiera wyłącznie zwięzłą informację o przypisaniu pracy domowej z tytułem, opcjonalnym terminem wykonania, ewentualnymi wskazówkami/notatką lektora oraz dużym przyciskiem CTA kierującym do aplikacji ([services/homeworkEmail.ts](services/homeworkEmail.ts), [functions/src/emailTemplate.ts](functions/src/emailTemplate.ts)).
  - Zsynchronizowano wizualny podgląd w modalu potwierdzenia lektora ([HomeworkEmailConfirmationModal.tsx](components/admin/HomeworkEmailConfirmationModal.tsx)).
- **Elegancka stopka maila — Wizytówka lektora (zgodnie ze wzorem)**:
  - Wdrożono wizytówkę lektora w stopce wiadomości o strukturze:
    - Obramowanie w kolorze niebieskim (`border: 1.5px solid #2563eb`), zaokrąglone rogi i tło karty,
    - Pogrubione imię i nazwisko: **Maciej Wyrozumski**,
    - Tytuł zawodowy: `Instructional Designer | AI EdTech Specialist | English Trainer`,
    - Ciemna linia oddzielająca (`border-top: 2px solid #0f172a`),
    - Zestaw 5 kontaktów z dedykowanymi ikonami i aktywnymi linkami:
      1. ✉️ `wyrozumski@maciej.pro` (mailto)
      2. 📞 `+48 698 250 507` (tel)
      3. 🌐 `www.maciej.pro` (https)
      4. 🔗 `linkedin.com/in/maciej-pro` (https)
      5. 🐙 `github.com/raskolone` (https)
    - Wersja czysto-tekstowa (plain text) zachowuje ten sam układ i komplet danych kontaktowych.

### G. Architektura Panelu Nauczyciela & Poprawki UI/UX
- **Wydzielenie bazy kursantów**:
  - Utworzono niezależny ekran bazy uczniów [StandaloneStudentDatabaseScreen.tsx](components/admin/StandaloneStudentDatabaseScreen.tsx).
  - Usunięto problematyczny kafelek z panelu nauczyciela, rozwiązując błędy z zapętlonym routingiem i nieintencjonalnym spadaniem do panelu kursanta.
- **Optymalizacja renderowania `AdminPanel`**:
  - Wyeliminowano niepotrzebne przeładowania (remounting) panelu administracyjnego przy zmianie aktywnej zakładki lub selekcji ucznia.
- **Nowy komponent nagłówka kursanta**:
  - Wdrożono [StudentHeroHeader.tsx](components/dashboard/StudentHeroHeader.tsx) z podsumowaniem statystyk, poziomem CEFR, progresem i streakami.
- **Wymiana natywnych alertów**:
  - Wszystkie przeglądarkowe wywołania `window.alert(...)` zastąpiono nowoczesnym, wycentrowanym oknem modalnym [AdminMessageModal.tsx](components/ui/AdminMessageModal.tsx).

### H. Jakość Kodu, Typowanie i Testy Automatyczne
- **Testy jednostkowe**:
  - Przechodzi **144 na 144 testów jednostkowych** (100% pass):
    - `tests/studentDatabaseBulk.test.ts` (9 testów operacji masowych i selekcji)
    - `tests/lessonBlocks.test.ts` (19 testów podziału na 4 bloki i ich konwersji)
    - `tests/homework.test.ts` (35 testów logiki prac domowych i typów odpowiedzi)
    - `tests/notionSync.test.ts` (28 testów synchronizacji z Notion i blacklisty)
    - `tests/flashcardGenerator.test.ts` (14 testów)
    - `tests/vocabularyContext.test.tsx` (17 testów)
    - `tests/gamification.test.ts` (22 testy)
- **TypeScript**:
  - `npx tsc --noEmit` kończy się kodem `0` (brak jakichkolwiek błędów typowania).
- **Produkcyjny Build**:
  - `npm run build` kompiluje aplikację Vite oraz PWA Service Worker bez przeszkód.

### I. Nowa Organizacja Panelu Nauczyciela: Koncepcja „Bez zbędnego szumu” & Przyjazna ADHD
- **Czysty widok główny (General View) z 3 modułami uniwersalnymi**:
  - Zgodnie z wytycznymi z widoku głównego usunięto rozpraszające kafelki powiązane z pojedynczymi kursantami.
  - Pozostawiono wyłącznie 3 uniwersalne, estetyczne kafelki modułów ogólnych:
    1. **Planer lekcji** (`lesson-planner`) — projektowanie scenariuszy zajęć i materiałów dydaktycznych,
    2. **Prezentacja & Notatnik** (`presentation`) — interaktywna tablica lekcyjna, rysowanie i slajdy,
    3. **Mailing** (`mailing`) — moduł newsletterów, szablonów i masowych powiadomień przez Resend API.
  - Aktywny moduł ogólny otwiera się bezpośrednio pod kafelkami z wyraźnym nagłówkiem modułu oraz przyciskiem *„✕ Zamknij moduł / Wróć do profilu kursanta”*.
- **Wydzielony obszar roboczy profilu kursanta (Student Workspace)**:
  - Przy braku wybranego kursanta: czytelna, estetyczna karta zachęcająca do wyboru ucznia z wyszukiwarki.
  - Po wyborze kursanta wyświetla się **Student Hero Card** z najważniejszymi informacjami w pigułce:
    - Zdjęcie / inicjały, pełne imię i nazwisko, login `@username`,
    - Odznaka poziomu CEFR (A1–C2) oraz rola systemowa (`Kursant`, `Nauczyciel`, `Admin`),
    - Wskaźnik dostarczalności e-mail Resend (`✓ Dostarczalny` vs `⚠ Zastępczy`),
    - Licznik wizyt, data ostatniej aktywności,
    - Szybki przycisk synchronizacji z Notion (`StudentNotionSyncModal`),
    - Przyciski szybkiej zmiany ucznia oraz zamknięcia profilu.
- **Estetyczne i czytelne zakładki na górze profilu**:
  - Pasek 7 poziomych zakładek z wyraźnym stanem aktywnym (wysoki kontrast `bg-primary`, brak rozpraszających animacji i mrugania):
    1. `Profil & Dane` (UserIcon)
    2. `Kontekst` (FileText)
    3. `Historia lekcji` (BookOpen + badge z liczbą lekcji)
    4. `Praca domowa` (Award + badge z liczbą zadań)
    5. `Słownictwo & AI` (BookMarked + badge z liczbą zestawów fiszek)
    6. `Testy AI` (Award)
    7. `Statystyki & Wyniki` (BarChart2)
- **Kompletna zakładka „Profil & Dane” (odzwierciedlenie Bazy Kursantów)**:
  - Zbudowano 5 dedykowanych, ustrukturyzowanych kart edycji:
    1. **Dane podstawowe i identyfikacja**: Imię, Nazwisko, Login konta (`@username`) z przyciskiem natychmiastowej zmiany, ID użytkownika,
    2. **Komunikacja i powiadomienia e-mail (Mailing)**: Pole adresu e-mail, weryfikacja poprawności formatu, status Resend, intuicyjny przełącznik wypisania z mailingu (`emailNotificationsDisabled`),
    3. **Poziom zaawansowania i konfiguracja AI**: Wybór poziomu CEFR A1–C2, opis kursanta stanowiący kontekst dla promptów AI, żelazne reguły i ograniczenia dla modeli generatywnych,
    4. **Integracja Notion & Aktywność**: Wywołanie synchronizacji lekcji z bazy Notion, statystyki wizyt, liczba lekcji, data logowania,
    5. **Uprawnienia i zarządzanie kontem**: Przełącznik ról użytkownika, zmiana hasła, kopiowanie hasła do schowka, przełącznik ukończenia onboardingu, zawieszenie konta, archiwizacja, kontrola widoczności modeli AI i Live Monitora, bezpośrednia wiadomość do kursanta, bezpieczne usuwanie konta.
  - Duży, wyraźny przycisk zapisu profilu ze stanem ładowania i potwierdzeniem.

### J. Opcja Wysyłki do Ukrytego Nadawcy (BCC / Ukryta Kopia) w Module Mailing
- **Weryfikacja wychodzących wiadomości przez lektora**:
  - W module Mailing ([AdminMailingScreen.tsx](components/admin/AdminMailingScreen.tsx)) dodano opcję wysyłania ukrytej kopii wiadomości (BCC — Blind Carbon Copy) z domyślnie zaznaczonym własnym adresem e-mail lektora (`wyrozumski@maciej.pro` / `currentUser.email`), aby lektor mógł bezpośrednio we własnej skrzynce weryfikować, czy wiadomości bez przeszkód opuszczają system i jak prezentują się w programie pocztowym.
  - Szybkie przełączniki adresów lektora (`wyrozumski@maciej.pro`, `maciej@learnwithmaciej.com`) oraz możliwość wprowadzenia dowolnego adresu BCC.
- **Globalna konfiguracja BCC w ustawieniach poczty**:
  - W zakładce Ustawienia skrzynki dodano opcję trwałej konfiguracji `enableBccSender` i `bccEmail` (zapisywane w dokumencie `system/mailing` w Firestore).
- **Obsługa po stronie backendu ([server.ts](server.ts))**:
  - Endpoint `/api/mailing/test-send` odbiera parametr `bcc`, sanitizuje adresy i przekazuje je do Resend API w polu `bcc: [...]`.
  - W przypadku braku bezpośredniego parametru w żądaniu serwer automatycznie sprawdza konfigurację w Firestore i dołącza ukrytą kopię nadawcy.
  - Endpoint `/api/mailing/status` zwraca aktualny status konfiguracji `enableBccSender` i `bccEmail`.
### K. Usunięcie Wzmianek o AI z Widoków Kursanta i Ujednolicenie Interfejsu Systemu
- **Koncepcja jednego spójnego systemu**:
  - Wyeliminowano jawne akronimy i odniesienia do „AI” / „sztucznej inteligencji” z interfejsów dedykowanych kontom kursantów (`role === 'user'`).
  - Zaawansowany silnik generatywny i ewaluacyjny nadal działa w tle, napędzając platformę, jednak dla ucznia system prezentuje się jako spójny, profesjonalny i naturalny partner edukacyjny.
- **Szczegółowy zakres modyfikacji widoków kursanta**:
  - **Statystyki kursanta ([StudentStatsScreen.tsx](components/dashboard/StudentStatsScreen.tsx))**:
    - Zastąpiono etykiety dymków *„Komentarz Nauczyciela AI”* / *„Wskazówka Nauczyciela AI”* profesjonalnymi określeniami *„Komentarz pedagogiczny”* oraz *„Wskazówka językowa”*.
    - Opisy podsumowań i stanów ładowania przeformułowano na naturalne: *„Szybkie podsumowanie Twoich postępów...”*, *„Analizowanie Twoich wykonanych zdań...”*.
    - Nazwę domyślnej sesji zmieniono z *„Sesja Tłumaczeniowa AI”* na *„Sesja Tłumaczeniowa”*.
  - **Dziennik sesji ćwiczeń ([PracticeSessionsSection.tsx](components/dashboard/PracticeSessionsSection.tsx))**:
    - Zmiana typu sesji z *„Trening z AI”* / *„AI training”* na czytelny *„Trening zdań”* / *„Sentence training”*.
  - **Szczegóły lekcji i powtórki ([LessonDetails.tsx](components/dashboard/LessonDetails.tsx), [StudentLessonHistory.tsx](components/dashboard/StudentLessonHistory.tsx))**:
    - Przyciski utrwalania materiału z *„Zdania AI”* / *„Przećwicz z AI”* / *„Trening zdań z AI”* przemianowano na *„Trening zdań”* (*„Sentence Practice”*).
    - Opis opcji zmieniono na: *„Układaj i tłumacz nowe zdania kontekstowe oparte o materiał lekcji”*.
  - **Wprowadzenie dla nowych uczniów ([OnboardingOverlay.tsx](components/dashboard/OnboardingOverlay.tsx))**:
    - Zastąpiono hasła marketingowe typu *„Cribro Smart AI Training”*, *„AI-Powered Practice Formats”*, *„AI SCORING”* eleganckimi wersjami: *„Inteligentny trening językowy Cribro”*, *„Praktyczne Formaty Ćwiczeń”*, *„Ocena i feedback”*.
    - Wskazówki techniczne o modelach AI zastąpiono informacją o natychmiastowej analizie i wsparciu systemu.
  - **Moduł ćwiczeń i generowania zdań ([AIExerciseGeneratorScreen.tsx](components/dashboard/AIExerciseGeneratorScreen.tsx))**:
    - Zastąpiono sformułowania *„inteligentna korekta AI”*, *„AI przygotowuje ćwiczenie...”*, *„Trening AI”*, *„wskazówki AI”* oraz *„Rekomendowane przez AI”* czystymi, profesjonalnymi frazami (*„natychmiastowa korekta”*, *„Przygotowywanie ćwiczenia...”*, *„Trening zdań”*, *„Wzorcowe tłumaczenie”*).
    - Komunikaty błędów nie eksponują już surowych technicznych haseł AI.
  - **Testy kursanta ([StudentTestsScreen.tsx](components/tests/StudentTestsScreen.tsx))**:
    - Zmieniono komunikat braku recenzji z *„Brak feedbacku AI dla tego testu”* na *„Brak dodatkowego komentarza dla tego testu”*.
  - **Edytor zestawów słówek i fiszek ([FlashcardEditScreen.tsx](components/flashcards/FlashcardEditScreen.tsx))**:
    - Przyciski akcji zmieniono na *„Inteligentny import”*, *„Generuj z tematu”*, *„✨ Generuj”*.
    - Opisy analizy tekstu zamiast *„sztuczna inteligencja przeanalizuje go...”* informują o automatycznym stworzeniu zestawu przez system.
  - **Ustawienia lektora i dźwięku ([SettingsScreen.tsx](components/settings/SettingsScreen.tsx))**:
    - Dla kursantów zablokowano widok modeli AI, a opcje lektora przemianowano na *„Zaawansowany Lektor (Płynny)”* oraz *„Ekspresyjny Lektor (Dynamiczny)”*.
  - **Animacje ładowania i usługi ([AISkeletonLoader.tsx](components/ui/AISkeletonLoader.tsx), [VocabularyGenerator.tsx](components/dashboard/VocabularyGenerator.tsx), [LanguageContext.tsx](context/LanguageContext.tsx), [geminiService.ts](services/geminiService.ts))**:
    - Domyślny loader informuje o *„Przygotowywaniu materiału...”*, a opisy w kontekście językowym i serwisy zwracają czyste, przyjazne komunikaty błędów.
- **Zachowanie narzędzi nauczyciela i administratora**:
  - Panele `teacher` oraz `admin` zachowały pełne instrumentarium AI (prompty, wybór modeli, generator sprawdzania, zaawansowane parametry generowania zadań).

---


## 4. Przewodnik Szybkiego Startu dla Nowych Sesji i AI

### Kluczowe Komendy
```bash
# Uruchomienie serwera deweloperskiego (port domyślny 5173 / API backend na 3001)
npm run dev

# Weryfikacja typowania TypeScript
npx tsc --noEmit

# Uruchomienie wszystkich testów
npm test

# Budowanie wersji produkcyjnej
npm run build
```

### Ważne Ścieżki w Repozytorium
- `components/admin/AdminMailingScreen.tsx` — Panel Mailing (szablony, skrzynka odbiorcza, wysyłka).
- `components/settings/SettingsScreen.tsx` — Ustawienia użytkownika oraz konfiguracja klucza Resend API.
- `components/admin/HomeworkComposer.tsx` — Kreator i przypisywanie pracy domowej kursantowi.
- `components/admin/HomeworkEmailConfirmationModal.tsx` — Modal potwierdzający wysyłkę e-maila z pracą domową.
- `components/admin/StudentNotionSyncModal.tsx` — Modal synchronizacji lekcji z Notion z selekcją i blacklistą.
- `utils/lessonBlocks.ts` — Narzędzia podziału i parsowania 4 bloków lekcji Notion.
- `server.ts` — Główny serwer Express z endpointami `/api/mailing/*`, proxy Notion i TTS.
- `functions/src/emailTemplate.ts` — Szablony e-mail w HTML z brandingiem CRIBRO ENGLISH.
- `types.ts` — Główne definicje typów TypeScript w całym projekcie.

### Zasady Architektoniczne dla Kolejnych Zmian
1. **Bezpieczeństwo kluczy**: Klucze API (Resend, Notion, OpenAI, Gemini) nie mogą znajdować się w kodzie frontendu. Zawsze korzystaj z endpointów serwerowych `/api/*` z weryfikacją tokenu Firebase (`Authorization: Bearer <token>`).
2. **Format lekcji**: Wszelkie operacje na lekcjach powinny zachowywać i respektować format 4 bloków Notion (`Words & Phrases`, `Grammar & Accuracy`, `Pronunciation`, `Homework`).
3. **Powiadomienia e-mail**: Wysyłka e-maili do kursantów powinna odbywać się z potwierdzeniem lektora, z poprawnym wołaczem imienia oraz nadawcą `wyrozumski@maciej.pro` lub `maciej@learnwithmaciej.com`.
4. **Testy jednostkowe**: Przed zatwierdzeniem zmian upewnij się, że `npx tsc --noEmit` oraz `npm test` wykonują się bezbłędnie.
