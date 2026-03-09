import { createLearningRoute } from "@/lib/api/domains";
import { v } from "@/lib/api/validation";
import { generateTeacherSeatingAiPreview } from "@/lib/teacher-seating";

export const dynamic = "force-dynamic";

const lockedSeatSchema = v.object<{
  seatId?: string;
  row: number;
  column: number;
  studentId: string;
}>(
  {
    seatId: v.optional(v.string({ allowEmpty: true })),
    row: v.number({ integer: true, min: 1, max: 12 }),
    column: v.number({ integer: true, min: 1, max: 12 }),
    studentId: v.string({ minLength: 1 })
  },
  { allowUnknown: false }
);

const aiPreviewBodySchema = v.object<{
  classId: string;
  rows: number;
  columns: number;
  balanceGender?: boolean;
  pairByScoreComplement?: boolean;
  respectHeightGradient?: boolean;
  lockedSeats?: Array<{
    seatId?: string;
    row: number;
    column: number;
    studentId: string;
  }>;
}>(
  {
    classId: v.string({ minLength: 1 }),
    rows: v.number({ integer: true, min: 1, max: 12 }),
    columns: v.number({ integer: true, min: 1, max: 12 }),
    balanceGender: v.optional(v.boolean()),
    pairByScoreComplement: v.optional(v.boolean()),
    respectHeightGradient: v.optional(v.boolean()),
    lockedSeats: v.optional(v.array(lockedSeatSchema))
  },
  { allowUnknown: false }
);

export const POST = createLearningRoute({
  role: "teacher",
  body: aiPreviewBodySchema,
  cache: "private-realtime",
  handler: async ({ body, user }) => {
    const teacherUser = user!;
    return await generateTeacherSeatingAiPreview({
      teacherId: teacherUser.id,
      classId: body.classId,
      rows: body.rows,
      columns: body.columns,
      options: {
        balanceGender: body.balanceGender ?? true,
        pairByScoreComplement: body.pairByScoreComplement ?? true,
        respectHeightGradient: body.respectHeightGradient ?? true
      },
      lockedSeats: body.lockedSeats?.map((seat) => ({
        seatId: seat.seatId?.trim() || undefined,
        row: seat.row,
        column: seat.column,
        studentId: seat.studentId.trim()
      }))
    });
  }
});
