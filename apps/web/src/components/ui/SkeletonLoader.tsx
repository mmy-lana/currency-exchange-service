import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const resolveDimension = (val?: string | number): string | undefined => {
    if (val === undefined) return undefined;
    return typeof val === 'number' ? `${val}px` : val;
  };

  return (
    <div
      className={`animate-pulse bg-[var(--color-fintech-border)] rounded-md ${className}`}
      style={{
        width: resolveDimension(width) ?? '100%',
        height: resolveDimension(height) ?? '100%',
        ...style,
      }}
      {...props}
    />
  );
};
