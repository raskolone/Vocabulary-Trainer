import React, { useState, useEffect } from 'react';
import { 
  Sparkles, BookOpen, Layers, Clock, FileText, CheckCircle2, 
  ChevronDown, ChevronUp, Link as LinkIcon, ExternalLink, 
  User as UserIcon, MessageSquare, AlertTriangle, Target, Plus, Eye,
  KeyRound, ListChecks, Activity, Wand2, ArrowRight
} from 'lucide-react';
import Markdown from 'react-markdown';
import { LessonRecord, GeneratedLessonScenario } from '../../types';
import { getGeneratedScenarios, parseScenarioStages } from '../../services/scenarioService';
import { extractLessonBlocks, isRecordNeedsCleanup, migrateRecordToBlocks, parseNumberedItems } from '../../utils/lessonBlocks';
import Button from '../ui/Button';
import Card from '../ui/Card';
import TTSButtons from '../flashcards/TTSButtons';
import { ScenarioPreviewModal } from './ScenarioPreviewModal';

interface CascadingLessonDetailsProps {
  record: LessonRecord;
  studentName?: string;
  onLinkScenario?: (scenario: GeneratedLessonScenario) => Promise<void>;
  onGenerateHomework?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  onUpdateRecord?: (updated: Partial<LessonRecord>) => Promise<void>;
}

export const CascadingLessonDetails: React.FC<CascadingLessonDetailsProps> = ({
  record,
  studentName,
  onLinkScenario,
  onGenerateHomework,
  onEdit,
  onDelete,
  onClose,
  onUpdateRecord
}) => {
  const [availableScenarios, setAvailableScenarios] = useState<GeneratedLessonScenario[]>([]);
  const [isLinkingOpen, setIsLinkingOpen] = useState(false);
  const [selectedScenarioForPreview, setSelectedScenarioForPreview] = useState<GeneratedLessonScenario | null>(null);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanSuccess, setCleanSuccess] = useState(false);

  // Normalizujemy bloki lekcji (działa zarówno dla nowych jak i historycznych wpisów z bazy)
  const blocks = extractLessonBlocks(record);
  const needsCleanup = isRecordNeedsCleanup(record);

  // Section collapse states (Notion-style accordion toggles)
  const [expandedSections, setExpandedSections] = useState<{
    basis: boolean;
    block1: boolean;
    block2: boolean;
    block3: boolean;
    block4: boolean;
    learningCurve: boolean;
  }>({
    basis: false,
    block1: true,
    block2: true,
    block3: true,
    block4: Boolean(blocks.nextLesson),
    learningCurve: Boolean(blocks.learningCurve)
  });

  useEffect(() => {
    getGeneratedScenarios().then(scenarios => {
      setAvailableScenarios(scenarios);
    });
  }, []);

  // Find linked scenario or parse from record
  const linkedScenario = availableScenarios.find(s => s.id === record.scenarioId) || 
    (record.scenarioTopic ? {
      id: record.scenarioId || 'linked',
      title: record.scenarioTopic,
      topic: record.scenarioTopic,
      content: record.scenarioContent || '',
      stages: record.scenarioContent ? parseScenarioStages(record.scenarioContent).stages : [],
      createdAt: record.createdAt,
      studentId: record.studentId,
      studentName: studentName || null
    } as GeneratedLessonScenario : null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSelectScenarioToLink = async (scenario: GeneratedLessonScenario) => {
    if (onLinkScenario) {
      await onLinkScenario(scenario);
      setIsLinkingOpen(false);
    }
  };

  const handleCleanRecord = async () => {
    if (!onUpdateRecord) return;
    setIsCleaning(true);
    try {
      const migrated = migrateRecordToBlocks(record);
      await onUpdateRecord(migrated);
      setCleanSuccess(true);
      setTimeout(() => setCleanSuccess(false), 4000);
    } catch (err) {
      console.error('Błąd podczas porządkowania lekcji:', err);
    } finally {
      setIsCleaning(false);
    }
  };

  const parsedVocabList = (blocks.vocabulary || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map((line, idx) => {
      let term = line;
      let def = '';
      if (line.includes(' - ')) {
        const parts = line.split(' - ');
        term = parts[0].trim();
        def = parts.slice(1).join(' - ').trim();
      } else if (line.includes(' – ')) {
        const parts = line.split(' – ');
        term = parts[0].trim();
        def = parts.slice(1).join(' – ').trim();
      } else if (line.includes(' — ')) {
        const parts = line.split(' — ');
        term = parts[0].trim();
        def = parts.slice(1).join(' — ').trim();
      } else if (line.includes(':')) {
        const parts = line.split(':');
        term = parts[0].trim();
        def = parts.slice(1).join(':').trim();
      }
      return { id: idx, term, def, raw: line };
    });

  const parsedHwSentences = parseNumberedItems(blocks.homework);

  return (
    <div className="space-y-4">
      {/* Alert dla starych wpisów z opcją 1-click uporządkowania bazy */}
      {needsCleanup && onUpdateRecord && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <Wand2 size={16} className="shrink-0 text-amber-400" />
            <span>
              Ten wpis z Notion zawierał zlane zadanie domowe w uwagach. Został uporządkowany w locie do układu bloków Notion.
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCleanRecord}
            isLoading={isCleaning}
            className="shrink-0 text-xs font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
          >
            {cleanSuccess ? '✓ Zapisano w nowym formacie!' : 'Utrwal czysty format w bazie'}
          </Button>
        </div>
      )}

      {/* 0. Scenariusz bazowy (Konspekt etapów lekcji) */}
      <div className="rounded-2xl border border-white/10 bg-base-200/50 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('basis')}
          className="p-3.5 bg-base-300/60 flex items-center justify-between gap-3 cursor-pointer hover:bg-base-300 transition-colors select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/5 text-content-muted border border-white/10 flex items-center justify-center shrink-0">
              <Layers size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-extrabold text-xs text-white">Scenariusz bazowy (Konspekt)</h4>
                {linkedScenario ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                    <LinkIcon size={10} /> Powiązano
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-content-muted">
                    Brak powiązania
                  </span>
                )}
              </div>
              <p className="text-[11px] text-content-muted truncate">
                {linkedScenario ? (linkedScenario.topic || linkedScenario.title) : 'Kliknij, aby sprawdzić lub przypisać konspekt lekcji'}
              </p>
            </div>
          </div>
          <div className="text-content-muted">
            {expandedSections.basis ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {expandedSections.basis && (
          <div className="p-4 space-y-3 border-t border-white/5 bg-base-200/30">
            {linkedScenario ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-base-300/80 border border-primary/20 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-primary font-bold flex items-center gap-1.5">
                      <Sparkles size={13} /> Scenariusz bazowy dla tej lekcji:
                    </div>
                    <div className="text-sm font-bold text-white">
                      {linkedScenario.topic || linkedScenario.title}
                    </div>
                    {linkedScenario.targetLevel && (
                      <div className="text-[11px] text-content-muted">
                        Poziom: {linkedScenario.targetLevel} • Czas: {linkedScenario.lessonDuration || '60 min'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedScenarioForPreview(linkedScenario)}
                      className="text-xs text-primary font-bold hover:bg-primary/10 flex items-center gap-1"
                    >
                      <Eye size={14} /> Pełny podgląd etapów
                    </Button>
                  </div>
                </div>

                {linkedScenario.stages && linkedScenario.stages.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {linkedScenario.stages.map((stage, sIdx) => (
                      <div 
                        key={stage.id || sIdx}
                        className="p-3 rounded-xl bg-base-300/40 border border-white/5 text-xs space-y-1"
                      >
                        <div className="font-bold text-white flex items-center justify-between gap-2">
                          <span className="truncate">{stage.title}</span>
                          {stage.duration && (
                            <span className="text-[10px] text-content-muted font-mono shrink-0">
                              {stage.duration}
                            </span>
                          )}
                        </div>
                        <p className="text-content-muted line-clamp-2 leading-relaxed">
                          {stage.body.replace(/[#*`_]/g, '')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-base-300/30 border border-white/5 text-center space-y-2.5">
                <p className="text-xs text-content-muted">
                  Ten wpis lekcji nie ma przypisanego scenariusza bazowego. Powiązanie pozwoli śledzić konspekt i cele lekcji.
                </p>
                {onLinkScenario && (
                  <div>
                    {!isLinkingOpen ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setIsLinkingOpen(true)}
                        className="text-xs font-bold flex items-center gap-1.5 mx-auto"
                      >
                        <Plus size={14} /> Powiąż ze scenariuszem
                      </Button>
                    ) : (
                      <div className="space-y-2 text-left bg-base-300/80 p-3 rounded-xl border border-white/10 mt-2">
                        <div className="flex items-center justify-between text-xs font-bold text-white pb-1 border-b border-white/10">
                          <span>Wybierz scenariusz do powiązania:</span>
                          <button onClick={() => setIsLinkingOpen(false)} className="text-content-muted hover:text-white">
                            ✕
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5">
                          {availableScenarios.map(sc => (
                            <div
                              key={sc.id}
                              onClick={() => handleSelectScenarioToLink(sc)}
                              className="p-2 rounded-lg bg-base-200 hover:bg-primary/20 hover:border-primary/40 border border-white/5 cursor-pointer text-xs transition-all flex items-center justify-between"
                            >
                              <div className="font-bold text-white truncate mr-2">
                                {sc.topic || sc.title}
                              </div>
                              <span className="text-[10px] text-content-muted shrink-0">
                                {sc.targetLevel || 'B2'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. BLOK 1: LEKCJA W SKRÓCIE (Blue Accordion / Badge) */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('block1')}
          className="p-3.5 bg-gradient-to-r from-sky-900/40 via-sky-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-sky-900/50 transition-colors select-none border-b border-sky-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
              <BookOpen size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  BLOK 1
                </span>
                <h4 className="font-extrabold text-sm text-white">Lekcja w skrócie</h4>
              </div>
              <p className="text-[11px] text-sky-200/70">Podsumowanie, kontekst i przebieg lekcji</p>
            </div>
          </div>
          <div className="text-sky-300">
            {expandedSections.block1 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
        {expandedSections.block1 && (
          <div className="p-4 bg-sky-950/10 space-y-2">
            {blocks.summary ? (
              <div className="text-sm text-content whitespace-pre-wrap leading-relaxed">
                <Markdown>{blocks.summary}</Markdown>
              </div>
            ) : (
              <p className="text-xs text-content-muted italic">Brak wpisanego streszczenia lekcji.</p>
            )}
          </div>
        )}
      </div>

      {/* 2. BLOK 2: KEY LANGUAGE & CORRECTIONS (Emerald Accordion / Badge) */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('block2')}
          className="p-3.5 bg-gradient-to-r from-emerald-900/40 via-emerald-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-emerald-900/50 transition-colors select-none border-b border-emerald-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  BLOK 2
                </span>
                <h4 className="font-extrabold text-sm text-white">Key Language & Corrections</h4>
                <span className="text-[11px] text-emerald-400/80 font-bold">
                  ({parsedVocabList.length} słówek{blocks.corrections ? ' + korekty' : ''})
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/70">Kluczowe słownictwo, gramatyka i korekta błędów</p>
            </div>
          </div>
          <div className="text-emerald-300">
            {expandedSections.block2 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.block2 && (
          <div className="p-4 bg-emerald-950/10 space-y-4">
            {/* Pod-obszar 2a: Słownictwo i Wymowa */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                <span>📚 Nowe słownictwo & zwroty:</span>
              </div>
              {parsedVocabList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {parsedVocabList.map(v => (
                    <div 
                      key={v.id}
                      className="p-2.5 rounded-xl bg-base-300/70 border border-emerald-500/20 flex items-center justify-between gap-2 hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs">{v.term}</div>
                        {v.def && <div className="text-[11px] text-emerald-200/80 truncate">{v.def}</div>}
                      </div>
                      <TTSButtons text={v.term} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-content-muted italic">Brak słownictwa przypisanego do tej lekcji.</p>
              )}
            </div>

            {/* Pod-obszar 2b: Korekty językowe i błędy */}
            {blocks.corrections && (
              <div className="pt-3 border-t border-emerald-500/15">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span>Korekty językowe & Wymowa (Corrections):</span>
                </div>
                <div className="p-3.5 rounded-xl bg-base-300/60 border border-emerald-500/20 text-xs text-content leading-relaxed whitespace-pre-wrap">
                  <Markdown>{blocks.corrections}</Markdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. BLOK 3: HOMEWORK — CRIBRO HABIT (Amber/Brown Accordion / Badge) */}
      <div className="rounded-2xl border border-amber-500/25 bg-amber-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('block3')}
          className="p-3.5 bg-gradient-to-r from-amber-900/40 via-amber-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-900/50 transition-colors select-none border-b border-amber-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <ListChecks size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  BLOK 3
                </span>
                <h4 className="font-extrabold text-sm text-white">Homework — Cribro Habit</h4>
              </div>
              <p className="text-[11px] text-amber-200/70">Zadania domowe z lekcji, zdania do tłumaczenia i klucz odpowiedzi</p>
            </div>
          </div>
          <div className="text-amber-300">
            {expandedSections.block3 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.block3 && (
          <div className="p-4 bg-amber-950/10 space-y-3.5">
            {blocks.homework ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-base-300/80 border border-amber-500/20 space-y-2">
                  <div className="text-xs font-bold text-amber-300 flex items-center justify-between gap-2">
                    <span>Zdania do przetłumaczenia / Zadanie:</span>
                    {onGenerateHomework && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateHomework();
                        }}
                        className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles size={12} /> Przekształć w zadanie Cribro
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-content whitespace-pre-wrap leading-relaxed space-y-1">
                    <Markdown>{blocks.homework}</Markdown>
                  </div>
                </div>

                {/* Answer key w zwijanym akordeonie, by nie zdradzać odpowiedzi */}
                {blocks.answerKey && (
                  <div className="rounded-xl border border-white/10 bg-base-300/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setIsAnswerKeyOpen(v => !v)}
                      className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-content-muted hover:text-white transition-colors cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={13} className="text-amber-400" />
                        Klucz odpowiedzi (Answer Key)
                      </span>
                      <span>{isAnswerKeyOpen ? 'Ukryj odpowiedzi ▲' : 'Pokaż odpowiedzi ▼'}</span>
                    </button>
                    {isAnswerKeyOpen && (
                      <div className="p-3 border-t border-white/5 bg-base-200/50 text-xs text-content leading-relaxed whitespace-pre-wrap">
                        <Markdown>{blocks.answerKey}</Markdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-base-300/40 border border-white/5 text-center text-xs text-content-muted">
                Brak zadań domowych przypisanych bezpośrednio w notatkach lekcji.
                {onGenerateHomework && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={onGenerateHomework}
                      className="text-xs font-bold mx-auto flex items-center gap-1.5"
                    >
                      <Sparkles size={13} /> Wygeneruj zadanie domowe AI z tej lekcji
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. BLOK 4: NEXT LESSON (Olive/Yellow Accordion / Badge) */}
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('block4')}
          className="p-3.5 bg-gradient-to-r from-yellow-900/40 via-yellow-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-yellow-900/50 transition-colors select-none border-b border-yellow-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center justify-center shrink-0">
              <Target size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  BLOK 4
                </span>
                <h4 className="font-extrabold text-sm text-white">Next Lesson</h4>
              </div>
              <p className="text-[11px] text-yellow-200/70">Plany, tematyka i cele na kolejne spotkanie</p>
            </div>
          </div>
          <div className="text-yellow-300">
            {expandedSections.block4 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.block4 && (
          <div className="p-4 bg-yellow-950/10">
            {blocks.nextLesson ? (
              <div className="text-xs text-content whitespace-pre-wrap leading-relaxed">
                <Markdown>{blocks.nextLesson}</Markdown>
              </div>
            ) : (
              <p className="text-xs text-content-muted italic">Brak zdefiniowanych planów na kolejną lekcję.</p>
            )}
          </div>
        )}
      </div>

      {/* 5. LEARNING CURVE / UWAGI O KURŚCIE (Purple Accordion / Badge) */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-950/15 overflow-hidden shadow-sm transition-all">
        <div 
          onClick={() => toggleSection('learningCurve')}
          className="p-3.5 bg-gradient-to-r from-purple-900/40 via-purple-950/30 to-transparent flex items-center justify-between gap-3 cursor-pointer hover:bg-purple-900/50 transition-colors select-none border-b border-purple-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Activity size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  LEARNING CURVE
                </span>
                <h4 className="font-extrabold text-sm text-white">Wypowiedzi i dynamika kursanta</h4>
              </div>
              <p className="text-[11px] text-purple-200/70">O czym mówił kursant, obserwacje dotyczące płynności i postępów</p>
            </div>
          </div>
          <div className="text-purple-300">
            {expandedSections.learningCurve ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expandedSections.learningCurve && (
          <div className="p-4 bg-purple-950/10">
            {blocks.learningCurve ? (
              <div className="text-xs text-content whitespace-pre-wrap leading-relaxed">
                <Markdown>{blocks.learningCurve}</Markdown>
              </div>
            ) : (
              <p className="text-xs text-content-muted italic">Brak szczegółowych uwag o wypowiedziach kursanta z tej lekcji.</p>
            )}
          </div>
        )}
      </div>

      {/* Full Preview Modal for linked scenario */}
      <ScenarioPreviewModal
        scenario={selectedScenarioForPreview}
        isOpen={Boolean(selectedScenarioForPreview)}
        onClose={() => setSelectedScenarioForPreview(null)}
      />
    </div>
  );
};
