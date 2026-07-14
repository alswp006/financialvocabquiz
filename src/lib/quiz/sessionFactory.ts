import type { Difficulty, DailyQuizSession, ISODateTimeString } from "@/lib/types";
import { getQuizBankIndex } from "@/lib/quizBank/index";
import { createId } from "@/lib/id";
import { nowISO } from "@/lib/time";

// Seeded random number generator for deterministic selection
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function createDailyQuizSession(
  clientId: string,
  dateISO: string,
  difficulty: Difficulty
): DailyQuizSession {
  const index = getQuizBankIndex();
  const availableQuestions = index.byDifficulty[difficulty];

  if (availableQuestions.length < 3) {
    throw new Error(
      `Not enough questions for ${difficulty}: ${availableQuestions.length} < 3`
    );
  }

  // Deterministic seed based on clientId + dateISO + difficulty
  const seed = simpleHash(clientId + dateISO + difficulty);

  // Select 3 unique questions deterministically
  const selectedIndices = new Set<number>();
  let attempt = 0;
  while (selectedIndices.size < 3 && attempt < 100) {
    const rand = seededRandom(seed + attempt);
    const index = Math.floor(rand * availableQuestions.length);
    selectedIndices.add(index);
    attempt++;
  }

  const questionIds = Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .slice(0, 3)
    .map((idx) => availableQuestions[idx].id) as [string, string, string];

  const now = nowISO() as ISODateTimeString;
  const sessionId = createId("session");

  const session: DailyQuizSession = {
    id: sessionId,
    sessionId,
    clientId,
    dateISO,
    difficulty,
    questionIds,
    status: "IN_PROGRESS",
    answers: [],
    score: {
      correctCount: 0,
      iqDelta: 0,
    },
    startedAtISO: now,
    completedAtISO: undefined,
    createdAtISO: now,
    updatedAtISO: now,
  };

  return session;
}
