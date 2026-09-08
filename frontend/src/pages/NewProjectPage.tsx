import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateProject, useCustomers, useSuppliers } from "../hooks/useProjects";

export function NewProjectPage() {
  const { data: customers } = useCustomers();
  const { data: suppliers } = useSuppliers();
  const createProject = useCreateProject();
  const navigate = useNavigate();

  const [projectName, setProjectName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedRevenue, setEstimatedRevenue] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await createProject.mutateAsync({
        projectName,
        customerId,
        supplierId: supplierId || undefined,
        nextAction: nextAction || undefined,
        dueDate: dueDate || undefined,
        estimatedRevenue: estimatedRevenue ? Number(estimatedRevenue) : 0,
        estimatedCost: estimatedCost ? Number(estimatedCost) : 0,
      });
      navigate(`/projects/${(created as { id: string }).id}`);
    } catch {
      setError("Failed to create project — check required fields.");
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <Link to="/" className="mb-4 inline-block text-sm text-neutral-500 hover:underline">
        &larr; Back to dashboard
      </Link>
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-semibold text-neutral-900">New Project (RFQ)</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Project Name</label>
            <input
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Customer</label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">Select a customer...</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Supplier (optional)</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">None yet</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-neutral-600">Est. Revenue</label>
              <input
                type="number"
                min="0"
                value={estimatedRevenue}
                onChange={(e) => setEstimatedRevenue(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-600">Est. Cost</label>
              <input
                type="number"
                min="0"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Next Action</label>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={createProject.isPending}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {createProject.isPending ? "Creating..." : "Create Project"}
          </button>
        </form>
      </div>
    </div>
  );
}
