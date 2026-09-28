import type { SVGProps } from 'react';

export function MalaIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 24.2v3.3m0 0-2 2m2-2 2 2" strokeLinecap="round" />
      {Array.from({ length: 13 }, (_, i) => {
        const a = (i / 13) * Math.PI * 2;
        return (
          <circle
            key={i}
            cx={16 + Math.sin(a) * 9}
            cy={13 + Math.cos(a) * 10}
            r={2}
            fill="currentColor"
            stroke="none"
          />
        );
      })}
      <circle cx="16" cy="25" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
