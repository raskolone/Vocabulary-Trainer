import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { ChevronDown, ChevronRight, Layers, Loader2 } from 'lucide-react';
import { db } from '../../firebase';
import { FlashcardSet, Flashcard } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

/**
 * „Moje słownictwo" w podglądzie lektora.
 *
 * `FlashcardContext` czyta zawsze konto zalogowanego użytkownika
 * (auth.currentUser.uid) — nie da się go poprosić o cudze zestawy bez
 * przepisania kontekstu na cały aplikacji. Ten ekran omija kontekst i
 * czyta kolekcję `sets` wprost, filtrując po `userId` wybranego kursanta —
 * dokładnie tak samo, jak w regule Firestore.
 *
 * Słownictwo z lekcji (generowane z `lessonRecords`) nie jest tu
 * powtarzane — to samo pokazuje już kafelek „Historia lekcji".
 */

interface StudentVocabPreviewProps {
  studentId: string;
}

const StudentVocabPreview: React.FC<StudentVocabPreviewProps> = ({ studentId }) => {
  const { language } = useLanguage();
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [cardsBySet, setCardsBySet] = useState<Record<string, Flashcard[]>>({});
  const [loadingSetId, setLoadingSetId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setOpenSetId(null);
    const q = query(collection(db, 'sets'), where('userId', '==', studentId));
    getDocs(q)
      .then((snap) => {
        if (!active) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FlashcardSet));
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return tb - ta;
        });
        setSets(list);
      })
      .catch((error) => console.error('Nie udało się wczytać zestawów kursanta:', error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [studentId]);

  const toggleSet = async (setId: string) => {
    if (openSetId === setId) {
      setOpenSetId(null);
      return;
    }
    setOpenSetId(setId);
    if (cardsBySet[setId]) return;
    setLoadingSetId(setId);
    try {
      const cardsRef = collection(db, `sets/${setId}/flashcards`);
      const snap = await getDocs(query(cardsRef, orderBy('position', 'asc')));
      const cards = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flashcard));
      setCardsBySet((prev) => ({ ...prev, [setId]: cards }));
    } catch (error) {
      console.error('Nie udało się wczytać fiszek zestawu:', error);
    } finally {
      setLoadingSetId(null);
    }
  };

  const L =
    language === 'pl'
      ? {
          title: 'Moje słownictwo',
          empty: 'Kursant nie ma jeszcze żadnych zestawów.',
          cards: (n: number) => `${n} ${n === 1 ? 'fiszka' : n < 5 ? 'fiszki' : 'fiszek'}`,
          assigned: 'Przypisany',
        }
      : {
          title: 'My Word Lists',
          empty: 'This student has no sets yet.',
          cards: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`,
          assigned: 'Assigned',
        };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
      <h2 className="text-[15px] font-bold text-white mb-3">{L.title}</h2>

      {isLoading ? (
        <div className="flex justify-center py-10 text-content-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : sets.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-base-200/40 p-6 text-center text-sm text-content-muted">
          {L.empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {sets.map((set) => {
            const isOpen = openSetId === set.id;
            const cards = cardsBySet[set.id];
            return (
              <li key={set.id} className="rounded-2xl border border-white/10 bg-base-200/40 overflow-hidden">
                <button
                  onClick={() => toggleSet(set.id)}
                  className="w-full min-h-[3.5rem] flex items-center gap-3 px-4 py-3 text-left active:bg-white/[0.04]"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block font-bold text-white text-[14px] leading-snug truncate">
                      {set.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-content-muted mt-0.5">
                      <span>{L.cards(set.cardCount ?? 0)}</span>
                      {set.assignedByTeacher && (
                        <span className="text-primary">· {L.assigned}</span>
                      )}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-content-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-content-muted shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-1.5">
                    {loadingSetId === set.id ? (
                      <div className="flex justify-center py-4 text-content-muted">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    ) : cards && cards.length > 0 ? (
                      cards.map((card) => (
                        <div
                          key={card.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-base-100/50 border border-white/[0.07] px-3 py-2"
                        >
                          <span className="text-[13px] text-white font-semibold truncate">{card.term}</span>
                          <span className="text-[13px] text-content-muted truncate">{card.definition}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-content-muted py-2">{L.empty}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default StudentVocabPreview;
