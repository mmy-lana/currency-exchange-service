import { jsx as _jsx } from "react/jsx-runtime";
export const Card = ({ children, glow = false, className = '', ...props }) => {
    return (_jsx("div", { className: `bg-[var(--color-fintech-card)] border border-[var(--color-fintech-border)] rounded-xl p-4 sm:p-6 transition-all duration-200 ${glow ? 'border-[var(--color-emerald-primary)] shadow-[0_0_20px_var(--color-emerald-glow)]' : ''} ${className}`, ...props, children: children }));
};
