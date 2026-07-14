type LogoProps = { className?: string };

export function Logo({ className = "h-6 w-6" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="7RFP logo"
    >
      {/* Document outline with folded corner */}
      <path
        d="M5 3H14L19 8V20C19 20.5523 18.5523 21 18 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 3V8H19"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Checkmark inside document */}
      <path
        d="M7.5 13.5L10.25 16L15.5 10.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="wordmark">
      <Logo className="h-6 w-6 text-primary" />
      <span className="font-semibold text-base tracking-tight">7RFP</span>
    </div>
  );
}
