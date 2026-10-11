import React, { useCallback, useEffect, useState } from 'react';

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
    title: 'USD Base Anchor Engine',
    body: 'All supported currencies are anchored to USD tick data cached at the edge. Cross-rates such as EUR to JPY are resolved in a single triangular pass through the anchor, delivering sub-millisecond conversions without extra upstream calls.',
  },
  {
    title: 'Live Currency Converter',
    body: 'Enter any transfer amount and the engine recalculates after a 300ms debounce, cancelling stale in-flight requests automatically. Use the swap button between the two selectors to reverse the conversion direction instantly.',
  },
  {
    title: 'Historical Trends and Scrubbing',
    body: 'Switch between 7D, 30D, 90D, and 1Y timeframes to inspect daily close trajectories. Drag or move your pointer across the chart to scrub individual data points and read the exact rate and date in the header above the trendline.',
  },
  {
    title: 'System Status Indicators',
    body: 'Live Edge Cache means rates are served from the 120-second Redis cache. Syncing indicates a fresh upstream fetch is in flight. Degraded means the upstream authority is unreachable; retry manually once connectivity is restored.',
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

  if (!open) return null;

  const step = GUIDE_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === GUIDE_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Platform Guide"
      onClick={onClose}
    >
      <div
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
