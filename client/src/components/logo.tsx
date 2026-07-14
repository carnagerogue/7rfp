// Inline SVG version of the 7RFP mark.
// Rounded square with a stylized "7" — single color, transparent background,
// scales cleanly to any size.

interface LogoProps {
  size?: number;
  className?: string;
  /** True = filled rounded square (navy bg, white "7"). False = outline only. */
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
      aria-label="7RFP"
    >
      {filled ? (
        <>
          <rect width="64" height="64" rx="14" fill="currentColor" />
          {/* "7" mark */}
          <path
            d="M20 18 H46 L30 48"
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
            d="M20 18 H46 L30 48"
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

/** Logo + "7RFP" wordmark together, useful for nav/header/auth screens. */
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
        RFP
      </span>
    </div>
  );
}
