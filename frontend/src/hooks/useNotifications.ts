import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { usePrivateQueryScope } from "../lib/auth-context";

export function useDismissedOverdueProjectIds() {
  const scope = usePrivateQueryScope();
  return useQuery({
    queryKey: ["dismissed-overdue", ...scope],
    queryFn: async () => (await api.get<string[]>("/notifications/dismissed-overdue")).data,
  });
}

export function useDismissOverdueNotification() {
  const queryClient = useQueryClient();
  const scope = usePrivateQueryScope();
  const queryKey = ["dismissed-overdue", ...scope] as const;
  return useMutation({
    mutationFn: async (projectId: string) => api.post("/notifications/dismiss-overdue", { projectId }),
    // Optimistic: the whole point is the badge/list update the instant the user
    // clicks through, not after a round trip or the next 60s poll.
    onMutate: async (projectId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData<string[]>(queryKey, (ids) => [...(ids ?? []), projectId]);
      return { previous };
    },
    onError: (_err, _projectId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
