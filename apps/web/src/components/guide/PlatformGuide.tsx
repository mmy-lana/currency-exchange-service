import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface PlatformGuideProps {
  open: boolean;
  onClose: () => void;
}

interface GuideStep {
  title: string;
  body: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    title: 'System Architecture & USD Anchor',
    body: 'The US Dollar acts as the central base currency for all 11 supported fiat currencies. Every cross-rate, such as EUR to JPY, is resolved through the USD anchor in a single triangular pass, so conversions complete in sub-millisecond time without chaining multiple vendor calls.',
  },
  {
    title: 'Conversion Engine & Debounce',
    body: 'Amount input is debounced for 300ms before a conversion request is issued, and any in-flight request is cancelled the moment you keep typing. Press Alt+S anywhere to instantly swap the From and To currencies, and use the copy button to capture the converted result.',
  },
  {
    title: 'Historical Analytics & Touch Scrubbing',
    body: 'Select the 7D, 30D, 90D, or 1Y timeframe to inspect daily close trajectories. Drag or move your pointer across the chart canvas to scrub individual data points; the chart uses touch-pan-y so vertical page scrolling is never trapped. High, average, and low statistics sit above the trendline.',
  },
  {
    title: 'Financial Precision & Security',
    body: 'Rates are computed with exact decimal semantics and string-quantized before transport, eliminating IEEE-754 floating-point drift entirely. Token-bucket rate limiting protects shared capacity so the service stays available and responsive for every client.',
  },
];

export const PlatformGuide: React.FC<PlatformGuideProps> = ({ open, onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight') {
        setStepIndex((idx) => Math.min(idx + 1, GUIDE_STEPS.length - 1));
      } else if (event.key === 'ArrowLeft') {
        setStepIndex((idx) => Math.max(idx - 1, 0));
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Focus trapping: Tab cycles inside the dialog while it is open so keyboard
  // users cannot scroll into the obscured dashboard behind the backdrop.
  const handleTrapKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [open, stepIndex]);

  if (!open) return null;

  const step = GUIDE_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === GUIDE_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Platform Guide"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onKeyDown={handleTrapKeyDown}
        className="w-full max-w-md bg-[var(--color-fintech-card)] border border-[var(--color-fintech-border-bright)] rounded-xl shadow-[0_0_40px_var(--color-emerald-glow)] p-5 sm:p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-fintech-text-muted)]">
            Step {stepIndex + 1} of {GUIDE_STEPS.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-lg text-[var(--color-fintech-text-secondary)] hover:text-[var(--color-fintech-text-primary)] hover:bg-[var(--color-fintech-card-hover)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1.5" aria-hidden="true">
          {GUIDE_STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= stepIndex ? 'bg-[var(--color-emerald-primary)]' : 'bg-[var(--color-fintech-border)]'
              }`}
            />
          ))}
        </div>

        <h2 className="text-lg font-semibold text-[var(--color-fintech-text-primary)]">{step.title}</h2>
        <p className="text-sm leading-relaxed text-[var(--color-fintech-text-secondary)]">{step.body}</p>

        <div className="flex items-center justify-between gap-2 mt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] px-4 text-sm font-mono text-[var(--color-fintech-text-secondary)] hover:text-[var(--color-fintech-text-primary)] rounded-lg transition-colors"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((idx) => Math.max(idx - 1, 0))}
              disabled={isFirst}
              className="min-h-[48px] px-4 text-sm font-mono rounded-lg border border-[var(--color-fintech-border)] text-[var(--color-fintech-text-secondary)] hover:text-[var(--color-fintech-text-primary)] hover:bg-[var(--color-fintech-card-hover)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Previous
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                data-testid="guide-finish"
                className="min-h-[48px] px-5 text-sm font-semibold rounded-lg bg-[var(--color-emerald-primary)] text-black hover:bg-[var(--color-emerald-accent)] transition-colors"
              >
                Get Started
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((idx) => Math.min(idx + 1, GUIDE_STEPS.length - 1))}
                className="min-h-[48px] px-5 text-sm font-semibold rounded-lg bg-[var(--color-emerald-primary)] text-black hover:bg-[var(--color-emerald-accent)] transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const GUIDE_SEEN_KEY = 'fintech-fx:platform-guide-seen';

export function hasSeenPlatformGuide(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markPlatformGuideSeen(): void {
  try {
    window.localStorage.setItem(GUIDE_SEEN_KEY, '1');
  } catch {
    // Storage unavailable (private mode): guide will simply reappear next visit.
  }
}
