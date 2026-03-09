import crypto from "crypto";
import { badRequest } from "./api/http";
import { readJson, writeJson } from "./storage";
import { buildSeatGrid, createSeatId, type SeatCell } from "./seat-plan-utils";

export type ClassSeatPlan = {
  id: string;
  classId: string;
  teacherId: string;
  rows: number;
  columns: number;
  seats: SeatCell[];
  generatedBy: "manual" | "ai";
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassSeatPlanInput = {
  classId: string;
  teacherId: string;
  rows: number;
  columns: number;
  seats: SeatCell[];
  generatedBy?: "manual" | "ai";
  note?: string;
};

const FILE = "class-seat-plans.json";

function normalizeNote(value?: string) {
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next.length ? next : undefined;
}

function validateSeatPlan(rows: number, columns: number, seats: SeatCell[]) {
  if (!Number.isInteger(rows) || rows < 1 || rows > 12) {
    badRequest("rows must be between 1 and 12");
  }
  if (!Number.isInteger(columns) || columns < 1 || columns > 12) {
    badRequest("columns must be between 1 and 12");
  }

  const occupiedKeys = new Set<string>();
  const occupiedStudentIds = new Set<string>();

  seats.forEach((seat) => {
    if (!Number.isInteger(seat.row) || !Number.isInteger(seat.column)) {
      badRequest("seat position must be integer");
    }
    if (seat.row < 1 || seat.row > rows || seat.column < 1 || seat.column > columns) {
      badRequest("seat position out of range");
    }

    const positionKey = `${seat.row}:${seat.column}`;
    if (occupiedKeys.has(positionKey)) {
      badRequest("duplicate seat position");
    }
    occupiedKeys.add(positionKey);

    if (seat.studentId) {
      if (occupiedStudentIds.has(seat.studentId)) {
        badRequest("duplicate student assignment");
      }
      occupiedStudentIds.add(seat.studentId);
    }
  });
}

function normalizeSeats(rows: number, columns: number, seats: SeatCell[]) {
  return buildSeatGrid(
    rows,
    columns,
    seats.map((seat) => ({
      seatId: seat.seatId || createSeatId(seat.row, seat.column),
      row: seat.row,
      column: seat.column,
      studentId: seat.studentId?.trim() || undefined
    }))
  );
}

export async function getClassSeatPlans(): Promise<ClassSeatPlan[]> {
  return readJson<ClassSeatPlan[]>(FILE, []);
}

export async function getClassSeatPlan(classId: string) {
  const list = await getClassSeatPlans();
  return list.find((item) => item.classId === classId) ?? null;
}

export async function upsertClassSeatPlan(input: ClassSeatPlanInput) {
  const list = await getClassSeatPlans();
  const index = list.findIndex((item) => item.classId === input.classId);
  const existing = index >= 0 ? list[index] : null;
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const seats = normalizeSeats(input.rows, input.columns, input.seats);

  validateSeatPlan(input.rows, input.columns, seats);

  const next: ClassSeatPlan = {
    id: existing?.id ?? `seat-plan-${crypto.randomBytes(6).toString("hex")}`,
    classId: input.classId,
    teacherId: input.teacherId,
    rows: input.rows,
    columns: input.columns,
    seats,
    generatedBy: input.generatedBy ?? existing?.generatedBy ?? "manual",
    note: normalizeNote(input.note) ?? existing?.note,
    createdAt,
    updatedAt
  };

  if (index >= 0) {
    list[index] = next;
  } else {
    list.push(next);
  }

  writeJson(FILE, list);
  return next;
}
