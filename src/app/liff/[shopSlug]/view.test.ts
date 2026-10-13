import { describe, expect, it } from "vitest";
import { readLiffView } from "./view";

describe("readLiffView", () => {
  it("reads a direct LIFF view query", () => {
    expect(readLiffView("?view=stamps")).toBe("stamps");
    expect(readLiffView("?view=card")).toBe("card");
    expect(readLiffView("?view=register")).toBe("register");
  });

  it("reads a view nested in the LIFF state query", () => {
    expect(readLiffView("?liff.state=%2F%3Fview%3Dmenu")).toBe("menu");
  });

  it("defaults to the card for unknown or missing views", () => {
    expect(readLiffView("?view=unknown")).toBe("card");
    expect(readLiffView("?liff.state=%2F%3Fview%3Dnope")).toBe("card");
    expect(readLiffView("")).toBe("card");
  });
});
