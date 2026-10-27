import Image from "next/image";
import Link from "next/link";

// The condensed wordmark is live text so it stays sharp and searchable; the mascot image is unchanged.
export function Wordmark({ className = "", tone = "espresso" }: { className?: string; tone?: "espresso" | "cream" }) {
  return (
    <span className={`font-display-condensed whitespace-nowrap font-black leading-none tracking-tight [--display-wdth:70] ${tone === "cream" ? "text-cream" : "text-espresso"} ${className}`}>YELO Coffee</span>
  );
}

export function WordmarkLink({ preload = false }: { preload?: boolean }) {
  return (
    <Link href="/" className="-ml-1 flex min-h-11 items-center gap-2 rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso">
      <Image src="/assets/yelo-coffee-mascot.png" alt="" width={44} height={44} className="size-11 object-contain" preload={preload} />
      <Wordmark className="text-[26px]" />
    </Link>
  );
}
