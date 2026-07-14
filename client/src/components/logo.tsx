// Inline SVG version of the Achieve RFP mark.
// Rounded square with a stylized "A" — single color, transparent background,
// scales cleanly to any size.

interface LogoProps {
  size?: number;
  className?: string;
  /** True = filled rounded square (navy bg, white "A"). False = outline only. */
  filled?: boolean;
}

export function Logo({ size = 32, className = "", filled = true }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Achieve RFP Intelligence"
    >
      {filled ? (
        <>
          <rect width="64" height="64" rx="14" fill="currentColor" />
          {/* "A" mark */}
          <path
            d="M18 47L29 18H35L46 47M23 35H41"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <rect
            x="2"
            y="2"
            width="60"
            height="60"
            rx="13"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M18 47L29 18H35L46 47M23 35H41"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}

/** Logo + Achieve RFP wordmark together, useful for nav/header/auth screens. */
export function LogoWithWordmark({
  size = 36,
  textClassName = "",
  className = "",
}: {
  size?: number;
  textClassName?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={size} className="text-primary" />
      <span
        className={`font-bold tracking-tight text-foreground ${textClassName || "text-xl"}`}
      >
        Achieve RFP
      </span>
    </div>
  );
}
