import { describe, expect, it } from "vitest";
import { readBoundedBody } from "./read-bounded-body";

function requestWithBody(body: string) {
  return new Request("https://example.test", { method: "POST", body });
}

describe("readBoundedBody", () => {
  it("reads bodies at the configured limit", async () => {
    await expect(readBoundedBody(requestWithBody("1234"), 4)).resolves.toBe("1234");
  });

  it("rejects a body that exceeds the configured limit while streaming", async () => {
    await expect(readBoundedBody(requestWithBody("12345"), 4)).rejects.toThrow("Body too large");
  });
});
