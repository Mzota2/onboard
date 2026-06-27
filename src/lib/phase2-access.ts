export function canStartPhase2Review(params: {
  promotedToPhase2: boolean;
  phase1ConsentReleased?: boolean;
}): boolean {
  return Boolean(params.promotedToPhase2 && params.phase1ConsentReleased);
}
