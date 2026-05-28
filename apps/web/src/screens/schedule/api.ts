import { api } from "../../lib/api/client";

export const SCHEDULE_STATUSES: Array<{ id: number; label: string }> = [
  { id: 1, label: "Scheduled" },
  { id: 2, label: "Confirmed" },
  { id: 3, label: "Arrived" },
  { id: 4, label: "InProgress" },
  { id: 5, label: "Completed" },
  { id: 6, label: "NoShow" },
  { id: 7, label: "Cancelled" },
];

export interface ScheduleListItem {
  scheduleItemId: string;
  scheduledInDate: string;
  scheduledToDate: string;
  statusId: number;
  labelId: number;
  isVerified: boolean;
  isDone: boolean;
  isSurgery: boolean;
  notForPatient: boolean;
  location: string | null;
  name: string | null;
  notes: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  doctor: { userId: string; fullName: string } | null;
  patient: {
    patientId: string;
    fullName: string;
    fullNameAr: string | null;
    nationalId: string;
    mobileNumber: string | null;
  } | null;
  patientVisitId: string | null;
}

export interface ListScheduleParams {
  from: string;
  to: string;
  doctorId?: string;
  status?: number;
}

export function listSchedule(
  params: ListScheduleParams,
  signal?: AbortSignal,
): Promise<ScheduleListItem[]> {
  return api("/schedule", { query: params as unknown as Record<string, string>, signal });
}

export interface CreateSchedulePayload {
  doctorId: string;
  scheduledInDate: string;
  scheduledToDate: string;
  patientId?: string | null;
  name?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
  location?: string | null;
  statusId?: number;
  labelId?: number;
  isSurgery?: boolean;
  notForPatient?: boolean;
}

export type UpdateSchedulePayload = Partial<
  CreateSchedulePayload & { isVerified: boolean; isDone: boolean }
>;

export function createSchedule(payload: CreateSchedulePayload): Promise<{ scheduleItemId: string }> {
  return api("/schedule", { method: "POST", body: payload });
}

export function updateSchedule(id: string, payload: UpdateSchedulePayload): Promise<void> {
  return api(`/schedule/${encodeURIComponent(id)}`, { method: "PATCH", body: payload });
}

export function deleteSchedule(id: string): Promise<void> {
  return api(`/schedule/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function updateScheduleStatus(id: string, statusId: number): Promise<void> {
  return api(`/schedule/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { statusId },
  });
}

export function startVisitFromAppointment(
  id: string,
  visitType?: number,
): Promise<{ patientVisitId: string; alreadyExisted: boolean }> {
  return api(`/schedule/${encodeURIComponent(id)}/start-visit`, {
    method: "POST",
    body: visitType != null ? { visitType } : {},
  });
}

// ---- Users (for the doctor picker) ----

export interface UserListItem {
  userId: string;
  userName: string;
  fullName: string;
  userType: number;
  isAdmin: boolean;
  isActive: boolean;
}

export function listUsers(signal?: AbortSignal): Promise<UserListItem[]> {
  return api("/users", { signal });
}
