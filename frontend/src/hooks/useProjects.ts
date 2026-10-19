import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth, usePrivateQueryScope } from "../lib/auth-context";
import type { AuthUser, Customer, ProjectDetail, ProjectStatus, ProjectSummary, Supplier } from "../lib/types";

export function useProjects(options?: { refetchInterval?: number }) {
  const scope = usePrivateQueryScope();
  return useQuery({
    queryKey: ["projects", ...scope],
    queryFn: async () => (await api.get<ProjectSummary[]>("/projects")).data,
    ...options,
  });
}

export function useProject(id: string | undefined) {
  const scope = usePrivateQueryScope();
  return useQuery({
    queryKey: ["projects", ...scope, id],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useCustomers() {
  const scope = usePrivateQueryScope();
  return useQuery({
    queryKey: ["customers", ...scope],
    queryFn: async () => (await api.get<Customer[]>("/customers")).data,
  });
}

export function useSuppliers(enabled: boolean = true) {
  const scope = usePrivateQueryScope();
  return useQuery({
    queryKey: ["suppliers", ...scope],
    queryFn: async () => (await api.get<Supplier[]>("/suppliers")).data,
    enabled,
  });
}

export function useCustomer(id: string | undefined) {
  const scope = usePrivateQueryScope();
  return useQuery({
    queryKey: ["customers", ...scope, id],
    queryFn: async () => (await api.get<Customer>(`/customers/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useSupplier(id: string | undefined) {
  const scope = usePrivateQueryScope();
  return useQuery({
    queryKey: ["suppliers", ...scope, id],
    queryFn: async () => (await api.get<Supplier>(`/suppliers/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectName: string;
      customerId: string;
      nextAction?: string;
      dueDate?: string;
      description?: string;
      estimatedRevenue?: number;
      currency?: string;
    }) => (await api.post("/projects", data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useTransitionStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: ProjectStatus) =>
      (await api.patch(`/projects/${projectId}/status`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useOverrideHold(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason: string) =>
      (await api.post(`/projects/${projectId}/override-hold`, { reason })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export interface ProjectEditPatch {
  projectName?: string;
  nextAction?: string | null;
  dueDate?: string | null;
  description?: string | null;
  supplierId?: string | null;
  estimatedRevenue?: number;
  actualRevenue?: number;
  customerPaid?: number;
  estimatedCost?: number;
  actualCost?: number;
  supplierPaid?: number;
  currency?: string;
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ProjectEditPatch) => (await api.patch(`/projects/${projectId}`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useRecordPayment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { side: "customer" | "supplier"; amount: number; note?: string }) =>
      (await api.post(`/projects/${projectId}/payment`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useAddExpense(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { category: string; amount: number; note?: string }) =>
      (await api.post(`/projects/${projectId}/expenses`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useChangePassword() {
  const { updateToken } = useAuth();
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) =>
      (await api.patch<{ success: boolean; token: string }>("/auth/password", data)).data,
    onSuccess: ({ token }) => updateToken(token),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: async (data: { name: string }) =>
      (await api.patch<{ user: AuthUser }>("/auth/profile", data)).data,
    onSuccess: ({ user }) => {
      updateUser(user);
      // Owner/activity references embed the user's name live via the DB relation,
      // so any already-cached project list/detail needs a refetch to pick it up.
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

type EntityKind = "customers" | "suppliers";

function useCreateEntity(kind: EntityKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await api.post(`/${kind}`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [kind] });
    },
  });
}

function useUpdateEntity(kind: EntityKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      (await api.patch(`/${kind}/${id}`, data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [kind] });
      // Projects embed a slim {id, name, country} snapshot of their customer/supplier,
      // so a rename here would otherwise go stale in any already-cached project view.
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

function useDeleteEntity(kind: EntityKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/${kind}/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [kind] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export const useCreateCustomer = () => useCreateEntity("customers");
export const useUpdateCustomer = () => useUpdateEntity("customers");
export const useDeleteCustomer = () => useDeleteEntity("customers");
export const useCreateSupplier = () => useCreateEntity("suppliers");
export const useUpdateSupplier = () => useUpdateEntity("suppliers");
export const useDeleteSupplier = () => useDeleteEntity("suppliers");
