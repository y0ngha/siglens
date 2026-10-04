import { useTranslations } from 'next-intl';
import { dataSourceLabelKey } from '@/shared/config/marketProfile/dataSourceLabel';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { METHODOLOGY_PATH, SITE_OPERATOR } from '@/shared/lib/legal';
import { LocaleLink } from '@/shared/ui/LocaleLink';

/**
 * `ai`: AI가 쓴 산문 아래 — 규칙으로 계산한 값을 AI가 문장으로 정리했고, 어떤 자동
 * 검사를 거치며 사람이 한 편씩 읽지는 않는다는 고지.
 * `rule-based`: 공포·탐욕 탭 — AI 서술이 없고 규칙 계산뿐이라는 고지.
 */
export type AnalysisProvenanceVariant = 'ai' | 'rule-based';

interface AnalysisProvenanceNoteProps {
    /** 데이터 출처 문구를 시장 프로필로 고른다(`dataSourceLabelKey`). */
    readonly marketProfile: MarketProfileId;
    readonly variant?: AnalysisProvenanceVariant;
}

/**
 * 링크 한 줄. 문장 속 인라인 링크로는 모바일 터치 영역 44px를 줄 수 없어(행간이 깨진다)
 * 문장 아래 별도 줄로 빼고 `min-h-11`을 준다. 포커스 링은 이웃 링크와 같은 모양이다.
 */
const LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 종목 산문 하단의 **출처 고지** — "누가·어떻게·무엇으로 만들었나"를 산문 바로 아래에서
 * 밝히고 `/methodology`로 건다. 금융(YMYL) 페이지에서 검색엔진과 독자가 보는 신뢰 신호다
 * — 2026-10-04 감사에서 종목 페이지에 출처·작성 방식 고지가 하나도 없었다(PR #935).
 *
 * 서버 안전 컴포넌트다 — 클라이언트 훅이 없다. 오류 신고는 `ContactDialog`(클라이언트)를
 * 이 서버 섹션 안에 올리지 않으려고 `mailto:` 앵커로 둔다. 기준 시각은 감싸는
 * 셸(`SnapshotSummarySection`)의 캡션이 이미 그리므로 여기서 반복하지 않는다.
 *
 * 문구는 코드 동작과 같아야 한다:
 *  - "쉽게 보기 글은 계산에 없는 가격이 섞이면 다시 쓰거나 그 문장을 뺀다" — 쉬운 설명
 *    출력 가드(재작성 1회 → 문장 제거 → 원본만 표시)와 같다. `/methodology#ai`의
 *    `check` 문단이 같은 동작을 자세히 적는다. 가드가 바뀌면 이 문구도 바꾼다.
 *  - "사람이 한 편씩 읽어 보지는 않는다" — 프리웜 크론이 생성한 글이 사람 검토 없이 나간다.
 *    (2026-10-04: 검수하지 않는다는 사실만 말하던 문구를, 실제로 하는 자동 검사를
 *    먼저 말하도록 바꿨다. 검토하지 않는다는 사실은 그대로 밝힌다.)
 *  - 데이터 출처 — `dataSourceLabelKey`가 시장 프로필의 실제 어댑터와 대응한다.
 *  - `rule-based`는 점수가 규칙 계산뿐이라는 말이다(`computeFearGreedIndex`, AI 호출 없음).
 *    공포·탐욕 점수는 뉴스를 읽지 않으므로 출처도 시세만 말한다(`'prices'` 범위).
 */
export function AnalysisProvenanceNote({
    marketProfile,
    variant = 'ai',
}: AnalysisProvenanceNoteProps) {
    const t = useTranslations('views.symbol.AnalysisProvenanceNote');
    const isAi = variant === 'ai';
    const source = t(
        dataSourceLabelKey(marketProfile, isAi ? 'analysis' : 'prices')
    );

    return (
        <div className="border-t border-secondary-700 pt-3">
            <p className="text-xs leading-5 text-secondary-400">
                {isAi ? t('aiBody', { source }) : t('ruleBody', { source })}
            </p>
            {/*
                목록(`ul`/`li`)이 아니라 평평한 링크 묶음이다 — 이 고지는 일곱 개 산문
                렌더러의 본문 아래에 붙는데, 렌더러들의 테스트와 스크린리더의 "목록 N개"
                집계가 `listitem` 수를 센다. 링크 한두 개를 목록으로 알릴 이유도 없다.
            */}
            <div className="flex flex-wrap gap-x-4 text-xs">
                {isAi ? (
                    <>
                        <LocaleLink
                            href={`${METHODOLOGY_PATH}#ai`}
                            prefetch={false}
                            className={LINK}
                        >
                            {t('methodLink')}
                        </LocaleLink>
                        <a
                            href={`mailto:${SITE_OPERATOR.email}`}
                            className={LINK}
                        >
                            {t('reportLink')}
                        </a>
                    </>
                ) : (
                    <LocaleLink
                        href={`${METHODOLOGY_PATH}#fear-greed`}
                        prefetch={false}
                        className={LINK}
                    >
                        {t('calcLink')}
                    </LocaleLink>
                )}
            </div>
        </div>
    );
}
