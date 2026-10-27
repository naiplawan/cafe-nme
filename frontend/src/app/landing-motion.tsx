"use client";

import { useRef } from "react";
import { gsap, MOTION, useGSAP } from "@/components/motion/gsap";

// Decorates the server-rendered landing page; content is complete without JavaScript.
// The h1 never animates so it still paints first and the largest-content timing stays fast.
export function LandingMotion({ className, children }: { className: string; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.timeline({ defaults: { ease: MOTION.ease } })
        .from(q("[data-motion=mock]"), { y: 36, opacity: 0, duration: 0.7 }, 0.1)
        .from(q("[data-motion=mock-card]"), { y: 14, opacity: 0, stagger: 0.07, duration: 0.4 }, "-=0.35")
        .from(q("[data-motion=mascot]"), { scale: 0.5, opacity: 0, duration: 0.6, ease: MOTION.pop, transformOrigin: "50% 100%" }, "-=0.25")
        .from(q("[data-motion=order-line]"), { x: 18, opacity: 0, stagger: 0.22, duration: 0.35 }, "-=0.2")
        .from(q("[data-motion=order-total]"), { scale: 0.85, opacity: 0, duration: 0.35, ease: MOTION.pop }, "-=0.05");

      // Each track holds two identical groups, so moving it by half its width loops without a jump.
      for (const track of q("[data-marquee-track]")) {
        const reverse = track.getAttribute("data-direction") === "reverse";
        gsap.fromTo(track, { xPercent: reverse ? -50 : 0 }, { xPercent: reverse ? 0 : -50, duration: 32, ease: "none", repeat: -1 });
      }

      gsap.to(q("[data-motion=float]"), { y: -8, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.5, delay: 1.2 });

      // Only hide what is still below the fold, so nothing already on screen blinks out.
      const pending = q("[data-reveal]").filter((element) => element.getBoundingClientRect().top > window.innerHeight);
      gsap.set(pending, { y: 28, opacity: 0 });
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) { continue; }
          gsap.to(entry.target, { y: 0, opacity: 1, duration: 0.6, ease: MOTION.ease });
          observer.unobserve(entry.target);
        }
      }, { rootMargin: "0px 0px -8% 0px" });
      for (const element of pending) { observer.observe(element); }
      return () => observer.disconnect();
    });
  }, { scope: root });

  return <div ref={root} className={className}>{children}</div>;
}
