import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Eye } from 'lucide-react';
import { db } from '../../firebase';
import { User } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import TodayScreen from './TodayScreen';

/**
 * „Panel kursanta" w menu lektora — podgląd, nie druga wersja panelu.
 *
 * Lektor ma własne konto, więc bez wyboru kursanta ten ekran czytał jego
 * własne (puste) lekcje i pokazywał panel, którego żaden kursant nigdy nie
 * zobaczy. Wybór z listy podstawia konto kursanta i renderuje dokładnie ten
 * sam `TodayScreen`, który dostaje kursant po zalogowaniu.
 *
 * Powtórki są w podglądzie wyłączone (patrz TodayScreen): sesja zapisywałaby
 * wyniki prób na koncie kursanta.
 */

interface StudentPanelPreviewProps {
  onOpenExtraPractice: () => void;
  onOpenHomework: (taskId?: string) => void;
  onStudySet: (setId: string) => void;
  onPracticeAI: (setId: string) => void;
}

const studentLabel = (student: User): string => {
  const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  return name || student.username || student.email || student.id;
};

const StudentPanelPreview: React.FC<StudentPanelPreviewProps> = (props) => {
  const { language } = useLanguage();
  const [students, setStudents] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getDocs(collection(db, 'users'))
      .then((snap) => {
        if (!active) return;
        const list: User[] = [];
        snap.forEach((d) => {
          const u = { id: d.id, ...d.data() } as User;
          if (u.role !== 'admin' && u.role !== 'teacher') list.push(u);
        });
        list.sort((a, b) => studentLabel(a).localeCompare(studentLabel(b)));
        setStudents(list);
        setSelectedId((current) => current || list[0]?.id || '');
      })
      .catch((error) => console.error('Nie udało się wczytać listy kursantów:', error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const L =
    language === 'pl'
      ? {
          label: 'Podgląd panelu kursanta',
          hint: 'Widok dokładnie taki, jaki po zalogowaniu ma kursant. Powtórki wyłączone.',
          empty: 'Brak kursantów na koncie.',
        }
      : {
          label: 'Student panel preview',
          hint: 'Exactly what the student sees after logging in. Reviews are disabled here.',
          empty: 'No students on this account yet.',
        };

  return (
    <div>
      <div className="max-w-2xl mx-auto px-4 pt-5">
        <div className="rounded-2xl border border-info/25 bg-info/[0.06] p-3.5 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-info shrink-0" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-info">
              {L.label}
            </span>
          </div>
          {isLoading ? null : students.length === 0 ? (
            <p className="text-sm text-content-muted">{L.empty}</p>
          ) : (
            <>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full min-h-[3rem] px-3 bg-base-100 text-white border border-white/15 rounded-xl text-sm font-semibold focus:border-info focus:outline-none"
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {studentLabel(student)}
                  </option>
                ))}
              </select>
              <p className="text-[12px] text-content-muted mt-2 leading-relaxed">{L.hint}</p>
            </>
          )}
        </div>
      </div>

      {selectedId && <TodayScreen {...props} studentId={selectedId} />}
    </div>
  );
};

export default StudentPanelPreview;
