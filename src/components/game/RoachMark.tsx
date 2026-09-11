export function RoachMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="32" cy="38" rx="11" ry="16" />
        <ellipse cx="32" cy="22" rx="8" ry="7" />
        <circle cx="32" cy="13" r="4.2" />
        <path d="M29 10 C 22 2, 16 4, 14 8" />
        <path d="M35 10 C 42 2, 48 4, 50 8" />
        <path d="M24 20 L 10 14" />
        <path d="M40 20 L 54 14" />
        <path d="M22 30 L 8 30" />
        <path d="M42 30 L 56 30" />
        <path d="M24 44 L 10 52" />
        <path d="M40 44 L 54 52" />
        <path d="M32 22 V 52" opacity="0.45" />
      </g>
    </svg>
  );
}
