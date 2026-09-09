import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { collection, doc, getDocs, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { LessonRecord, User } from '../../types';
import {
  ImportReport,
  MatchReason,
  PreviewResult,
  StudentPreview,
  importNotionSelection,
  previewNotionSync,
} from '../../services/notionSync';
import { syncFlashcardSetForLesson } from '../../services/lessonRecord';
import {
  buildVocabularySetTitle,
  countVocabularyItems,
  splitVocabularyLines,
} from '../../utils/vocabulary';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedUser: User | null;
  onSyncComplete?: () => void;
}

const normalize = (v: string): string =>
  (v || '')
    .toString()
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const MATCH_LABELS: Record<MatchReason, string> = {
  notion: 'powiązany wcześniej ID strony Notion',
  email: 'rozpoznany po adresie e-mail',
  name: 'rozpoznany po imieniu i nazwisku',
  username: 'rozpoznany po nazwie użytkownika',
};

const StudentNotionSyncModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedUser,
  onSyncComplete,
}) => {
  const [step, setStep] = useState<'checking' | 'verification' | 'importing' | 'success' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [matchedStudent, setMatchedStudent] = useState<StudentPreview | null>(null);
  const [allStudents, setAllStudents] = useState<StudentPreview[]>([]);
  const [selectedNotionId, setSelectedNotionId] = useState<string>('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
  const [localLessonCount, setLocalLessonCount] = useState<number>(0);

  // Uruchomienie sprawdzania bazy Notion przy otwarciu okna
  useEffect(() => {
    if (isOpen && selectedUser) {
      checkNotionDatabase();
    } else {
      resetState();
    }
  }, [isOpen, selectedUser?.id]);

  const resetState = () => {
    setStep('checking');
    setErrorMsg('');
    setPreviewResult(null);
    setMatchedStudent(null);
    setAllStudents([]);
    setSelectedNotionId('');
    setImportReport(null);
    setRecentLessons([]);
    setLocalLessonCount(0);
  };

  const findBestMatch = (students: StudentPreview[], user: User): StudentPreview | null => {
    if (!user) return null;

    // 1. Dopasowanie po zapisanym UID w Notion
    const byUid = students.find((s) => s.uid === user.id);
    if (byUid) return byUid;

    // 2. Dopasowanie po notionPageId w profilu kursanta
    if (user.notionPageId) {
      const byNotionId = students.find((s) => s.notionId === user.notionPageId);
      if (byNotionId) return byNotionId;
    }

    // 3. Dopasowanie po adresie e-mail
    const userEmailNorm = normalize(user.email || '');
    if (userEmailNorm) {
      const byEmail = students.find((s) =>
        s.emails.some((e) => normalize(e) === userEmailNorm)
      );
      if (byEmail) return byEmail;
    }

    // 4. Dopasowanie po imieniu i nazwisku
    const userFullNameNorm = normalize(`${user.firstName || ''} ${user.lastName || ''}`.trim());
    if (userFullNameNorm && userFullNameNorm.length >= 3) {
      const byFullName = students.find((s) => normalize(s.name) === userFullNameNorm);
      if (byFullName) return byFullName;
    }

    // 5. Dopasowanie po nazwie użytkownika
    const usernameNorm = normalize(user.username || '');
    if (usernameNorm && usernameNorm.length >= 3) {
      const byUsername = students.find((s) => normalize(s.name) === usernameNorm);
      if (byUsername) return byUsername;
    }

    return null;
  };

  const checkNotionDatabase = async () => {
    if (!selectedUser) return;
    setStep('checking');
    setErrorMsg('');

    try {
      // 1. Pobierz liczbę lokalnych lekcji kursanta w Firestore
      const recordsRef = collection(db, `users/${selectedUser.id}/lessonRecords`);
      const qRecords = query(recordsRef, orderBy('date', 'desc'));
      const recordsSnap = await getDocs(qRecords);
      setLocalLessonCount(recordsSnap.size);

      // 2. Pobierz podgląd Notion z Cloud Functions
      const result = await previewNotionSync();
      setPreviewResult(result);
      setAllStudents(result.students || []);

      // 3. Znajdź kursanta w wynikach Notion
      const matched = findBestMatch(result.students, selectedUser);
      if (matched) {
        setMatchedStudent(matched);
        setSelectedNotionId(matched.notionId);
      } else {
        setMatchedStudent(null);
        setSelectedNotionId(result.students[0]?.notionId || '');
      }

      setStep('verification');
    } catch (err: any) {
      console.error('Błąd podczas sprawdzania Notion:', err);
      setErrorMsg(err?.message || 'Nie udało się połączyć z bazą Notion lub Cloud Functions.');
      setStep('error');
    }
  };

  const handleSelectNotionCard = (notionId: string) => {
    setSelectedNotionId(notionId);
    const chosen = allStudents.find((s) => s.notionId === notionId) || null;
    setMatchedStudent(chosen);
  };

  const handleRunImport = async () => {
    if (!selectedNotionId || !selectedUser) return;

    setStep('importing');
    setErrorMsg('');

    try {
      // Krok 1: Wywołanie importu zaznaczonej karty z Notion
      const report = await importNotionSelection([
        {
          notionId: selectedNotionId,
          createAccount: false,
        },
      ]);
      setImportReport(report);

      // Krok 2: Odczyt zaktualizowanych lekcji z Firestore
      const recordsRef = collection(db, `users/${selectedUser.id}/lessonRecords`);
      const qRecords = query(recordsRef, orderBy('date', 'desc'));
      const snap = await getDocs(qRecords);

      const allRecords: LessonRecord[] = [];
      snap.forEach((docSnap) => {
        allRecords.push({ id: docSnap.id, ...docSnap.data() } as LessonRecord);
      });

      // Krok 3: Wytyczne AI & generowanie zasobów ćwiczeniowych:
      // Dla każdej lekcji z Notion tworzymy/aktualizujemy VocabularySet i zestaw fiszek
      let setsCreated = 0;
      for (const record of allRecords) {
        if (record.vocabularyText && record.vocabularyText.trim().length > 0) {
          const vocabSetId = `vocab-${record.id}`;
          const setRef = doc(db, `users/${selectedUser.id}/vocabularySets/${vocabSetId}`);
          
          await setDoc(
            setRef,
            {
              id: vocabSetId,
              studentId: selectedUser.id,
              lessonRecordId: record.id,
              title: buildVocabularySetTitle(record.date, record.topic),
              date: record.date,
              topic: record.topic,
              vocabularyText: record.vocabularyText,
              approvedItems: splitVocabularyLines(record.vocabularyText),
              itemCount: countVocabularyItems(record.vocabularyText),
              status: 'ready',
              source: 'lesson_record',
              createdAt: record.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              used: false,
            },
            { merge: true }
          );

          // Synchronizacja fiszek dla ucznia
          await syncFlashcardSetForLesson(
            record.id,
            selectedUser.id,
            record.date,
            record.topic,
            record.vocabularyText
          );
          setsCreated++;
        }
      }

      // Krok 4: Ustawienie flag powiadomień na profilu kursanta
      try {
        await updateDoc(doc(db, 'users', selectedUser.id), {
          hasNewLesson: true,
          hasNewVocabulary: true,
          notionPageId: selectedNotionId,
        });
      } catch (uErr) {
        console.warn('Could not update user hasNewLesson flag:', uErr);
      }

      setRecentLessons(allRecords.slice(0, 5));
      setStep('success');

      // Krok 5: Odświeżenie danych w panelu nadrzędnym
      onSyncComplete?.();
    } catch (err: any) {
      console.error('Błąd importu z Notion:', err);
      setErrorMsg(err?.message || 'Wystąpił błąd podczas importowania lekcji z Notion.');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  const studentName = selectedUser
    ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.username
    : 'Nie wybrano kursanta';

  const notionLessonCount = matchedStudent?.lessonCount ?? 0;
  const newLessonsCount = Math.max(0, notionLessonCount - localLessonCount);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-base-200 p-5 md:p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek modalu */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Synchronizacja lekcji z Notion</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono font-medium">
                  Notion DB
                </span>
              </h3>
              <p className="text-xs text-content-muted">
                Profil w aplikacji:{' '}
                <strong className="text-white">{studentName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-content-muted hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. KROK SPRAWDZANIA BAZY */}
        {step === 'checking' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Sprawdzam bazę danych Notion…</h4>
              <p className="text-xs text-content-muted max-w-md">
                Pobieram najnowsze wpisy ze statusem <em>Odbyta</em> lub <em>Podsumowanie</em> oraz
                dopasowuję kartę kursanta.
              </p>
            </div>
          </div>
        )}

        {/* 2. KROK BŁĘDU */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-warn/10 border border-warn/25 text-warn text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Nie udało się ukończyć operacji</p>
                <p className="text-xs text-content leading-relaxed">{errorMsg}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold text-content-muted hover:text-white"
              >
                Zamknij
              </button>
              <button
                onClick={checkNotionDatabase}
                className="px-4 py-2 rounded-xl bg-primary text-accent-ink font-bold text-sm hover:brightness-110 flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Spróbuj ponownie
              </button>
            </div>
          </div>
        )}

        {/* 3. KROK WERYFIKACJI DANYCH (PRZED IMPORTEM) */}
        {step === 'verification' && (
          <div className="space-y-5">
            {/* Wybór lub potwierdzenie powiązanej karty z Notion */}
            <div className="p-4 rounded-xl bg-base-100/60 border border-white/8 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                  <BookOpen size={14} className="text-primary" />
                  Karta kursanta w Notion
                </span>
                {matchedStudent && (
                  <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                    {MATCH_LABELS[matchedStudent.matchedBy || 'notion']}
                  </span>
                )}
              </div>

              {matchedStudent ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <div>
                    <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                      <span>{matchedStudent.name}</span>
                      {matchedStudent.level && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-content-muted">
                          {matchedStudent.level}
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-content-muted mt-0.5">
                      {matchedStudent.emails?.length > 0
                        ? matchedStudent.emails.join(', ')
                        : 'Brak wpisanego e-maila w Notion'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMatchedStudent(null)}
                    className="text-xs text-primary hover:underline self-start sm:self-center"
                  >
                    Zmień kartę z Notion
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-warn font-semibold">
                    ⚠️ Nie dopasowano automatycznie żadnej karty dla „{studentName}”. Wybierz właściwą
                    kartę z Notion:
                  </p>
                  <select
                    value={selectedNotionId}
                    onChange={(e) => handleSelectNotionCard(e.target.value)}
                    className="w-full text-xs font-semibold bg-base-200 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-primary"
                  >
                    {allStudents.map((s) => (
                      <option key={s.notionId} value={s.notionId}>
                        {s.name} ({s.lessonCount} lekcji) {s.emails?.[0] ? `· ${s.emails[0]}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Statystyki: Liczba lekcji w bazie Notion vs w Aplikacji */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-base-100/50 border border-white/8">
                <span className="text-[11px] text-content-muted block font-medium">Baza Notion</span>
                <span className="text-xl font-bold font-mono text-white mt-1 block">
                  {notionLessonCount}
                </span>
                <span className="text-[10px] text-content-muted">gotowych lekcji</span>
              </div>
              <div className="p-3 rounded-xl bg-base-100/50 border border-white/8">
                <span className="text-[11px] text-content-muted block font-medium">W aplikacji</span>
                <span className="text-xl font-bold font-mono text-content mt-1 block">
                  {localLessonCount}
                </span>
                <span className="text-[10px] text-content-muted">zapisanych wpisów</span>
              </div>
              <div className={`p-3 rounded-xl border ${newLessonsCount > 0 ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-base-100/50 border-white/8 text-content-muted'}`}>
                <span className="text-[11px] block font-medium">Nowe lekcje</span>
                <span className="text-xl font-bold font-mono mt-1 block">
                  {newLessonsCount > 0 ? `+${newLessonsCount}` : '0'}
                </span>
                <span className="text-[10px]">
                  {newLessonsCount > 0 ? 'czeka na import' : 'baza aktualna'}
                </span>
              </div>
            </div>

            {/* Weryfikacja zgodności z Wytycznymi AI */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5 text-xs">
              <h5 className="font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                <Sparkles size={14} />
                Wytyczne AI dotyczące układania lekcji w aplikacji
              </h5>
              <ul className="space-y-1.5 text-content-muted leading-relaxed">
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Dokładna data (YYYY-MM-DD):</strong> Bezwzględnie
                    zachowujemy oryginalną datę przeprowadzonej lekcji z Notion.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Dokładny temat lekcji:</strong> Oryginalny tytuł
                    z karty Notion pozostaje tematem lekcji, aby kursant mógł go podejrzeć w swoim panelu.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">4-blokowa struktura notatek:</strong> Rozbicie na
                    podsumowanie, słówka (format <code>angielski - polski</code>), błędy do poprawy
                    i plan kolejnej lekcji.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={14} className="text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Baza pod generowanie ćwiczeń:</strong> Zestaw słówek
                    oraz fiszki są tworzone automatycznie, umożliwiając lektorowi natychmiastowe generowanie
                    zadań domowych jednym kliknięciem.
                  </span>
                </li>
              </ul>
            </div>

            {/* Przyciski akcji */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-content-muted hover:text-white transition-colors"
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={handleRunImport}
                disabled={!selectedNotionId}
                className="px-5 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-btn disabled:opacity-50"
              >
                <RefreshCw size={14} />
                <span>
                  {newLessonsCount > 0
                    ? `Zaimportuj najnowsze lekcje (+${newLessonsCount})`
                    : 'Zsynchronizuj i zaktualizuj lekcje z Notion'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 4. KROK IMPORTOWANIA */}
        {step === 'importing' && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Importuję i przetwarzam lekcje…</h4>
              <p className="text-xs text-content-muted max-w-md">
                Pobieram treść bloków z Notion, ujednolicam słownictwo oraz tworzę powiązane zestawy
                ćwiczeń i fiszek. Może to potrwać kilkanaście sekund.
              </p>
            </div>
          </div>
        )}

        {/* 5. KROK SUKCESU */}
        {step === 'success' && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-white">
                  Synchronizacja zakończona sukcesem!
                </h4>
                <p className="text-xs text-content-muted leading-relaxed">
                  Zaimportowano i zaktualizowano lekcje dla kursanta{' '}
                  <strong className="text-white">{studentName}</strong>. Zgodnie z wytycznymi AI
                  dopasowano dokładne daty i tematy, a słówka zostały przygotowane do generowania
                  ćwiczeń.
                </p>
              </div>
            </div>

            {/* Podsumowanie raportu */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-base-100/50 border border-white/8 text-center">
                <span className="text-[11px] text-content-muted block">Zaimportowane lekcje</span>
                <span className="text-xl font-bold font-mono text-primary mt-0.5 block">
                  {importReport?.lessonsImported ?? recentLessons.length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-base-100/50 border border-white/8 text-center">
                <span className="text-[11px] text-content-muted block">Zestawy do ćwiczeń</span>
                <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                  Aktywne
                </span>
              </div>
              <div className="p-3 rounded-xl bg-base-100/50 border border-white/8 text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] text-content-muted block">Status w aplikacji</span>
                <span className="text-sm font-bold text-primary mt-1 block">Zsynchronizowano</span>
              </div>
            </div>

            {/* Podgląd ostatnich lekcji */}
            {recentLessons.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
                  Ostatnie zsynchronizowane lekcje:
                </span>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                  {recentLessons.map((l) => (
                    <div
                      key={l.id}
                      className="p-3 rounded-xl bg-base-100/60 border border-white/8 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-primary font-bold">{l.date}</span>
                          <span className="font-bold text-white truncate">{l.topic}</span>
                        </div>
                        {l.vocabularyText && (
                          <p className="text-[11px] text-content-muted truncate mt-0.5 font-mono">
                            {l.vocabularyText.split('\n')[0]}
                          </p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                        Gotowa do zadań ✨
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs hover:brightness-110 transition-all shadow-btn"
              >
                Zamknij okno
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentNotionSyncModal;
