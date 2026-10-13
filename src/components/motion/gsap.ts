"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Flip } from "gsap/Flip";

// Register once for every client component that imports from here.
gsap.registerPlugin(useGSAP, DrawSVGPlugin, Flip);

/**
 * Shared motion tokens. A POS is used hundreds of times a shift: keep motion short,
 * never block input, and never delay a tap's result behind an animation.
 */
export const MOTION = {
  fast: 0.16, // presses, toggles
  base: 0.26, // dialogs, list items
  slow: 0.45, // celebratory moments (done screen, rewards)
  stagger: 0.04,
  ease: "power3.out",
  easeIn: "power2.in",
  pop: "back.out(1.7)",
} as const;

/** True when the user asked the OS for less motion; animations should jump to their end state. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { DrawSVGPlugin, Flip, gsap, useGSAP };
