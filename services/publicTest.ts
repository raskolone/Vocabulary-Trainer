import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { PublicTest, PublicTestSubmission, TestQuestion } from '../types';
import { generateAccessCode, normalizeAccessCode } from '../utils/accessCode';

/**
 * Testy otwarte — sprawdzenie poziomu kandydata, którego nie ma jeszcze w bazie.
 *
 * Kolekcja `publicTests` leży w korzeniu, bo dokument z definicji nie należy do
 * żadnego konta. Kodem dostępu jest id dokumentu: kto zna kod, ten wykonuje
 * jeden odczyt po znanym adresie i nic poza tym — reguły nie pozwalają wylistować
 * kolekcji, więc kodów nie da się zbierać hurtem.
 *
 * Podejścia idą do podkolekcji `submissions`: kandydat może tam tylko dopisać
 * własne, czytać je może wyłącznie lektor. Gdyby wyniki siedziały w samym
 * dokumencie testu, każdy kandydat widziałby odpowiedzi poprzedników.
 */

const testsRef = () => collection(db, 'publicTests');
const testRef = (code: string) => doc(db, 'publicTests', normalizeAccessCode(code));
const submissionsRef = (code: string) =>
  collection(db, `publicTests/${normalizeAccessCode(code)}/submissions`);

/** Ile razy próbujemy wylosować niezajęty kod, zanim się poddamy. */
const MAX_CODE_ATTEMPTS = 5;

export interface CreatePublicTestInput {
  title: string;
  scope: string;
  instructions?: string;
  questions: TestQuestion[];
  createdBy: string;
  /** ISO. Puste — test bez terminu. */
  expiresAt?: string;
}

/**
 * Zakłada test otwarty i zwraca go razem z kodem dostępu.
 *
 * Kod losujemy, a potem sprawdzamy, czy nie jest zajęty. Kolizja przy 480
 * milionach kombinacji jest teoretyczna, ale nadpisanie cudzego testu
 * kosztowałoby lektora gotowe podejścia, więc jedno dodatkowe czytanie na
 * wystawiony test to uczciwa cena.
 */
export async function createPublicTest(input: CreatePublicTestInput): Promise<PublicTest> {
  if (!input.createdBy) throw new Error('Brak lektora wystawiającego test.');
  if (!input.questions || input.questions.length === 0) {
    throw new Error('Test bez pytań nie ma czego sprawdzać.');
  }

  let code = '';
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const candidate = generateAccessCode();
    const existing = await getDoc(doc(db, 'publicTests', candidate));
    if (!existing.exists()) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new Error('Nie udało się wylosować wolnego kodu. Spróbuj ponownie.');

  const test: PublicTest = {
    id: code,
    title: input.title || 'Test poziomujący',
    scope: input.scope || '',
    ...(input.instructions ? { instructions: input.instructions } : {}),
    questions: input.questions,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    isActive: true,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    submissionCount: 0,
  };

  await setDoc(testRef(code), test);
  return test;
}

/** Dlaczego test się nie otworzył — kandydat ma zobaczyć powód, nie pustą stronę. */
export type PublicTestUnavailable = 'not_found' | 'inactive' | 'expired';

export interface PublicTestLookup {
  test: PublicTest | null;
  reason?: PublicTestUnavailable;
}

/**
 * Otwiera test po kodzie.
 *
 * Zwraca powód odmowy zamiast rzucać wyjątkiem: „taki kod nie istnieje" i „test
 * został zamknięty" to dla kandydata dwie różne sytuacje i dwie różne rady.
 */
export async function getPublicTest(code: string): Promise<PublicTestLookup> {
  const normalized = normalizeAccessCode(code);
  if (!normalized) return { test: null, reason: 'not_found' };

  const snapshot = await getDoc(testRef(normalized));
  if (!snapshot.exists()) return { test: null, reason: 'not_found' };

  const test = { ...(snapshot.data() as PublicTest), id: normalized };
  if (test.isActive === false) return { test: null, reason: 'inactive' };
  if (test.expiresAt && new Date(test.expiresAt).getTime() < Date.now()) {
    return { test: null, reason: 'expired' };
  }

  return { test };
}

/**
 * Zapisuje podejście kandydata.
 *
 * Licznik podejść aktualizujemy osobno i po cichu: gdyby jego nieudany zapis
 * przerywał całość, kandydat straciłby rozwiązany test przez liczbę na liście
 * lektora.
 */
export async function submitPublicTest(
  code: string,
  submission: Omit<PublicTestSubmission, 'id'>
): Promise<string> {
  const normalized = normalizeAccessCode(code);
  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await setDoc(doc(submissionsRef(normalized), id), submission);

  try {
    const testSnap = await getDoc(testRef(normalized));
    const current = Number((testSnap.data() as PublicTest | undefined)?.submissionCount || 0);
    await updateDoc(testRef(normalized), { submissionCount: current + 1 });
  } catch (error) {
    console.warn('Nie udało się zaktualizować licznika podejść:', error);
  }

  return id;
}

/** Testy wystawione przez danego lektora — lista w panelu. */
export async function getPublicTestsForTeacher(teacherId: string): Promise<PublicTest[]> {
  if (!teacherId) return [];
  const snapshot = await getDocs(
    query(testsRef(), where('createdBy', '==', teacherId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map((d) => ({ ...(d.data() as PublicTest), id: d.id }));
}

/** Podejścia do jednego testu — najnowsze pierwsze. */
export async function getPublicTestSubmissions(code: string): Promise<PublicTestSubmission[]> {
  const snapshot = await getDocs(submissionsRef(code));
  return snapshot.docs
    .map((d) => ({ ...(d.data() as PublicTestSubmission), id: d.id }))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

/** Zamyka lub otwiera test na nowe podejścia. */
export async function setPublicTestActive(code: string, isActive: boolean): Promise<void> {
  await updateDoc(testRef(code), { isActive });
}

/** Kasuje test. Podejścia zostają osierocone, więc kasujemy je razem z nim. */
export async function deletePublicTest(code: string): Promise<void> {
  const submissions = await getDocs(submissionsRef(code));
  await Promise.all(submissions.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(testRef(code));
}
