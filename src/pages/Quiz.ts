// Real implementation lives here (.ts, not .tsx) — Vite/TS resolve ".ts" before
// ".tsx", and this sandbox cannot delete files, so Quiz.tsx exists as a
// superseded stub that would otherwise shadow this file. JSX syntax isn't
// valid in a .ts file, so this uses React.createElement directly — same
// pattern as src/store/AppStore.ts.
import React, { useEffect, useRef, useState } from 'react';
import { Top, Paragraph, Spacing, ListRow, Button, Skeleton } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { useAppStore } from '../store/AppStore';
import { getQuizBankIndex } from '../lib/quizBank/index';
import type { RouteState } from '../lib/types';

export default function Quiz() {
  const navigate = useNavigate();
  const { currentSession, answerQuestion } = useAppStore();
  const navigatedRef = useRef(false);
  const [lockedQuestionId, setLockedQuestionId] = useState<string | null>(null);

  const isCompleted = currentSession?.status === 'COMPLETED';

  useEffect(() => {
    if (isCompleted && currentSession && !navigatedRef.current) {
      navigatedRef.current = true;
      const state: RouteState['/result'] = { sessionId: currentSession.sessionId };
      navigate('/result', { state });
    }
  }, [isCompleted, currentSession, navigate]);

  const topBar = (title: string) =>
    React.createElement(Top, { title: React.createElement(Top.TitleParagraph, null, title) });

  if (!currentSession) {
    return React.createElement(ScreenScaffold, {
      top: topBar('퀴즈'),
      children: React.createElement(
        'div',
        { 'aria-busy': 'true' },
        React.createElement(Skeleton, null),
        React.createElement(Spacing, { size: 12 }),
        React.createElement(Skeleton, null),
        React.createElement(Spacing, { size: 12 }),
        React.createElement(Skeleton, null),
      ),
    });
  }

  if (isCompleted) {
    // useEffect above navigates to /result — render nothing during the transition.
    return null;
  }

  const bank = getQuizBankIndex();
  const currentIndex = currentSession.answers.length;
  const questionId = currentSession.questionIds[currentIndex];
  const question = questionId ? bank.byId[questionId] : undefined;

  if (!question) {
    return React.createElement(ScreenScaffold, {
      top: topBar('퀴즈'),
      children: React.createElement(Card, {
        testId: 'quiz-error-card',
        children: [
          React.createElement(Paragraph.Text, { key: 'msg', typography: 't4' }, '문제를 불러오지 못했어요'),
          React.createElement(Spacing, { key: 'sp', size: 16 }),
          React.createElement(
            Button,
            { key: 'cta', variant: 'fill', display: 'block', onClick: () => navigate('/') },
            '홈으로',
          ),
        ],
      }),
    });
  }

  const handleSelect = (selectedIndex: 0 | 1 | 2 | 3) => {
    // Duplicate-tap guard: once this question is locked, further clicks no-op
    // until the store's currentSession advances to the next question.
    if (lockedQuestionId === questionId) return;
    setLockedQuestionId(questionId);
    answerQuestion(questionId, selectedIndex);
  };

  return React.createElement(ScreenScaffold, {
    top: topBar(`${currentIndex + 1}/3`),
    children: [
      React.createElement(Paragraph.Text, { key: 'term', typography: 'st1' }, question.term),
      React.createElement(Spacing, { key: 'sp1', size: 8 }),
      React.createElement(Paragraph.Text, { key: 'prompt', typography: 't4' }, question.prompt),
      React.createElement(Spacing, { key: 'sp2', size: 16 }),
      React.createElement(
        'div',
        { key: 'choices', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        ...question.choices.map((choice, idx) =>
          React.createElement(ListRow, {
            key: idx,
            'data-testid': 'quiz-choice',
            contents: React.createElement(ListRow.Texts, { type: '1RowTypeA', top: choice }),
            onClick: () => handleSelect(idx as 0 | 1 | 2 | 3),
          }),
        ),
      ),
    ],
  });
}
