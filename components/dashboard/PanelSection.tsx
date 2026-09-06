import React, { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Zwijana sekcja panelu kursanta.
 *
 * Panel ma się mieścić na jednym ekranie telefonu, więc wszystko poza tym, co
 * czeka na dziś, jest domyślnie zamknięte: kursant widzi spis rzeczy, które
 * może otworzyć, a nie ich zawartość naraz. Jeden wzór nagłówka dla wszystkich
 * sekcji, żeby dotknięcie w każdym miejscu znaczyło to samo.
 */

interface PanelSectionProps {
  title: string;
  /** Licznik albo data po prawej — krótko, monospace. */
  meta?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

const PanelSection: React.FC<PanelSectionProps> = ({
  title,
  meta,
  icon,
  defaultOpen = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-white/10 bg-base-200/40 overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full min-h-[3.5rem] flex items-center gap-3 px-4 sm:px-5 py-3 text-left active:bg-white/[0.04] transition-colors"
      >
        {icon && (
          <span className={`shrink-0 ${isOpen ? 'text-primary' : 'text-content-muted'}`}>
            {icon}
          </span>
        )}
        <span
          className={`font-bold text-[15px] ${isOpen ? 'text-primary' : 'text-content'}`}
        >
          {title}
        </span>
        {meta && (
          <span className="ml-auto text-[12px] font-mono text-content-muted shrink-0">
            {meta}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-content-muted shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          } ${meta ? '' : 'ml-auto'}`}
        />
      </button>

      {isOpen && <div className="border-t border-white/[0.06]">{children}</div>}
    </section>
  );
};

export default PanelSection;
