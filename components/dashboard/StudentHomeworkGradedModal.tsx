import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Award, BookOpen, MessageSquareQuote, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Button from '../ui/Button';
import { useEscapeModal } from '../../hooks/useEscapeModal';

interface StudentHomeworkGradedModalProps {
  onOpenHomework?: (taskId: string) => void;
}

const StudentHomeworkGradedModal: React.FC<StudentHomeworkGradedModalProps> = ({ onOpenHomework }) => {
  const { user } = useAuth();
  const [isClosing, setIsClosing] = useState(false);

  const isVisible = Boolean(user?.hasGradedHomework && user?.id);

  const clearNotification = async () => {
    if (!user?.id) return;
    try {
      await updateDoc(doc(db, 'users', user.id), {
        hasGradedHomework: false,
      });
    } catch (e) {
      console.error('Failed to clear hasGradedHomework notification:', e);
    }
  };

  const handleDismiss = async () => {
    setIsClosing(true);
    await clearNotification();
    setIsClosing(false);
  };

  const handleOpenTask = async () => {
    const taskId = user?.lastGradedHomeworkId;
    setIsClosing(true);
    await clearNotification();
    setIsClosing(false);
    if (taskId && onOpenHomework) {
      onOpenHomework(taskId);
    }
  };

  useEscapeModal(isVisible, () => {
    handleDismiss();
  });

  if (!isVisible || !user) return null;

  const score = typeof user.lastGradedScore === 'number' ? user.lastGradedScore : null;
  const feedback = user.lastGradedFeedback?.trim();
  const taskTitle = user.lastGradedHomeworkTitle || 'Praca domowa';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-base-200 border border-primary/35 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-[0_20px_70px_rgba(0,0,0,0.7)] relative overflow-hidden"
        >
          {/* Subtle glowing decorative gradient */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <button
            onClick={handleDismiss}
            disabled={isClosing}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white transition-colors disabled:opacity-50"
            aria-label="Zamknij"
          >
            <X size={18} />
          </button>

          <div className="relative z-10 space-y-5">
            {/* Header with icon & badge */}
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 text-primary border border-primary/30 shrink-0 shadow-[0_0_20px_rgba(114,240,180,0.25)]">
                <Award size={30} />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[11px] font-bold uppercase tracking-wider mb-1.5">
                  Nowa ocena
                </span>
                <h3 className="text-xl font-extrabold text-white leading-tight">
                  Lektor sprawdził Twoją pracę domową!
                </h3>
                <p className="text-sm font-semibold text-primary/90 mt-1 flex items-center gap-1.5 truncate">
                  <BookOpen size={14} className="shrink-0" />
                  <span>{taskTitle}</span>
                </p>
              </div>
            </div>

            {/* Score pill if available */}
            {score !== null && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-base-100/70 border border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-content-muted">
                  Twój wynik
                </span>
                <span className="font-mono text-lg font-black text-primary">
                  {score}%
                </span>
              </div>
            )}

            {/* Teacher comment quote box */}
            {feedback ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <MessageSquareQuote size={15} />
                  <span>Komentarz i wskazówki od lektora:</span>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/[0.08] to-base-100/80 border border-primary/20 text-content text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {feedback}
                </div>
              </div>
            ) : (
              <p className="text-xs text-content-muted leading-relaxed">
                Lektor przejrzał Twoje odpowiedzi i zweryfikował zadania. Kliknij poniżej, aby zobaczyć szczegółowe podsumowanie.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={handleDismiss}
                disabled={isClosing}
                className="w-full sm:w-auto px-5 text-sm"
              >
                Zamknij
              </Button>
              <Button
                onClick={handleOpenTask}
                disabled={isClosing}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-primary text-accent-ink font-bold px-6 shadow-lg shadow-primary/25 hover:shadow-primary/45"
              >
                <span>Zobacz ocenioną pracę</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default StudentHomeworkGradedModal;
