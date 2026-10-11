import { jsx as _jsx } from "react/jsx-runtime";
export const SkeletonLoader = ({ width, height, className = '', style, ...props }) => {
    const resolveDimension = (val) => {
        if (val === undefined)
            return undefined;
        return typeof val === 'number' ? `${val}px` : val;
    };
    return (_jsx("div", { className: `animate-pulse bg-[var(--color-fintech-border)] rounded-md ${className}`, style: {
            width: resolveDimension(width) ?? '100%',
            height: resolveDimension(height) ?? '100%',
            ...style,
        }, ...props }));
};
