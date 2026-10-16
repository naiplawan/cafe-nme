import { describe, expect, it } from "vitest";
import * as copyButton from "./copy-button";

describe("copy button", () => {
  it("exposes a reusable copy control", () => {
    expect(copyButton.CopyButton).toBeTypeOf("function");
  });
});
