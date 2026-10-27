const tones = { amber: "bg-amber text-ink", blush: "bg-blush text-espresso" } as const;

function Words({ words, hidden }: { words: readonly string[]; hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {words.map((word) => (
        <li key={word} className="font-display-condensed flex items-center whitespace-nowrap text-[clamp(26px,3.4vw,44px)]">
          <span className="px-5 md:px-7">{word}</span>
          <span aria-hidden className="text-[0.5em]">●</span>
        </li>
      ))}
    </ul>
  );
}

// A tilted band of words. GSAP moves the track in landing-motion; with reduced motion it stays still.
export function Marquee({ words, tone, reverse = false }: { words: readonly string[]; tone: keyof typeof tones; reverse?: boolean }) {
  return (
    <div className="overflow-hidden py-6 md:py-9">
      <div className={`-mx-4 -rotate-1 py-3 md:py-4 ${tones[tone]}`}>
        <div data-marquee-track data-direction={reverse ? "reverse" : "forward"} className="flex w-max">
          {/* Only the first group is read by screen readers. The rest repeat it so one half is wider than the viewport and the loop has no gap. */}
          <Words words={words} />
          <Words words={words} hidden />
          <Words words={words} hidden />
          <Words words={words} hidden />
        </div>
      </div>
    </div>
  );
}
