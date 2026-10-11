import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useId } from 'react';
export const InteractiveChart = ({ points, height = 280 }) => {
    const [activePoint, setActivePoint] = useState(null);
    const rawId = useId();
    const filterId = rawId.replace(/:/g, '');
    if (!points || points.length === 0) {
        return (_jsx("div", { style: { height }, className: "flex items-center justify-center border border-[var(--color-fintech-border)] rounded-lg", children: _jsx("span", { className: "text-sm font-mono text-[var(--color-fintech-text-muted)]", children: "No data points available" }) }));
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
    const handleTouchOrMove = (clientX, rect) => {
        const relativeX = clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, relativeX / rect.width));
        const targetIdx = Math.round(ratio * (points.length - 1));
        setActivePoint(points[targetIdx]);
    };
    return (_jsxs("div", { className: "flex flex-col gap-2 w-full select-none", children: [_jsxs("div", { className: "flex justify-between items-center min-h-[32px] px-1", children: [_jsxs("div", { className: "flex items-center gap-2 font-mono text-xs", children: [_jsx("span", { className: "text-[var(--color-fintech-text-muted)]", children: "Selected:" }), _jsx("span", { className: "text-[var(--color-emerald-accent)] font-semibold", children: activePoint ? activePoint.rate.toFixed(4) : points[points.length - 1].rate.toFixed(4) })] }), _jsx("div", { className: "font-mono text-xs text-[var(--color-fintech-text-secondary)]", children: activePoint ? activePoint.date : points[points.length - 1].date })] }), _jsx("div", { className: "relative w-full overflow-hidden touch-none", onTouchMove: (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleTouchOrMove(e.touches[0].clientX, rect);
                }, 
                // Touch-end intentionally resets to latest point, not the last scrubbed position
                onTouchEnd: () => setActivePoint(null), onMouseMove: (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleTouchOrMove(e.clientX, rect);
                }, onMouseLeave: () => setActivePoint(null), children: _jsxs("svg", { viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`, className: "w-full overflow-visible", style: { height: 'auto', maxHeight: height }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: `gradient-${filterId}`, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "var(--color-emerald-primary)", stopOpacity: "0.28" }), _jsx("stop", { offset: "100%", stopColor: "var(--color-emerald-primary)", stopOpacity: "0.0" })] }) }), _jsx("path", { d: areaPath, fill: `url(#gradient-${filterId})` }), _jsx("polyline", { fill: "none", stroke: "var(--color-emerald-accent)", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", points: polylinePoints }), activePoint && ((() => {
                            const activeCoord = coordinates.find((c) => c.point.date === activePoint.date);
                            if (!activeCoord)
                                return null;
                            return (_jsxs("g", { children: [_jsx("line", { x1: activeCoord.x, y1: 0, x2: activeCoord.x, y2: viewBoxHeight, stroke: "var(--color-fintech-border-bright)", strokeWidth: "1.5", strokeDasharray: "4 4" }), _jsx("circle", { cx: activeCoord.x, cy: activeCoord.y, r: "5", fill: "var(--color-fintech-base)", stroke: "var(--color-emerald-accent)", strokeWidth: "2.5" })] }));
                        })())] }) })] }));
};
