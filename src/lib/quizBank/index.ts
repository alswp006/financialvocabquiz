import type { QuizQuestion, Difficulty } from "@/lib/types";
import { QUIZ_BANK } from "./data";

export interface QuizBankIndex {
  byId: Record<string, QuizQuestion>;
  byDifficulty: {
    BEGINNER: QuizQuestion[];
    INTERMEDIATE: QuizQuestion[];
    ADVANCED: QuizQuestion[];
  };
}

let cachedIndex: QuizBankIndex | null = null;

export function getQuizBankIndex(): QuizBankIndex {
  if (cachedIndex) {
    return cachedIndex;
  }

  const byId: Record<string, QuizQuestion> = {};
  const byDifficulty: Record<Difficulty, QuizQuestion[]> = {
    BEGINNER: [],
    INTERMEDIATE: [],
    ADVANCED: [],
  };

  for (const question of QUIZ_BANK) {
    byId[question.id] = question;
    byDifficulty[question.difficulty].push(question);
  }

  cachedIndex = {
    byId,
    byDifficulty: byDifficulty as {
      BEGINNER: QuizQuestion[];
      INTERMEDIATE: QuizQuestion[];
      ADVANCED: QuizQuestion[];
    },
  };

  return cachedIndex;
}
