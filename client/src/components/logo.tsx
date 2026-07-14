// iT1 Nucleos brand lockups for the Achieve RFP product.
// - Logo: compact square "A" mark (Achieve family). Brand navy via `currentColor`.
// - LogoWithWordmark: the official NUCLEOS wordmark + "Achieve RFP" product label.

import nucleosWordmark from "@/assets/nucleos-logo.png";
import nucleosWordmarkWhite from "@/assets/nucleos-logo-white.png";

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
      aria-label="Achieve RFP"
    >
      {filled ? (
        <>
          <rect width="64" height="64" rx="14" fill="currentColor" />
          {/* teal node echoes the Nucleos wordmark */}
          <circle cx="49" cy="17" r="4.5" fill="hsl(var(--teal))" />
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

/**
 * Primary brand lockup: the official Nucleos wordmark paired with the
 * "Achieve RFP" product label. Use on nav bars, headers, and auth screens.
 */
export function LogoWithWordmark({
  size = 36,
  textClassName = "",
  className = "",
  product = "Achieve RFP",
  variant = "dark",
}: {
  size?: number;
  textClassName?: string;
  className?: string;
  /** Product label shown next to the Nucleos wordmark. Pass null to hide it. */
  product?: string | null;
  /** "dark" = navy wordmark for light backgrounds; "light" = white wordmark for dark. */
  variant?: "dark" | "light";
}) {
  const src = variant === "light" ? nucleosWordmarkWhite : nucleosWordmark;
  // The Nucleos wordmark is wide; scale its height from the legacy square `size`.
  const height = Math.max(16, Math.round(size * 0.58));
  const hideProduct = product == null || textClassName.includes("hidden");
  return (
    <div className={`flex items-center gap-2.5 ${className}`} data-testid="brand-lockup">
      <img
        src={src}
        alt="Nucleos"
        style={{ height }}
        className="w-auto object-contain"
        data-testid="img-nucleos-logo"
      />
      {!hideProduct ? (
        <>
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <span
            className={`font-semibold tracking-tight text-foreground ${textClassName || "text-base"}`}
          >
            {product}
          </span>
        </>
      ) : null}
    </div>
  );
}
