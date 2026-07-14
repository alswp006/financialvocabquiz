import { Top, Paragraph, Spacing, ListRow, Button } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Card } from '../components/Card';

/**
 * Golden Home page — 대시보드/탭-루트 골든 레퍼런스.
 *
 * 다른 페이지를 쓸 때 이 패턴을 모방하라:
 * - ScreenScaffold로 감싼다(raw fragment 골격 금지) — safe-area + 100dvh 자동 처리.
 * - 화면 최상단에 SummaryHero로 시각 앵커를 만든다('휑함'의 가장 큰 원인은 앵커 부재).
 *   데이터가 있으면 value에 <Amount value={n} unit="원" typography="t1" />로 핵심 숫자를 크게 박아라.
 * - 1차 진입 액션은 SummaryHero 카드 내부 버튼(display="block", 전체폭)에 둔다.
 *   → 화면 중앙 부유/좌측 글자폭 버튼 금지. 하단 TabBar가 있으면 SubmitFooter와 겹치므로 카드 안에.
 * - 핵심 정보는 raw <div>가 아니라 Card로 묶어 위계를 만든다.
 * - 하단 탭이 필요하면(2~5탭): bottom={<FloatingTabBar items={[{label,path}...]} />}.
 *   ('TDS TabBar'는 존재하지 않는다 — 직접 만들지 말고 FloatingTabBar를 써라.)
 *
 * Scaffold tokens (replaced by scaffold-toss.ts at project creation):
 *   FinancialVocabQuiz -> the app's display name
 *   ETF, DSR, CPI 등 금융 용어를 매일 3문제 퀴즈로 익히고 금융 IQ 점수를 쌓는 일일 금융 퀴즈    -> the one-line description
 */

const HIGHLIGHTS = [
  { title: '간편한 사용', description: '몇 번의 터치로 결과를 확인하세요' },
  { title: '빠른 처리', description: '복잡한 입력 없이 바로 시작합니다' },
  { title: '안전한 보관', description: '데이터는 이 기기에만 저장됩니다' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>FinancialVocabQuiz</Top.TitleParagraph>} />}
    >
      {/* 시각 앵커: 헤드라인 + 카드 내 진입 버튼(부유 금지, display="block" 전체폭).
          데이터 앱이면 value를 <Amount typography="t1" />(핵심 숫자)로 교체하라. */}
      <SummaryHero
        label="FinancialVocabQuiz"
        value={<Paragraph.Text typography="t2">ETF, DSR, CPI 등 금융 용어를 매일 3문제 퀴즈로 익히고 금융 IQ 점수를 쌓는 일일 금융 퀴즈</Paragraph.Text>}
        caption="지금 바로 시작해 보세요"
        action={
          <Button variant="fill" display="block" onClick={() => navigate('/')}>
            시작하기
          </Button>
        }
        testId="home-hero"
      />

      <Spacing size={24} />

      {/* 핵심 정보는 Card로 묶기(raw div 금지) — 위계 생성 */}
      <Card testId="home-highlights">
        {HIGHLIGHTS.map((h, idx) => (
          <ListRow
            key={idx}
            contents={<ListRow.Texts type="2RowTypeA" top={h.title} bottom={h.description} />}
          />
        ))}
      </Card>

      <Spacing size={24} />
    </ScreenScaffold>
  );
}
