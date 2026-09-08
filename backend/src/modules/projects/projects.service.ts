import { ProjectStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { computeFinancials } from "../../lib/rbac";
import type { AuthUser } from "../../middleware/auth";

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const WORKFLOW_ORDER: ProjectStatus[] = ["RFQ", "QUOTED", "ORDERED", "SHIPPING", "CLOSED"];

async function getProjectWithFinancial(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { financial: true },
  });
  if (!project) {
    throw new AppError("Project not found", 404);
  }
  return project;
}

/**
 * Normal status transition. Two independent rules:
 *  1. Stage-skip permission: Sales/Procurement move one stage forward at a time;
 *     Admin may jump forward to any later stage. No role may move backward.
 *  2. Shipment hold: reaching CLOSED while an outstanding customer balance exists
 *     is always blocked here, Admin included — the only way past it is the
 *     explicit overrideShipmentHold() action below, which is separately audited.
 */
export async function transitionProjectStatus(
  projectId: string,
  targetStatus: ProjectStatus,
  user: AuthUser,
) {
  const project = await getProjectWithFinancial(projectId);

  const currentIndex = WORKFLOW_ORDER.indexOf(project.status);
  const targetIndex = WORKFLOW_ORDER.indexOf(targetStatus);

  if (targetIndex === currentIndex) {
    throw new AppError(`Project is already in ${targetStatus}`, 400);
  }
  if (targetIndex < currentIndex) {
    throw new AppError("Backward status transitions are not allowed", 400);
  }
  if (user.role !== "ADMIN" && targetIndex !== currentIndex + 1) {
    throw new AppError("Only Admin may skip workflow stages; move one stage at a time", 403);
  }

  if (targetStatus === "CLOSED") {
    const financials = computeFinancials(project.financial);
    const balance = financials?.customerBalance ?? 0;
    if (balance > 0) {
      throw new AppError(
        `Cannot close: outstanding customer balance of ${balance.toFixed(2)}. Admin must use the override action.`,
        409,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.project.update({
      where: { id: projectId },
      data: { status: targetStatus },
    });
    await tx.activity.create({
      data: {
        projectId,
        userId: user.id,
        type: "SYSTEM",
        message: `Status changed from ${project.status} to ${targetStatus}.`,
      },
    });
    return result;
  });

  return updated;
}

/**
 * Admin-only escape hatch for the shipment hold. Only valid when the project
 * is actually being held (SHIPPING with an outstanding customer balance).
 * Logs admin name, timestamp, and reason to the Activity Timeline per spec.
 */
export async function overrideShipmentHold(projectId: string, user: AuthUser, reason: string) {
  if (user.role !== "ADMIN") {
    throw new AppError("Only Admin can override the shipment hold", 403);
  }
  if (!reason || reason.trim().length === 0) {
    throw new AppError("A reason is required to override the shipment hold", 400);
  }

  const project = await getProjectWithFinancial(projectId);

  if (project.status !== "SHIPPING") {
    throw new AppError("Shipment hold override only applies to projects in Shipping", 400);
  }
  const financials = computeFinancials(project.financial);
  const balance = financials?.customerBalance ?? 0;
  if (balance <= 0) {
    throw new AppError("This project has no outstanding balance — no hold to override", 400);
  }

  const admin = await prisma.user.findUnique({ where: { id: user.id } });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.project.update({
      where: { id: projectId },
      data: { status: "CLOSED", shipmentHoldOverridden: true },
    });
    await tx.activity.create({
      data: {
        projectId,
        userId: user.id,
        type: "OVERRIDE",
        message: `Shipment hold overridden by ${admin?.name ?? user.id} at ${new Date().toISOString()}. Reason: ${reason}`,
      },
    });
    return result;
  });

  return updated;
}
