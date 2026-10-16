import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { PosAccessController } from "../src/pos-access.controller.js";

test("unknown or expired pairing codes return a 404", async () => {
  const controller = new PosAccessController({ pairDevice: async () => null } as never);

  await assert.rejects(
    controller.pairDevice({ code: "000000" }),
    (error: unknown) => error instanceof NotFoundException,
  );
});
