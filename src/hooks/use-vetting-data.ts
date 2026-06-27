import { useQuery } from "@tanstack/react-query";
import { listPositions } from "@/lib/firebase/positions";
import { listCandidates, computePipelineStats } from "@/lib/firebase/candidates";

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: listPositions,
  });
}

export function useCandidates(positionId?: string) {
  return useQuery({
    queryKey: ["candidates", positionId ?? "all"],
    queryFn: () => listCandidates(positionId),
  });
}

export function usePipelineStats() {
  return useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: async () => {
      const candidates = await listCandidates();
      return computePipelineStats(candidates);
    },
  });
}
