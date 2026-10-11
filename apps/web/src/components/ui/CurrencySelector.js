import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SUPPORTED_CURRENCIES } from '@currency-exchange/shared-types';
export const CurrencySelector = ({ id, label, value, options, metadata, onChange, className = '', }) => {
    return (_jsxs("div", { className: `flex flex-col gap-1.5 w-full ${className}`, children: [_jsx("label", { htmlFor: id, className: "text-xs font-mono tracking-wider text-[var(--color-fintech-text-secondary)] uppercase", children: label }), _jsxs("div", { className: "relative", children: [_jsx("select", { id: id, value: value, onChange: (e) => {
                            const rawVal = e.target.value;
                            if (SUPPORTED_CURRENCIES.includes(rawVal)) {
                                onChange(rawVal);
                            }
                        }, className: "w-full min-h-[48px] px-4 py-2 appearance-none bg-[var(--color-fintech-surface)] border border-[var(--color-fintech-border)] rounded-lg text-base font-mono text-[var(--color-fintech-text-primary)] focus:outline-none focus:border-[var(--color-emerald-primary)] focus:ring-1 focus:ring-[var(--color-emerald-primary)] cursor-pointer pr-10", children: options.map((currency) => {
                            const meta = metadata?.[currency];
                            const labelText = meta ? `${currency} - ${meta.symbol} (${meta.name})` : currency;
                            return (_jsx("option", { value: currency, className: "bg-[var(--color-fintech-card)] text-[var(--color-fintech-text-primary)]", children: labelText }, currency));
                        }) }), _jsx("div", { className: "absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-fintech-text-secondary)]", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 9l-7 7-7-7" }) }) })] })] }));
};
