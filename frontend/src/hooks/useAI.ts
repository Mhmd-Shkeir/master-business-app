import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ProjectDetail } from "../lib/types";

export interface DailyBriefResult {
  brief: string;
  generatedAt: string;
}

export interface GroundedProject {
  id: string;
  name: string;
}

export interface AIQueryResult {
  answer: string;
  groundedOn: GroundedProject[];
}

export interface DraftEmailResult {
  subject: string;
  body: string;
}

export function useDailyBrief() {
  return useMutation({
    mutationFn: async () => (await api.post<DailyBriefResult>("/ai/daily-brief")).data,
  });
}

export function useAIQuery() {
  return useMutation({
    mutationFn: async (question: string) => (await api.post<AIQueryResult>("/ai/query", { question })).data,
  });
}

export function useDraftEmail(projectId: string) {
  return useMutation({
    mutationFn: async (instructions?: string) =>
      (await api.post<DraftEmailResult>(`/ai/projects/${projectId}/draft-email`, { instructions })).data,
  });
}

export function useConfirmNote(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) =>
      (await api.post<ProjectDetail>(`/ai/projects/${projectId}/confirm-note`, { message })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
