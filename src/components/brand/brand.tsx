import Image from "next/image";
import { cn } from "cn";

const FALLBACK_LOGO = "/assets/logo-mark.png";

/** Shop logo, or the default Cafe'nMe mark when the shop has none. */
export function BrandLogo({ logoUrl, size, className, alt = "" }: { logoUrl: string | null; size: number; className?: string; alt?: string }) {
  return <Image src={logoUrl ?? FALLBACK_LOGO} alt={alt} width={size} height={size} unoptimized={Boolean(logoUrl)}
    className={cn("shrink-0 object-contain", className)} style={{ width: size, height: size }} />;
}

/**
 * One stamp slot. Without a shop logo it uses the stock stamp art; with one it looks like an
 * ink stamp of the logo in the brand colour. Needs --brand set on an ancestor (see brandVars).
 */
export function BrandStamp({ filled, logoUrl, size, className, alt = "" }: { filled: boolean; logoUrl: string | null; size: number; className?: string; alt?: string }) {
  if (!logoUrl) {
    return <Image src={filled ? "/assets/stamp-filled.png" : "/assets/stamp-empty.png"} alt={alt} width={size} height={size}
      className={cn("object-contain", className)} style={{ width: size, height: size }} />;
  }
  return <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
    className={cn("inline-flex shrink-0 items-center justify-center rounded-full", className)}
    style={filled
      ? { width: size, height: size, border: "2px solid var(--brand, #B4441C)", background: "#FFFFFF", transform: "rotate(-8deg)" }
      : { width: size, height: size, border: "2px dashed #D9C5B0" }}>
    {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative logo, already cache-busted */}
    {filled ? <img src={logoUrl} alt="" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} className="object-contain" /> : null}
  </span>;
}
