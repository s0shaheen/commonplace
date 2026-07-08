import { describe, test, expect } from "vitest";
import { keyframeTimes } from "./ingest.js";

// Pure-planning coverage only. `extractKeyframes` is offscreen-only (needs DOM
// <video>/<canvas>); there is no DOM in the vitest "node" environment, so it is
// exercised in the offscreen document, not here.
describe("keyframeTimes", () => {
  test("spaces n midpoints over the duration (rounded to 3dp)", () => {
    expect(keyframeTimes(29, 6)).toEqual([2.417, 7.25, 12.083, 16.917, 21.75, 26.583]); // (i+0.5)*29/6
    expect(keyframeTimes(10, 2)).toEqual([2.5, 7.5]);
  });

  test("defaults to n=6", () => {
    expect(keyframeTimes(29)).toHaveLength(6);
  });

  test("null/0 duration → a single poster-adjacent frame at t=1", () => {
    expect(keyframeTimes(null)).toEqual([1]);
    expect(keyframeTimes(0)).toEqual([1]);
  });
});
