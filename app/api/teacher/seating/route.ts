import { upsertClassSeatPlan } from "@/lib/class-seat-plans";
import { createLearningRoute } from "@/lib/api/domains";
import { v } from "@/lib/api/validation";
import { buildSavedTeacherSeatingResult, getTeacherSeatingData } from "@/lib/teacher-seating";

export const dynamic = "force-dynamic";

const GENERATED_BY_VALUES = ["manual", "ai"] as const;

const seatingQuerySchema = v.object<{
  classId?: string;
}>(
  {
    classId: v.optional(v.string({ minLength: 1 }))
  },
  { allowUnknown: true }
);

const seatCellSchema = v.object<{
  seatId?: string;
  row: number;
  column: number;
  studentId?: string;
}>(
  {
    seatId: v.optional(v.string({ allowEmpty: true })),
    row: v.number({ integer: true, min: 1, max: 12 }),
    column: v.number({ integer: true, min: 1, max: 12 }),
    studentId: v.optional(v.string({ allowEmpty: true }))
  },
  { allowUnknown: false }
);

const saveSeatPlanBodySchema = v.object<{
  classId: string;
  rows: number;
  columns: number;
  seats: Array<{
    seatId?: string;
    row: number;
    column: number;
    studentId?: string;
  }>;
  generatedBy?: (typeof GENERATED_BY_VALUES)[number];
  note?: string;
}>(
  {
    classId: v.string({ minLength: 1 }),
    rows: v.number({ integer: true, min: 1, max: 12 }),
    columns: v.number({ integer: true, min: 1, max: 12 }),
    seats: v.array(seatCellSchema),
    generatedBy: v.optional(v.enum(GENERATED_BY_VALUES)),
    note: v.optional(v.string({ allowEmpty: true, trim: false }))
  },
  { allowUnknown: false }
);

export const GET = createLearningRoute({
  role: "teacher",
  query: seatingQuerySchema,
  cache: "private-short",
  handler: async ({ query, user }) => {
    const teacherUser = user!;
    return await getTeacherSeatingData(teacherUser.id, query.classId);
  }
});

export const POST = createLearningRoute({
  role: "teacher",
  body: saveSeatPlanBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    const teacherUser = user!;
    const plan = await upsertClassSeatPlan({
      classId: body.classId,
      teacherId: teacherUser.id,
      rows: body.rows,
      columns: body.columns,
      seats: body.seats.map((seat) => ({
        seatId: seat.seatId?.trim() || `seat-${seat.row}-${seat.column}`,
        row: seat.row,
        column: seat.column,
        studentId: seat.studentId?.trim() || undefined
      })),
      generatedBy: body.generatedBy ?? "manual",
      note: body.note ?? undefined
    });

    return await buildSavedTeacherSeatingResult({
      teacherId: teacherUser.id,
      classId: body.classId,
      plan
    });
  }
});
