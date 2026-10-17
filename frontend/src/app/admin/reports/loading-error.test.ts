import { Children, createElement, isValidElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ReportsError from "./error";
import Loading from "./loading";

function retryHandler(node: ReactNode): (() => void) | undefined {
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) { return undefined; }
  if (node.type === Button) { return node.props.onClick; }
  for (const child of Children.toArray(node.props.children)) {
    const handler = retryHandler(child);
    if (handler) { return handler; }
  }
  return undefined;
}

describe("reports route states", () => {
  it("wires the retry control to the route recovery callback", () => {
    let retries = 0;
    const tree = ReportsError({ error: new Error("private"), retry: () => { retries += 1; } });
    const handler = retryHandler(tree);
    expect(typeof handler).toBe("function");
    handler?.();
    expect(retries).toBe(1);
  });

  it("announces the loading state", () => {
    const markup = renderToStaticMarkup(createElement(Loading));
    expect(markup).toContain('role="status"');
    expect(markup).toContain("กำลังโหลดรายงาน");
  });

  it("offers retry without exposing the server error", () => {
    const markup = renderToStaticMarkup(createElement(ReportsError, { error: new Error("secret"), retry: vi.fn() }));
    expect(markup).toContain("ลองใหม่");
    expect(markup).not.toContain("secret");
  });
});
