import { jsx as _jsx } from "react/jsx-runtime";
export const Sparkline = ({ data, width = 120, height = 40, color = 'var(--color-emerald-accent)', className = '', }) => {
    if (!data.length)
        return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min === 0 ? 1 : max - min;
    const padding = 2;
    const points = data
        .map((val, idx) => {
        const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
        .join(' ');
    return (_jsx("svg", { width: width, height: height, className: `overflow-visible ${className}`, viewBox: `0 0 ${width} ${height}`, children: _jsx("polyline", { fill: "none", stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", points: points }) }));
};
