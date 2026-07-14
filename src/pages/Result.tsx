import { useState } from 'react';
import { Top, Paragraph, Spacing, Button, AlertDialog, Toast } from '@toss/tds-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { SummaryHero } from '../components/SummaryHero';
import { CountUp } from '../components/CountUp';
import { TossRewardAd } from '../components/TossRewardAd';
import { useAppStore } from '../store/AppStore';
import { findSessionBySessionId } from '../lib/storage/dailySessions';
import { getQuizBankIndex } from '../lib/quizBank/index';
import { submitWeeklyLeaderboard } from '../lib/api/leaderboard';
import { getISOWeekId } from '../lib/time';
import type { RouteState } from '../lib/types';

const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 10;

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProgress } = useAppStore();

  const [explanationUnlocked, setExplanationUnlocked] = useState(false);
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; text: string }>({ open: false, text: '' });

  const routeState = (location.state as RouteState['/result']) ?? null;
  const sessionId = routeState?.sessionId;
  const foundSession = sessionId ? findSessionBySessionId(sessionId) : null;
  const session = foundSession && foundSession.status === 'COMPLETED' ? foundSession : null;

  const topBar = <Top title={<Top.TitleParagraph>결과</Top.TitleParagraph>} />;

  if (!session) {
    return (
      <ScreenScaffold top={topBar}>
        <Card testId="result-error-card">
          <Paragraph.Text typography="t4">결과를 찾지 못했어요</Paragraph.Text>
          <Spacing size={16} />
          <Button variant="fill" display="block" onClick={() => navigate('/')}>
            홈으로
          </Button>
        </Card>
      </ScreenScaffold>
    );
  }

  const bank = getQuizBankIndex();
  const nickname = userProgress?.nickname ?? '';
  const nicknameValid =
    nickname.length >= NICKNAME_MIN_LENGTH && nickname.length <= NICKNAME_MAX_LENGTH;

  const showToast = (text: string) => setToast({ open: true, text });

  const handleSubmitRanking = async () => {
    if (!userProgress || !nicknameValid) {
      setNicknameDialogOpen(true);
      return;
    }
    setSubmitLoading(true);
    const weekId = getISOWeekId(new Date(session.completedAtISO));
    const result = await submitWeeklyLeaderboard({
      weekId,
      clientId: userProgress.id,
      nickname,
      weeklyIqDelta: session.score.iqDelta,
    });
    setSubmitLoading(false);
    if (result.data) {
      showToast(`이번 주 랭킹 ${result.data.rank}위`);
    } else {
      showToast('랭킹 제출에 실패했어요');
    }
  };

  return (
    <ScreenScaffold top={topBar}>
      <SummaryHero
        testId="result-summary-card"
        label="이번 퀴즈 결과"
        value={<CountUp value={session.score.iqDelta} unit=" IQ 획득" typography="t1" />}
        caption={`정답 ${session.score.correctCount}/3개`}
      />

      <Spacing size={16} />

      <Button variant="fill" display="block" onClick={handleSubmitRanking} disabled={submitLoading}>
        주간 랭킹에 반영하기
      </Button>

      <Spacing size={24} />

      <div data-testid="explanation-section">
        <Paragraph.Text typography="st1">문제 해설</Paragraph.Text>
        <Spacing size={8} />
        <TossRewardAd
          slotId="result-explanation"
          description="광고를 시청하면 해설을 볼 수 있어요"
          buttonText="해설 보기"
          onRewarded={() => setExplanationUnlocked(true)}
          onWatchFailed={() => showToast('광고 시청 후 해설을 볼 수 있어요')}
        >
          {explanationUnlocked ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {session.questionIds.map((questionId) => {
                const question = bank.byId[questionId];
                if (!question) return null;
                return (
                  <Card key={questionId} testId="explanation-card">
                    <Paragraph.Text typography="st1">{question.term}</Paragraph.Text>
                    <Spacing size={8} />
                    <Paragraph.Text typography="t5">{question.explanation}</Paragraph.Text>
                  </Card>
                );
              })}
            </div>
          ) : null}
        </TossRewardAd>
      </div>

      <Spacing size={96} />

      <AlertDialog
        open={nicknameDialogOpen}
        title="닉네임을 설정해 주세요"
        description="주간 랭킹 제출을 위해 2~10자 닉네임이 필요해요."
        onClose={() => setNicknameDialogOpen(false)}
        alertButton={
          <AlertDialog.AlertButton
            onClick={() => {
              setNicknameDialogOpen(false);
              navigate('/settings');
            }}
          >
            설정으로 이동
          </AlertDialog.AlertButton>
        }
      />

      <Toast
        open={toast.open}
        text={toast.text}
        position="bottom"
        onClose={() => setToast((s) => ({ ...s, open: false }))}
      />
    </ScreenScaffold>
  );
}
