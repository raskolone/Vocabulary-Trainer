import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { BookOpenCheck, ChevronRight, X } from 'lucide-react';

interface TeacherHomeworkNotificationProps {
  onOpenHomework?: (taskId: string) => void;
}

interface NotificationItem {
  id: string;
  taskId: string;
  studentName: string;
  title: string;
  timestamp: number;
}

export const TeacherHomeworkNotification: React.FC<TeacherHomeworkNotificationProps> = ({
  onOpenHomework,
}) => {
  const [activeNotifications, setActiveNotifications] = useState<NotificationItem[]>([]);
  const knownTaskIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Play subtle gentle chime on submission
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio autoplay may be prevented by browser policy
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'specialTasks'), where('status', '==', 'submitted'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (isInitialLoadRef.current) {
          // On first load, seed known tasks so we don't alert on existing submissions
          snapshot.docs.forEach((doc) => {
            knownTaskIdsRef.current.add(doc.id);
          });
          isInitialLoadRef.current = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const taskId = change.doc.id;
            const data = change.doc.data() as any;

            if (data.status === 'submitted' && !knownTaskIdsRef.current.has(taskId)) {
              knownTaskIdsRef.current.add(taskId);

              const newItem: NotificationItem = {
                id: `${taskId}-${Date.now()}`,
                taskId,
                studentName: data.studentName || data.studentUsername || 'Kursant',
                title: data.title || 'Praca domowa',
                timestamp: Date.now(),
              };

              setActiveNotifications((prev) => [newItem, ...prev.slice(0, 2)]);
              playChime();

              // Auto-dismiss after 10s
              setTimeout(() => {
                setActiveNotifications((prev) => prev.filter((n) => n.id !== newItem.id));
              }, 10000);
            }
          }
        });
      },
      (error) => {
        console.error('TeacherHomeworkNotification snapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDismiss = (id: string) => {
    setActiveNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAction = (item: NotificationItem) => {
    handleDismiss(item.id);
    if (onOpenHomework) {
      onOpenHomework(item.taskId);
    }
  };

  if (activeNotifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none">
      <AnimatePresence>
        {activeNotifications.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 350 }}
            className="pointer-events-auto p-4 rounded-2xl bg-base-200/95 border border-primary/40 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] relative overflow-hidden"
          >
            {/* Ambient neon shine */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start gap-3 relative z-10">
              <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 shrink-0 shadow-[0_0_15px_rgba(114,240,180,0.3)]">
                <BookOpenCheck size={20} />
              </div>

              <div className="flex-1 min-w-0 pr-5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-primary">
                    Odesłano pracę
                  </span>
                </div>

                <p className="text-[14px] font-extrabold text-white leading-snug truncate">
                  {item.studentName}
                </p>
                <p className="text-[12px] text-content-muted leading-relaxed line-clamp-1 mt-0.5">
                  {item.title}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleAction(item)}
                    className="flex-1 min-h-[2.25rem] px-3.5 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-accent-ink font-bold text-xs shadow-md shadow-primary/20 hover:shadow-primary/40 active:scale-98 transition-all"
                  >
                    <span>Sprawdź i oceń</span>
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="min-h-[2.25rem] px-2.5 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-content-muted hover:text-white text-xs font-semibold transition-colors"
                  >
                    Później
                  </button>
                </div>
              </div>

              <button
                onClick={() => handleDismiss(item.id)}
                className="absolute top-1 right-1 p-1 rounded-lg text-content-muted hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Zamknij powiadomienie"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default TeacherHomeworkNotification;
