// Auth-screen brand lockup. Wraps the shared Nucleos wordmark so the
// company identity stays consistent everywhere it appears.
import { Logo, LogoWithWordmark } from "@/components/logo";

export { Logo };

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <LogoWithWordmark size={30} textClassName="text-base" className={className} />
  );
}
