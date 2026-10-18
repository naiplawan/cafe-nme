import assert from "node:assert/strict";
import test from "node:test";
import { isPairingCode } from "../src/pos-pairing.js";

test("POS pairing codes require eight decimal digits", () => {
  assert.equal(isPairingCode("00123456"), true);
  assert.equal(isPairingCode("123456"), false);
  assert.equal(isPairingCode("1234567x"), false);
});
