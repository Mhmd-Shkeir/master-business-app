import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useDismissedOverdueProjectIds() {
  return useQuery({
    queryKey: ["dismissed-overdue"],
    queryFn: async () => (await api.get<string[]>("/notifications/dismissed-overdue")).data,
  });
}

export function useDismissOverdueNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => api.post("/notifications/dismiss-overdue", { projectId }),
    // Optimistic: the whole point is the badge/list update the instant the user
    // clicks through, not after a round trip or the next 60s poll.
    onMutate: async (projectId: string) => {
      await queryClient.cancelQueries({ queryKey: ["dismissed-overdue"] });
      const previous = queryClient.getQueryData<string[]>(["dismissed-overdue"]);
      queryClient.setQueryData<string[]>(["dismissed-overdue"], (ids) => [...(ids ?? []), projectId]);
      return { previous };
    },
    onError: (_err, _projectId, context) => {
      if (context?.previous) queryClient.setQueryData(["dismissed-overdue"], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["dismissed-overdue"] });
    },
  });
}
