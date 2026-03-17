export function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.length || row.length) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current.length || row.length) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

export function parseListText(input: string) {
  return input
    .split(/[,|，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveAdminQuestionKnowledgePointId(
  knowledgePoints: Array<{ id: string; subject: string; grade: string }>,
  subject: string,
  grade: string,
  knowledgePointId: string
) {
  if (!knowledgePointId) {
    return "";
  }

  return knowledgePoints.some((item) => item.id === knowledgePointId && item.subject === subject && item.grade === grade)
    ? knowledgePointId
    : "";
}

export function downloadQuestionTemplate() {
  const header = [
    "subject",
    "grade",
    "knowledgePointId",
    "knowledgePointTitle",
    "stem",
    "options",
    "answer",
    "explanation",
    "difficulty",
    "questionType",
    "tags",
    "abilities"
  ];
  const sample = [
    "math",
    "4",
    "math-g4-fractions-meaning",
    "分数的意义",
    "把一个披萨平均分成 8 份，小明吃了 3 份，吃了几分之几？",
    "1/8|3/8|3/5|8/3",
    "3/8",
    "平均分成 8 份，每份是 1/8，吃了 3 份就是 3/8。",
    "medium",
    "choice",
    "分数|图形",
    "计算|理解"
  ];
  const csv = `${header.join(",")}\n${sample.map((item) => `\"${item}\"`).join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "questions-template.csv";
  link.click();
}
