export type LiffView = "card" | "stamps" | "menu" | "register";

const LIFF_VIEWS: readonly LiffView[] = ["card", "stamps", "menu", "register"];

export function readLiffView(search: string): LiffView {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const directView = query.get("view");
  if (LIFF_VIEWS.includes(directView as LiffView)) return directView as LiffView;

  const state = query.get("liff.state");
  if (!state) return "card";
  const stateQuery = state.includes("?") ? state.slice(state.indexOf("?") + 1) : state.replace(/^\//, "");
  const nestedView = new URLSearchParams(stateQuery).get("view");
  return LIFF_VIEWS.includes(nestedView as LiffView) ? nestedView as LiffView : "card";
}
