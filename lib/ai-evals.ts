import explanationDataset from "@/eval/ai/datasets/explanation.json";
import homeworkReviewDataset from "@/eval/ai/datasets/homework_review.json";
import knowledgePointsDataset from "@/eval/ai/datasets/knowledge_points_generate.json";
import { assessAiQuality, type AiQualityRiskLevel } from "./ai-quality-control";
import type { AiTaskType } from "./ai-task-policies";

type EvalCaseInput = {
  kind: "assist" | "coach" | "explanation" | "writing" | "assignment_review";
  provider?: string;
  taskType?: AiTaskType;
  textBlocks: string[];
  listCountHint?: number;
};

type EvalCaseExpected = {
  minScore?: number;
  maxScore?: number;
  riskLevel?: AiQualityRiskLevel;
};

type EvalCase = {
  id: string;
  input: EvalCaseInput;
  expected: EvalCaseExpected;
};

export type AiEvalDatasetName = "explanation" | "homework_review" | "knowledge_points_generate";

export type AiEvalCaseResult = {
  id: string;
  passed: boolean;
  score: number;
  riskLevel: AiQualityRiskLevel;
  reasons: string[];
  expected: EvalCaseExpected;
  mismatches: string[];
};

export type AiEvalDatasetReport = {
  dataset: AiEvalDatasetName;
  total: number;
  passed: number;
  passRate: number;
  averageScore: number;
  highRiskCount: number;
  cases: AiEvalCaseResult[];
};

export type AiEvalReport = {
  generatedAt: string;
  datasets: AiEvalDatasetReport[];
  summary: {
    totalCases: number;
    passedCases: number;
    passRate: number;
    averageScore: number;
    highRiskCount: number;
  };
};

const DATASETS: Record<AiEvalDatasetName, EvalCase[]> = {
  explanation: explanationDataset as EvalCase[],
  homework_review: homeworkReviewDataset as EvalCase[],
  knowledge_points_generate: knowledgePointsDataset as EvalCase[]
};

function round(value: number, digits = 2) {
  const scale = Math.pow(10, digits);
  return Math.round(value * scale) / scale;
}

function evaluateCase(testCase: EvalCase): AiEvalCaseResult {
  const quality = assessAiQuality({
    kind: testCase.input.kind,
    provider: testCase.input.provider,
    taskType: testCase.input.taskType,
    textBlocks: testCase.input.textBlocks,
    listCountHint: testCase.input.listCountHint
  });

  const mismatches: string[] = [];
  const expectedMin = testCase.expected.minScore;
  const expectedMax = testCase.expected.maxScore;
  const expectedRisk = testCase.expected.riskLevel;

  if (typeof expectedMin === "number" && quality.confidenceScore < expectedMin) {
    mismatches.push(`score ${quality.confidenceScore} < min ${expectedMin}`);
  }
  if (typeof expectedMax === "number" && quality.confidenceScore > expectedMax) {
    mismatches.push(`score ${quality.confidenceScore} > max ${expectedMax}`);
  }
  if (expectedRisk && quality.riskLevel !== expectedRisk) {
    mismatches.push(`risk ${quality.riskLevel} != ${expectedRisk}`);
  }

  return {
    id: testCase.id,
    passed: mismatches.length === 0,
    score: quality.confidenceScore,
    riskLevel: quality.riskLevel,
    reasons: quality.reasons,
    expected: testCase.expected,
    mismatches
  };
}

function buildDatasetReport(dataset: AiEvalDatasetName, cases: EvalCase[]): AiEvalDatasetReport {
  const results = cases.map((item) => evaluateCase(item));
  const passed = results.filter((item) => item.passed).length;
  const total = results.length;
  return {
    dataset,
    total,
    passed,
    passRate: total ? round((passed / total) * 100, 2) : 0,
    averageScore: total ? round(results.reduce((sum, item) => sum + item.score, 0) / total, 2) : 0,
    highRiskCount: results.filter((item) => item.riskLevel === "high").length,
    cases: results
  };
}

export function runAiOfflineEval(params: { datasets?: AiEvalDatasetName[] } = {}): AiEvalReport {
  const datasetNames = (params.datasets?.length ? params.datasets : Object.keys(DATASETS)) as AiEvalDatasetName[];
  const reports = datasetNames.map((name) => buildDatasetReport(name, DATASETS[name] ?? []));
  const totalCases = reports.reduce((sum, item) => sum + item.total, 0);
  const passedCases = reports.reduce((sum, item) => sum + item.passed, 0);
  const scoreCount = reports.reduce((sum, item) => sum + item.total, 0);
  const scoreSum = reports.reduce((sum, item) => sum + item.averageScore * item.total, 0);
  const highRiskCount = reports.reduce((sum, item) => sum + item.highRiskCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    datasets: reports,
    summary: {
      totalCases,
      passedCases,
      passRate: totalCases ? round((passedCases / totalCases) * 100, 2) : 0,
      averageScore: scoreCount ? round(scoreSum / scoreCount, 2) : 0,
      highRiskCount
    }
  };
}

