import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, LogIn } from 'lucide-react';
import { PublicTest } from '../../types';
import {
  PublicTestUnavailable,
  getPublicTest,
  submitPublicTest,
} from '../../services/publicTest';
import {
  formatAccessCode,
  isValidAccessCode,
  normalizeAccessCode,
  readAccessCodeFromPath,
} from '../../utils/accessCode';
import TestQuestionFields, { TestQuestionHeader } from './TestQuestionFields';

/**
 * Test poziomujący dla kandydata, którego nie ma jeszcze w bazie.
 *
 * Ekran stoi poza aplikacją: bez logowania, bez menu, bez panelu. Kandydat trafia
 * tu z linku albo z kodu, który dostał od lektora, i ma przed sobą wyłącznie
 * test — każdy dodatkowy element to pytanie „czy ja tu w ogóle powinienem być".
 *
 * Odpowiedzi nie są tu oceniane przez model. Ocena wymaga zalogowanego konta
 * (patrz `/api/gemini/grade-test`), a kandydat go nie ma; podejście ląduje więc
 * u lektora, który ocenia je jednym kliknięciem w swoim panelu. To także
 * zamyka drogę do generowania kosztów AI przez kogokolwiek, kto zna kod.
 *
 * Jedna rzecz naraz: pytania idą pojedynczo, z paskiem postępu. Lista
 * dwudziestu zadań naraz zniechęca, zanim kandydat przeczyta pierwsze.
 */

interface PublicTestScreenProps {
  /** Kod z linku. Puste — ekran poprosi o wpisanie. */
  initialCode?: string;
}

type Phase = 'code' | 'loading' | 'intro' | 'solving' | 'sent' | 'unavailable';

const UNAVAILABLE_MESSAGES: Record<PublicTestUnavailable, { title: string; body: string }> = {
  not_found: {
    title: 'Nie znaleźliśmy takiego testu',
    body: 'Sprawdź kod — łatwo pomylić się o jeden znak. Jeśli dalej nie działa, poproś lektora o nowy link.',
  },
  inactive: {
    title: 'Ten test jest już zamknięty',
    body: 'Lektor wyłączył go dla nowych podejść. Napisz do niego po świeży kod.',
  },
  expired: {
    title: 'Termin tego testu minął',
    body: 'Kod stracił ważność. Poproś lektora o nowy — Twoje dane nie są nigdzie zapisane.',
  },
};

const PublicTestScreen: React.FC<PublicTestScreenProps> = ({ initialCode = '' }) => {
  const [phase, setPhase] = useState<Phase>(initialCode ? 'loading' : 'code');
  const [codeInput, setCodeInput] = useState(initialCode);
  const [test, setTest] = useState<PublicTest | null>(null);
  const [reason, setReason] = useState<PublicTestUnavailable>('not_found');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const openTest = async (code: string) => {
    setPhase('loading');
    setError('');
    try {
      const { test: found, reason: why } = await getPublicTest(code);
      if (!found) {
        setReason(why || 'not_found');
        setPhase('unavailable');
        return;
      }
      setTest(found);
      setPhase('intro');
    } catch (e) {
      console.error('Nie udało się otworzyć testu:', e);
      setReason('not_found');
      setPhase('unavailable');
    }
  };

  useEffect(() => {
    if (initialCode) openTest(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const handleSend = async () => {
    if (!test) return;
    setIsSending(true);
    setError('');
    try {
      await submitPublicTest(test.id, {
        candidateName: name.trim() || 'Kandydat bez podanego imienia',
        ...(email.trim() ? { candidateEmail: email.trim() } : {}),
        answers,
        submittedAt: new Date().toISOString(),
      });
      setPhase('sent');
    } catch (e: any) {
      console.error('Nie udało się wysłać testu:', e);
      // Odpowiedzi zostają w stanie komponentu, więc ponowne wysłanie nie
      // wymaga rozwiązywania testu od nowa.
      setError('Nie udało się wysłać odpowiedzi. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setIsSending(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-base-100 text-content">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">{children}</div>
    </div>
  );

  if (phase === 'loading') {
    return shell(
      <div className="flex justify-center py-20 text-content-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (phase === 'code') {
    return shell(
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold text-white">Test poziomujący</h1>
          <p className="text-[15px] text-content-muted leading-relaxed">
            Wpisz kod, który dostałeś od lektora. Nie musisz zakładać konta.
          </p>
        </header>

        <div className="space-y-3">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValidAccessCode(codeInput)) openTest(codeInput);
            }}
            autoFocus
            placeholder="np. ABC-123"
            aria-label="Kod dostępu do testu"
            className="w-full min-h-[3.5rem] px-4 rounded-xl bg-base-200 border border-white/15 text-white text-2xl font-mono tracking-[0.2em] text-center uppercase focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => openTest(codeInput)}
            disabled={!isValidAccessCode(codeInput)}
            className="w-full min-h-[3.25rem] flex items-center justify-center gap-2 rounded-xl bg-primary text-accent-ink font-bold disabled:opacity-40"
          >
            <LogIn size={16} /> Otwórz test
          </button>
          {codeInput.length > 0 && !isValidAccessCode(codeInput) && (
            <p className="text-[13px] text-content-muted text-center">
              Kod ma sześć znaków — wpisano {normalizeAccessCode(codeInput).length}.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'unavailable') {
    const message = UNAVAILABLE_MESSAGES[reason];
    return shell(
      <div className="rounded-2xl border border-white/10 bg-base-200/50 p-6 text-center space-y-3">
        <h1 className="text-xl font-extrabold text-white">{message.title}</h1>
        <p className="text-[15px] text-content-muted leading-relaxed">{message.body}</p>
        <button
          onClick={() => {
            setCodeInput('');
            setPhase('code');
          }}
          className="min-h-[3rem] px-5 rounded-xl border border-white/15 text-content font-bold"
        >
          Wpisz inny kod
        </button>
      </div>
    );
  }

  if (phase === 'sent') {
    return shell(
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-6 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-xl font-extrabold text-white">Gotowe, wysłane</h1>
        <p className="text-[15px] text-content-muted leading-relaxed">
          Lektor sprawdzi Twoje odpowiedzi i odezwie się z wynikiem oraz proponowanym poziomem.
          Możesz zamknąć tę stronę.
        </p>
      </div>
    );
  }

  if (!test) return shell(null);

  if (phase === 'intro') {
    return shell(
      <div className="space-y-6">
        <header className="space-y-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-primary">
            Kod {formatAccessCode(test.id)}
          </span>
          <h1 className="text-2xl font-extrabold text-white">{test.title}</h1>
          {test.scope && <p className="text-[15px] text-content-muted">{test.scope}</p>}
        </header>

        {test.instructions && (
          <p className="prose-justified rounded-xl border border-white/10 bg-base-200/50 p-4 text-[14px] leading-relaxed">
            {test.instructions}
          </p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
              Imię i nazwisko
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jak mamy Cię podpisać?"
              className="w-full min-h-[3.25rem] px-4 rounded-xl bg-base-200 border border-white/15 text-white focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
              E-mail <span className="normal-case font-normal">(opcjonalnie)</span>
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Tu wyślemy wynik"
              className="w-full min-h-[3.25rem] px-4 rounded-xl bg-base-200 border border-white/15 text-white focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-base-200/40 p-4 text-[13px] text-content-muted leading-relaxed">
          {test.questions.length} zadań, jedno po drugim. Nie ma limitu czasu — odpowiadaj
          spokojnie, a jeśli czegoś nie wiesz, przejdź dalej.
        </div>

        <button
          onClick={() => setPhase('solving')}
          disabled={!name.trim()}
          className="w-full min-h-[3.25rem] rounded-xl bg-primary text-accent-ink font-bold disabled:opacity-40"
        >
          Zaczynam
        </button>
      </div>
    );
  }

  // ————— Rozwiązywanie: jedno pytanie naraz —————
  const question = test.questions[index];
  const isLast = index >= test.questions.length - 1;

  return shell(
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((index + 1) / test.questions.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-content-muted shrink-0">
          {index + 1}/{test.questions.length}
        </span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-base-200/50 p-5 sm:p-6 space-y-5">
        <TestQuestionHeader question={question} />
        <TestQuestionFields
          question={question}
          answer={answers[question.id]}
          onChange={(ans) => setAnswers((prev) => ({ ...prev, [question.id]: ans }))}
        />
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {index > 0 && (
          <button
            onClick={() => setIndex((i) => i - 1)}
            className="min-h-[3.25rem] px-5 rounded-xl border border-white/15 text-content font-bold text-sm"
          >
            Wstecz
          </button>
        )}
        {isLast ? (
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 min-h-[3.25rem] flex items-center justify-center gap-2 rounded-xl bg-primary text-accent-ink font-bold disabled:opacity-50"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Wysyłam…
              </>
            ) : (
              'Wyślij test'
            )}
          </button>
        ) : (
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="flex-1 min-h-[3.25rem] rounded-xl bg-primary text-accent-ink font-bold"
          >
            Dalej
          </button>
        )}
      </div>
    </div>
  );
};

export default PublicTestScreen;

/** Kod z adresu — App.tsx pyta o to przed jakimkolwiek logowaniem. */
export const publicTestCodeFromLocation = (): string =>
  typeof window === 'undefined' ? '' : readAccessCodeFromPath(window.location.pathname);
