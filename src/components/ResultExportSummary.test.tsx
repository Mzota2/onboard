import { describe, expect, it } from "vitest";
import { formatPhaseScore } from "./ResultExportSummary";

describe("formatPhaseScore", () => {
  it("formats complete scores as a percentage", () => {
    expect(formatPhaseScore({ technicalDepth: 5, clarity: 4, impact: 3 })).toEqual({
      label: "80%",
      isScored: true,
    });
  });

  it("returns a pending state when any score is missing or invalid", () => {
    expect(formatPhaseScore({ technicalDepth: 5, clarity: 4, impact: Number.NaN })).toEqual({
      label: "Pending",
      isScored: false,
    });
  });

  it("returns pending when no score data is available", () => {
    expect(formatPhaseScore(null)).toEqual({
      label: "Pending",
      isScored: false,
    });
  });
});
