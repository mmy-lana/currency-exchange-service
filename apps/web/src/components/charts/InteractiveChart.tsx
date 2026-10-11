import React, { useState, useId } from 'react';
import { HistoricalRatePoint } from '@currency-exchange/shared-types';

export interface InteractiveChartProps {
  points: HistoricalRatePoint[];
  height?: number;
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({ points, height = 280 }) => {
  const [activePoint, setActivePoint] = useState<HistoricalRatePoint | null>(null);
  const rawId = useId();
  const filterId = rawId.replace(/:/g, '');

  if (!points || points.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center border border-[var(--color-fintech-border)] rounded-lg">
        <span className="text-sm font-mono text-[var(--color-fintech-text-muted)]">No data points available</span>
      </div>
    );
  }

  const rates = points.map((p) => p.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const range = max - min === 0 ? 1 : max - min;
  const paddingX = 16;
  const paddingY = 24;
  const viewBoxWidth = 600;
  const viewBoxHeight = height;

  const coordinates = points.map((p, idx) => {
    const x = (idx / (points.length - 1)) * (viewBoxWidth - paddingX * 2) + paddingX;
    const y = viewBoxHeight - paddingY - ((p.rate - min) / range) * (viewBoxHeight - paddingY * 2);
    return { x, y, point: p };
  });

  const polylinePoints = coordinates.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  const areaPath = `M ${coordinates[0].x.toFixed(1)},${viewBoxHeight.toFixed(1)} ` +
    coordinates.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
    ` L ${coordinates[coordinates.length - 1].x.toFixed(1)},${viewBoxHeight.toFixed(1)} Z`;

  const handleTouchOrMove = (clientX: number, rect: DOMRect) => {
    const relativeX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, relativeX / rect.width));
    const targetIdx = Math.round(ratio * (points.length - 1));
    setActivePoint(points[targetIdx]);
  };

  return (
    <div className="flex flex-col gap-2 w-full select-none">
      <div className="flex justify-between items-center min-h-[32px] px-1">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[var(--color-fintech-text-muted)]">Selected:</span>
          <span className="text-[var(--color-emerald-accent)] font-semibold">
            {activePoint ? activePoint.rate.toFixed(4) : points[points.length - 1].rate.toFixed(4)}
          </span>
        </div>
        <div className="font-mono text-xs text-[var(--color-fintech-text-secondary)]">
          {activePoint ? activePoint.date : points[points.length - 1].date}
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden touch-pan-y"
        onTouchMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          handleTouchOrMove(e.touches[0].clientX, rect);
        }}
        // Touch-end intentionally resets to latest point, not the last scrubbed position
        onTouchEnd={() => setActivePoint(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          handleTouchOrMove(e.clientX, rect);
        }}
        onMouseLeave={() => setActivePoint(null)}
      >
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full overflow-visible"
          style={{ height: 'auto', maxHeight: height }}
        >
          <defs>
            <linearGradient id={`gradient-${filterId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-emerald-primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-emerald-primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill={`url(#gradient-${filterId})`} />

          <polyline
            fill="none"
            stroke="var(--color-emerald-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {activePoint && (
            (() => {
              const activeCoord = coordinates.find((c) => c.point.date === activePoint.date);
              if (!activeCoord) return null;
              return (
                <g>
                  <line
                    x1={activeCoord.x}
                    y1={0}
                    x2={activeCoord.x}
                    y2={viewBoxHeight}
                    stroke="var(--color-fintech-border-bright)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={activeCoord.x}
                    cy={activeCoord.y}
                    r="5"
                    fill="var(--color-fintech-base)"
                    stroke="var(--color-emerald-accent)"
                    strokeWidth="2.5"
                  />
                </g>
              );
            })()
          )}
        </svg>
      </div>
    </div>
  );
};
