/**
 * PermitAIO — All in One Permitting mark: a central "Job #" hub connected
 * to three nodes, representing the three tools (floor plans, permit
 * inventory, HOA tracking) unified under one Job number.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="PermitAIO — All in One Permitting"
      role="img"
    >
      <line x1="16" y1="16" x2="16" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="16" x2="25.5" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="16" x2="6.5" y2="21.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="5" r="3.25" fill="currentColor" />
      <circle cx="25.5" cy="21.5" r="3.25" fill="currentColor" />
      <circle cx="6.5" cy="21.5" r="3.25" fill="currentColor" />
      <rect x="11.5" y="11.5" width="9" height="9" rx="2.25" fill="currentColor" />
    </svg>
  );
}
