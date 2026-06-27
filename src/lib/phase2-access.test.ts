import { describe, it, expect } from "vitest";
import { canStartPhase2Review } from "./phase2-access";

describe("canStartPhase2Review", () => {
  it("requires promotion and phase 1 release", () => {
    expect(canStartPhase2Review({ promotedToPhase2: true, phase1ConsentReleased: true })).toBe(true);
    expect(canStartPhase2Review({ promotedToPhase2: true, phase1ConsentReleased: false })).toBe(false);
    expect(canStartPhase2Review({ promotedToPhase2: false, phase1ConsentReleased: true })).toBe(false);
  });
});
