import type { KeyboardEvent } from "react";

export function getWrappedTabIndex(index: number, count: number, backwards: boolean): number | null {
  if (count < 1) return null;
  if (index < 0) return backwards ? count - 1 : 0;
  if (backwards && index === 0) return count - 1;
  if (!backwards && index === count - 1) return 0;
  return null;
}

export function trapDialogTab(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;

  const dialog = event.currentTarget;
  const controls = [...dialog.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((control) => !control.hasAttribute("hidden") && control.getAttribute("aria-hidden") !== "true");
  const activeIndex = controls.indexOf(document.activeElement as HTMLElement);
  const wrappedIndex = getWrappedTabIndex(activeIndex, controls.length, event.shiftKey);

  if (wrappedIndex !== null) {
    event.preventDefault();
    if (controls.length === 0) dialog.focus();
    else controls[wrappedIndex]?.focus();
  }
}
