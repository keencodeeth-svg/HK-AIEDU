import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type ProgressModule = typeof import("../../lib/progress");

const MODULE_TARGETS = [
  "../../lib/progress",
  "../../lib/storage",
  "../../lib/content",
  "../../lib/db",
  "../../lib/reviews",
  "../../lib/focus",
  "../../lib/favorites",
  "../../lib/review-scheduler"
] as const;

function resetModules() {
  for (const target of MODULE_TARGETS) {
    try {
      delete require.cache[require.resolve(target)];
    } catch {
      // ignore cache misses
    }
  }
}

function loadProgressModule(stubs: Record<string, Record<string, unknown>> = {}) {
  resetModules();

  const storage = require("../../lib/storage") as Record<string, unknown>;
  const content = require("../../lib/content") as Record<string, unknown>;
  const db = require("../../lib/db") as Record<string, unknown>;
  const reviews = require("../../lib/reviews") as Record<string, unknown>;
  const focus = require("../../lib/focus") as Record<string, unknown>;
  const favorites = require("../../lib/favorites") as Record<string, unknown>;
  const reviewScheduler = require("../../lib/review-scheduler") as Record<string, unknown>;

  Object.assign(storage, {
    readJson: () => [],
    writeJson: () => {}
  });
  Object.assign(content, {
    getKnowledgePoints: async () => [],
    getQuestions: async () => []
  });
  Object.assign(db, {
    isDbEnabled: () => true,
    assertDatabaseEnabled: () => {},
    requireDatabaseEnabled: () => {},
    query: async () => [],
    queryOne: async () => null
  });
  Object.assign(reviews, {
    getReviewItemsByStudent: async () => []
  });
  Object.assign(focus, {
    getFocusSessionsByUser: async () => []
  });
  Object.assign(favorites, {
    getFavoritesByUser: async () => []
  });
  Object.assign(reviewScheduler, {
    scheduleReviewTasksAfterAttempt: async () => ({})
  });

  for (const [moduleName, overrides] of Object.entries(stubs)) {
    const target =
      moduleName === "storage"
        ? storage
        : moduleName === "content"
          ? content
          : moduleName === "db"
            ? db
            : moduleName === "reviews"
              ? reviews
              : moduleName === "focus"
                ? focus
                : moduleName === "favorites"
                  ? favorites
                  : reviewScheduler;
    Object.assign(target, overrides);
  }

  return require("../../lib/progress") as ProgressModule;
}

afterEach(() => {
  resetModules();
});

test("addAttempt skips review scheduling when skipReviewScheduling is enabled", async () => {
  let scheduled = false;
  const progress = loadProgressModule({
    reviewScheduler: {
      scheduleReviewTasksAfterAttempt: async () => {
        scheduled = true;
        return {};
      }
    }
  });

  await progress.addAttempt(
    {
      id: "attempt-1",
      userId: "user-1",
      questionId: "study-variant:1",
      subject: "math",
      knowledgePointId: "kp-1",
      correct: false,
      answer: "A",
      reason: "study-variant",
      createdAt: "2026-03-12T00:00:00.000Z"
    },
    { skipReviewScheduling: true }
  );

  assert.equal(scheduled, false);
});

test("addAttempt still schedules review tasks by default", async () => {
  let scheduled = false;
  const progress = loadProgressModule({
    reviewScheduler: {
      scheduleReviewTasksAfterAttempt: async () => {
        scheduled = true;
        return {};
      }
    }
  });

  await progress.addAttempt({
    id: "attempt-2",
    userId: "user-1",
    questionId: "q-1",
    subject: "math",
    knowledgePointId: "kp-1",
    correct: false,
    answer: "B",
    createdAt: "2026-03-12T00:00:00.000Z"
  });

  assert.equal(scheduled, true);
});
