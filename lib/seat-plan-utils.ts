export type SeatCell = {
  seatId: string;
  row: number;
  column: number;
  studentId?: string;
};

function seatKey(row: number, column: number) {
  return `${row}:${column}`;
}

export function createSeatId(row: number, column: number) {
  return `seat-${row}-${column}`;
}

export function sortSeatCells(seats: SeatCell[]) {
  return [...seats].sort((left, right) => {
    if (left.row !== right.row) return left.row - right.row;
    return left.column - right.column;
  });
}

export function buildSeatGrid(rows: number, columns: number, seats: SeatCell[] = []) {
  const seatMap = new Map(
    seats.map((seat) => [seatKey(seat.row, seat.column), { ...seat, seatId: seat.seatId || createSeatId(seat.row, seat.column) }])
  );
  const grid: SeatCell[] = [];

  for (let row = 1; row <= rows; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      const key = seatKey(row, column);
      const existing = seatMap.get(key);
      grid.push(
        existing
          ? { ...existing, row, column, seatId: existing.seatId || createSeatId(row, column) }
          : { seatId: createSeatId(row, column), row, column }
      );
    }
  }

  return grid;
}

export function resizeSeatGrid(currentSeats: SeatCell[], rows: number, columns: number) {
  const nextBase = buildSeatGrid(
    rows,
    columns,
    currentSeats.filter((seat) => seat.row <= rows && seat.column <= columns)
  );
  const assignedStudentIds = new Set(nextBase.map((seat) => seat.studentId).filter(Boolean));
  const displacedStudentIds = sortSeatCells(currentSeats)
    .map((seat) => seat.studentId)
    .filter((studentId): studentId is string => Boolean(studentId) && !assignedStudentIds.has(studentId));

  return nextBase.map((seat) => {
    if (seat.studentId || !displacedStudentIds.length) {
      return seat;
    }
    return {
      ...seat,
      studentId: displacedStudentIds.shift()
    };
  });
}

export function swapSeatAssignment(seats: SeatCell[], seatId: string, nextStudentId?: string) {
  const nextSeats = sortSeatCells(seats).map((seat) => ({ ...seat }));
  const targetIndex = nextSeats.findIndex((seat) => seat.seatId === seatId);
  if (targetIndex === -1) return nextSeats;

  const normalizedStudentId = nextStudentId?.trim() || undefined;
  const currentStudentId = nextSeats[targetIndex].studentId;

  if (!normalizedStudentId) {
    nextSeats[targetIndex].studentId = undefined;
    return nextSeats;
  }

  const existingIndex = nextSeats.findIndex((seat) => seat.studentId === normalizedStudentId);
  if (existingIndex >= 0 && existingIndex !== targetIndex) {
    nextSeats[existingIndex].studentId = currentStudentId;
  }

  nextSeats[targetIndex].studentId = normalizedStudentId;
  return nextSeats;
}

export function getAssignedStudentIds(seats: SeatCell[]) {
  return sortSeatCells(seats)
    .map((seat) => seat.studentId)
    .filter((studentId): studentId is string => Boolean(studentId));
}

export function getUnassignedStudentIds(seats: SeatCell[], studentIds: string[]) {
  const assigned = new Set(getAssignedStudentIds(seats));
  return studentIds.filter((studentId) => !assigned.has(studentId));
}

export function buildSeatPairs(seats: SeatCell[]) {
  const sorted = sortSeatCells(seats);
  const byRow = new Map<number, SeatCell[]>();

  sorted.forEach((seat) => {
    const rowSeats = byRow.get(seat.row) ?? [];
    rowSeats.push(seat);
    byRow.set(seat.row, rowSeats);
  });

  const pairs: SeatCell[][] = [];
  Array.from(byRow.keys())
    .sort((left, right) => left - right)
    .forEach((row) => {
      const rowSeats = sortSeatCells(byRow.get(row) ?? []);
      for (let index = 0; index < rowSeats.length; index += 2) {
        pairs.push(rowSeats.slice(index, index + 2));
      }
    });

  return pairs;
}

export function getFrontRowCount(rows: number) {
  return Math.max(1, Math.ceil(rows / 3));
}
