import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Eye } from 'lucide-react';
import { db } from '../../firebase';
import { User } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Wspólna ramka dla wszystkich kafelków „Widoku kursanta" w menu lektora.
 *
 * Wybór kursanta jest jeden na całą sekcję — trzyma go Dashboard, nie ta
 * ramka — więc przełączanie się między kafelkami (Mój panel, Słownictwo,
 * Testy…) nie zeruje wyboru przy każdym wejściu.
 */

interface StudentPreviewFrameProps {
  studentId: string;
  onStudentIdChange: (id: string) => void;
  hint?: string;
  children: (studentId: string) => React.ReactNode;
}

const studentLabel = (student: User): string => {
  const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  return name || student.username || student.email || student.id;
};

const StudentPreviewFrame: React.FC<StudentPreviewFrameProps> = ({
  studentId,
  onStudentIdChange,
  hint,
  children,
}) => {
  const { language } = useLanguage();
  const [students, setStudents] = useState<User[]>([]);
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
        if (!studentId && list[0]?.id) onStudentIdChange(list[0].id);
      })
      .catch((error) => console.error('Nie udało się wczytać listy kursantów:', error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const L =
    language === 'pl'
      ? {
          label: 'Widok kursanta',
          hint: hint || 'Widok dokładnie taki, jaki po zalogowaniu ma kursant.',
          empty: 'Brak kursantów na koncie.',
        }
      : {
          label: 'Student view',
          hint: hint || 'Exactly what the student sees after logging in.',
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
                value={studentId}
                onChange={(e) => onStudentIdChange(e.target.value)}
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

      {studentId && children(studentId)}
    </div>
  );
};

export default StudentPreviewFrame;
