import React, { useState } from 'react';
import { AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react';
import { NotionSyncReport, syncNotionLessons } from '../../services/notionSync';

/**
 * Ręczne pobranie historii lekcji z Notion.
 *
 * Import jest świadomie uruchamiany ręcznie, a nie z harmonogramu: dopóki nie
 * zobaczymy, jak radzi sobie z prawdziwymi podsumowaniami, ktoś ma patrzeć na
 * wynik. Raport pod przyciskiem mówi wprost, ile lekcji weszło i czego nie dało
 * się dopasować — bez zaglądania w logi Cloud Functions.
 */
const NotionSyncButton: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<NotionSyncReport | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setIsRunning(true);
    setError('');
    setReport(null);
    try {
      setReport(await syncNotionLessons());
    } catch (e: any) {
      setError(e?.message || 'Synchronizacja nie powiodła się.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-base-200/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Historia lekcji z Notion</h3>
          <p className="text-xs text-content-muted mt-0.5">
            Pobiera podsumowania lekcji i uzupełnia profile kursantów. Notion pozostaje
            źródłem — ponowne uruchomienie aktualizuje te same lekcje, nie tworzy kopii.
          </p>
        </div>
        <button
          onClick={run}
          disabled={isRunning}
          className="min-h-[2.75rem] px-4 inline-flex items-center gap-2 rounded-xl bg-primary text-accent-ink font-bold text-sm disabled:opacity-60"
        >
          {isRunning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {isRunning ? 'Synchronizuję…' : 'Synchronizuj'}
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-xs text-warn bg-warn/10 border border-warn/20 rounded-xl p-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </p>
      )}

      {report && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold text-primary">
            <Check size={14} />
            Zaimportowano {report.lessonsImported} lekcji · dopasowano {report.studentsMatched}{' '}
            kursantów · uzupełniono {report.emailsUpdated} adresów e-mail
          </p>
          {(report.lessonsSkipped > 0 || report.needsReview > 0) && (
            <p className="text-xs text-content-muted">
              Pominięto {report.lessonsSkipped} (brak konta kursanta) · do przejrzenia{' '}
              {report.needsReview} (nierozpoznany format podsumowania)
            </p>
          )}
          {report.warnings.length > 0 && (
            <ul className="space-y-1">
              {report.warnings.map((warning, i) => (
                <li key={i} className="text-xs text-warn/90">
                  · {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default NotionSyncButton;
