import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  UploadCloud, FileText, Image as ImageIcon, FileCode, 
  Trash2, X, AlertCircle, CheckCircle2, Paperclip, Eye,
  Volume2, Music
} from 'lucide-react';
import { LessonAttachment } from '../../types';

interface LessonFileUploaderProps {
  attachments: LessonAttachment[];
  onAttachmentsChange: (attachments: LessonAttachment[]) => void;
  maxFiles?: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file

export const LessonFileUploader: React.FC<LessonFileUploaderProps> = ({
  attachments,
  onAttachmentsChange,
  maxFiles = 6
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = useCallback(async (file: File): Promise<LessonAttachment | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let detectedType: LessonAttachment['type'] = 'text';

    if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      detectedType = 'image';
    } else if (file.type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'].includes(ext)) {
      detectedType = 'audio';
    } else if (file.type === 'application/pdf' || ext === 'pdf') {
      detectedType = 'pdf';
    } else if (ext === 'md' || ext === 'markdown') {
      detectedType = 'markdown';
    } else if (ext === 'html' || ext === 'htm') {
      detectedType = 'html';
    } else {
      detectedType = 'text';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`Plik "${file.name}" przekracza maksymalny limit 10 MB.`);
      return null;
    }

    try {
      if (detectedType === 'image') {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        return {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name || `screenshot-${new Date().toLocaleTimeString().replace(/:/g, '-')}.png`,
          type: 'image',
          size: file.size,
          mimeType: file.type || 'image/png',
          dataUrl
        };
      } else if (detectedType === 'audio') {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        return {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          type: 'audio',
          size: file.size,
          mimeType: file.type || 'audio/mpeg',
          dataUrl
        };
      } else if (detectedType === 'pdf') {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        return {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          type: 'pdf',
          size: file.size,
          mimeType: 'application/pdf',
          dataUrl
        };
      } else {
        // Text / Markdown / HTML
        const textContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });

        return {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          type: detectedType,
          size: file.size,
          mimeType: file.type || 'text/plain',
          textContent
        };
      }
    } catch (err: any) {
      console.error('Błąd czytania pliku:', err);
      setErrorMessage(`Nie udało się odczytać pliku "${file.name}".`);
      return null;
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setErrorMessage(null);
    const fileArray = Array.from(files);

    if (attachments.length + fileArray.length > maxFiles) {
      setErrorMessage(`Możesz dodać maksymalnie ${maxFiles} plików.`);
      return;
    }

    const processedList: LessonAttachment[] = [];
    for (const file of fileArray) {
      const att = await processFile(file);
      if (att) {
        processedList.push(att);
      }
    }

    if (processedList.length > 0) {
      onAttachmentsChange([...attachments, ...processedList]);
    }
  }, [attachments, maxFiles, onAttachmentsChange, processFile]);

  // Handle Clipboard Paste (e.g. Cmd+V screenshot from OS)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const filesToProcess: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            filesToProcess.push(file);
          }
        }
      }

      if (filesToProcess.length > 0) {
        handleFiles(filesToProcess);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-3">
      {/* Dropzone Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all cursor-pointer group ${
          isDragging 
            ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(114,240,180,0.25)]' 
            : 'border-white/15 hover:border-primary/50 bg-base-200/40 hover:bg-base-200/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,.mp3,.wav,.m4a,.ogg,.pdf,.txt,.md,.markdown,.html,.htm"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
            isDragging ? 'bg-primary text-accent-ink' : 'bg-primary/15 text-primary border border-primary/20'
          }`}>
            <UploadCloud size={20} />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-extrabold text-white">
              <span className="text-primary group-hover:underline">Kliknij lub przeciągnij materiały</span> do analizy lekcji
            </p>
            <p className="text-[11px] text-content-muted">
              Strony podręczników, screenshoty (<kbd className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono border border-white/10 text-primary">Ctrl+V</kbd>), nagrania audio, PDF, Markdown i notatki
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-content-muted">
              PNG / JPG (skany/screenshoty)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono text-purple-300">
              MP3 / AUDIO
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-content-muted">
              PDF
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-content-muted">
              Markdown (.md)
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-content-muted">
              HTML / TXT
            </span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs animate-shake">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMessage}</span>
          <button 
            type="button" 
            onClick={() => setErrorMessage(null)} 
            className="ml-auto text-danger/80 hover:text-danger cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Attached Files List */}
      {attachments.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-content-muted">
            <span className="flex items-center gap-1">
              <Paperclip size={12} className="text-primary" />
              Dołączone materiały do analizy AI ({attachments.length}/{maxFiles}):
            </span>
            <button
              type="button"
              onClick={() => onAttachmentsChange([])}
              className="text-red-400 hover:text-red-300 transition-colors text-[10px] cursor-pointer"
            >
              Usuń wszystkie
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="p-2.5 rounded-xl bg-base-200/80 border border-white/10 hover:border-primary/40 flex items-center gap-2.5 group transition-all relative overflow-hidden"
              >
                {/* Thumbnail / Icon */}
                {att.type === 'image' && att.dataUrl ? (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage(att.dataUrl || null);
                    }}
                    className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/15 bg-black/40 relative cursor-pointer group/thumb"
                    title="Kliknij, aby powiększyć podgląd"
                  >
                    <img 
                      src={att.dataUrl} 
                      alt={att.name} 
                      className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <Eye size={12} />
                    </div>
                  </div>
                ) : att.type === 'audio' ? (
                  <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center bg-purple-500/15 border border-purple-500/30 text-purple-300">
                    <Volume2 size={18} />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center bg-base-100 border border-white/10 text-primary">
                    {att.type === 'pdf' ? (
                      <span className="text-[10px] font-black text-rose-400 font-mono">PDF</span>
                    ) : att.type === 'markdown' ? (
                      <span className="text-[10px] font-black text-sky-400 font-mono">MD</span>
                    ) : att.type === 'html' ? (
                      <span className="text-[10px] font-black text-amber-400 font-mono">HTML</span>
                    ) : (
                      <FileText size={18} className="text-primary" />
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate" title={att.name}>
                    {att.name}
                  </p>
                  <p className="text-[10px] font-mono text-content-muted flex items-center gap-1.5">
                    <span>{formatFileSize(att.size)}</span>
                    <span>•</span>
                    <span className={`uppercase font-semibold ${att.type === 'audio' ? 'text-purple-400' : 'text-primary'}`}>{att.type}</span>
                  </p>
                  {att.type === 'audio' && att.dataUrl && (
                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <audio controls src={att.dataUrl} className="h-6 w-full max-w-[170px]" preload="metadata" />
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={(e) => handleRemoveAttachment(att.id, e)}
                  className="p-1.5 rounded-lg text-content-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                  title="Usuń ten plik"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-base-100 border border-white/20 rounded-2xl overflow-hidden shadow-2xl p-2">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-black/90 transition-colors z-10 cursor-pointer"
            >
              <X size={18} />
            </button>
            <img 
              src={previewImage} 
              alt="Podgląd screenshotu" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonFileUploader;
