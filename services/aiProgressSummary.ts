import { auth } from '../firebase';
import { extractErrorMessage } from './geminiService';

/**
 * Krótkie podsumowanie postępów kursanta od AI, dla panelu i ekranu statystyk.
 *
 * Cache w localStorage pod jednym kluczem na kursanta: oba miejsca, w których
 * to podsumowanie się pokazuje, czytają ten sam wpis, więc AI liczy postępy
 * raz dziennie, a nie osobno za każdym razem, gdy kursant otworzy inny ekran.
 */

export interface AiProgressSummary {
  overallTeacherCommentary: string;
  keyStrengths: string[];
  areasToImprove: string[];
  pedagogicalTip: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cacheKey = (userId: string) => `ai_teacher_stats_${userId}`;

export function readCachedAiProgressSummary(userId: string): AiProgressSummary | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data as AiProgressSummary;
  } catch {
    return null;
  }
}

export async function fetchAiProgressSummary(
  userId: string,
  stats: any,
  logsSummary: string,
  language: string
): Promise<AiProgressSummary> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
  const res = await fetch('/api/gemini/student-stats-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ stats, logsSummary, language }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errData: any = null;
    try {
      errData = JSON.parse(errText);
    } catch {}
    throw new Error(extractErrorMessage(errData, errText || 'Failed to fetch AI progress summary'));
  }

  const data = await res.json();
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
  return data;
}
