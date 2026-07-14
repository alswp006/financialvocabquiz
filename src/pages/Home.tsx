import { useState } from 'react';
import { Top, Paragraph, Spacing, Chip, AlertDialog } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { SubmitFooter } from '../components/BottomCTA';
import { useAppStore } from '../store/AppStore';
import { getQuizBankIndex } from '../lib/quizBank/index';
import { resetUserProgress } from '../lib/storage/userProgress';
import type { Difficulty, RouteState } from '../lib/types';

const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string }> = [
  { value: 'BEGINNER', label: '초급' },
  { value: 'INTERMEDIATE', label: '중급' },
  { value: 'ADVANCED', label: '고급' },
];

/** SDK는 WebView 밖에서 throw하므로 가드 필수 — Chip 선택 시 tickWeak 햅틱. */
function fireHaptic(type: 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* 브라우저/검수자 PC/jsdom — 무시 */
  }
}

export default function Home() {
  const navigate = useNavigate();
  const { needsRecoveryDialog, startTodaySession } = useAppStore();
  const [difficulty, setDifficulty] = useState<Difficulty>('BEGINNER');
  const [recoveryDialogDismissed, setRecoveryDialogDismissed] = useState(false);

  const quizBankIndex = getQuizBankIndex();
  const pool = quizBankIndex.byDifficulty[difficulty] ?? [];
  const insufficientQuestions = pool.length < 3;

  const handleSelectDifficulty = (value: Difficulty) => {
    fireHaptic('tickWeak');
    setDifficulty(value);
  };

  const handleStart = () => {
    if (insufficientQuestions) return;
    startTodaySession(difficulty);
    // NOTE: RouteState['/quiz'] in types.ts is currently { sessionId } (stale vs. spec),
    // so this intentionally isn't cast — AC-1 requires { difficulty } here.
    navigate('/quiz', { state: { difficulty } });
  };

  const handleRecover = () => {
    resetUserProgress();
    setRecoveryDialogDismissed(true);
    navigate('/', { state: { recovered: true } satisfies RouteState['/'] });
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>금융 퀴즈</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label="오늘 퀴즈 시작"
          onClick={handleStart}
          disabled={insufficientQuestions}
        />
      }
    >
      <Card testId="home-difficulty-card">
        <Paragraph.Text typography="st1">난이도를 선택하세요</Paragraph.Text>
        <Spacing size={12} />
        <div style={{ display: 'flex', gap: 8 }}>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              variant={difficulty === opt.value ? 'fill' : 'weak'}
              onClick={() => handleSelectDifficulty(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
        <Spacing size={16} />
        <Paragraph.Text typography="st13">오늘의 퀴즈는 3문제입니다.</Paragraph.Text>
        {insufficientQuestions && (
          <>
            <Spacing size={8} />
            <Paragraph.Text typography="st13">
              문제가 아직 준비되지 않았어요. 다른 난이도를 선택해주세요.
            </Paragraph.Text>
          </>
        )}
      </Card>

      <Spacing size={96} />

      <AlertDialog
        open={needsRecoveryDialog && !recoveryDialogDismissed}
        title="데이터 복구가 필요해요"
        description="저장된 데이터를 불러오지 못했어요. 데이터를 초기화하면 다시 시작할 수 있어요."
        onClose={() => setRecoveryDialogDismissed(true)}
        alertButton={
          <AlertDialog.AlertButton onClick={handleRecover}>
            데이터 초기화로 복구
          </AlertDialog.AlertButton>
        }
      />
    </ScreenScaffold>
  );
}
