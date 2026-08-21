import { useTranslations } from 'next-intl';
import type { NewsSentiment } from '@y0ngha/siglens-core';
import { SnapshotSummarySection } from '../SnapshotSummarySection';
import { SnapshotBulletList } from '../SnapshotBulletList';
import { stripSnapshotMarkdown } from '../lib/stripSnapshotMarkdown';
import { createEnumGuard } from '../lib/createEnumGuard';
import { narrowStringArray } from '../lib/narrowStringArray';
import type { MarketProfileId } from '@/shared/config/marketProfile';

interface NewsSnapshotProseProps {
    /**
     * `seo_analysis_snapshots.content` — 저장소에는 `unknown`으로 보관된다
     * (harvest.ts가 `prewarmNews`(→core `submitNewsAnalysis`)의
     * `status==='cached'` 분기에서 얻은 `result.result: NewsAnalysisResponse`를
     * 그대로 저장, `src/entities/news-article/api.ts`).
     * 여기서 다시 방어적으로 좁힌다.
     *
     * `FundamentalSnapshotProse`와 같은 이유로 이 값은 core
     * `filterAnalysisResult`(technical 전용 info-depth 필드 마스킹)의 대상이
     * 아니다 — news submit 경로(`submitNewsAnalysis.js`)는 `tier`를 BYOK
     * 게이트·usage 한도·스킬 샘플링·캐시 키에만 사용하고, 응답 필드 자체를
     * tier로 마스킹하는 코드 경로가 없다. free tier로 pre-warm해도 전 필드가
     * 그대로 채워진다.
     */
    content: unknown;
    symbol: string;
    displayName: string;
    /**
     * news 탭은 us-equity·kr-equity·crypto 전부 렌더한다 — `SnapshotSummarySection`
     * 셸의 캡션·타임존이 시장에 맞게 갈리도록 호출부가 반드시 실제 값을 넘긴다.
     */
    marketProfile: MarketProfileId;
    /** 스냅샷 행의 `generatedAt`. 셸이 기준일 캡션과 "지난 AI 분석" 배지를 렌더하는 데 쓴다. */
    generatedAt?: Date;
}

/** NewsSentiment → `shared.enumLabel` 카탈로그 키. 값 자체는 더 이상 한글이 아니다 — 렌더 시점에 `tLabel`로 조회한다. */
const SENTIMENT_LABEL_KEY: Record<NewsSentiment, string> = {
    bullish: 'sentiment.bullish',
    neutral: 'sentiment.neutral',
    bearish: 'sentiment.bearish',
};

// See createEnumGuard's JSDoc for the Object.hasOwn / prototype-chain
// rationale (audit fix; PR #698 round-2 review FIX 3 extracted the shared
// implementation).
const isSentiment = createEnumGuard(SENTIMENT_LABEL_KEY);

interface NarrowedNewsContent {
    currentDriverKo: string;
    overallSentiment: NewsSentiment | null;
    keyEventsKo: string[];
    upcomingEventsKo: string[];
}

/**
 * `content`를 news 결과 모양으로 좁힌다.
 *
 * `currentDriverKo`(현재 가격 동인 설명 문단), `keyEventsKo`(핵심 이벤트
 * 목록), `upcomingEventsKo`(다가오는 주요 일정 목록)가 프로즈 소스다. 이
 * 응답은 tier 마스킹을 거치지 않으므로 세 필드 전부 값이 채워질 수 있다.
 */
function narrowNewsContent(content: unknown): NarrowedNewsContent | null {
    if (typeof content !== 'object' || content === null) return null;

    const record = content as Record<string, unknown>;
    const currentDriverKo =
        typeof record.currentDriverKo === 'string'
            ? stripSnapshotMarkdown(record.currentDriverKo).trim()
            : '';
    const overallSentiment = isSentiment(record.overallSentiment)
        ? record.overallSentiment
        : null;

    const keyEventsKo = narrowStringArray(record.keyEventsKo);
    const upcomingEventsKo = narrowStringArray(record.upcomingEventsKo);

    if (
        currentDriverKo.length === 0 &&
        keyEventsKo.length === 0 &&
        upcomingEventsKo.length === 0
    ) {
        return null;
    }

    return { currentDriverKo, overallSentiment, keyEventsKo, upcomingEventsKo };
}

/**
 * `news/page.tsx`가 `<NewsSnapshotProse>`를 렌더할지 아니면 클라이언트 AI
 * 위젯(`NewsAiSummary`)을 렌더할지 판단하는 예측기(audit fix FIX 2 —
 * `OverallSnapshotProse.hasOverallProse` 패턴). 두 소스가 같은 필드
 * (currentDriverKo/keyEventsKo/upcomingEventsKo)를 같은 순서로 중복 렌더하던
 * 문제를 XOR 게이팅으로 해소한다. (결정론적 `NewsFactsSummary`는 이 게이트
 * 대상이 아니다 — AI 결론이 아니라 DB 뉴스 목록 사실이라 중복이 아니다.)
 *
 * `narrowNewsContent`를 그대로 재사용해 이 예측기와 컴포넌트가 서로 다른
 * 판단을 내릴 수 없게 한다(단일 진실 소스).
 */
export function hasNewsProse(content: unknown): boolean {
    return narrowNewsContent(content) !== null;
}

/**
 * SEO pre-warm 스냅샷의 news 탭 프로즈 렌더러 — Task 6, 마지막(일곱 번째) 탭
 * 렌더러. `currentDriverKo`를 문단으로(`\n` 기준 분리), `overallSentiment`가
 * 있으면 리드 문구로, `keyEventsKo`를 핵심 이벤트 목록으로,
 * `upcomingEventsKo`를 다가오는 주요 일정 목록으로 렌더한다.
 *
 * 네 프로즈 소스 중 단 하나도 값이 없으면 아무것도 렌더하지 않아 — 빈 셸
 * 없이 — 호출부가 기존 placeholder로 폴백하도록 한다. UA 분기 없음 —
 * 사용자·크롤러에게 동일한 마크업(cloaking-safe).
 */
export function NewsSnapshotProse({
    content,
    symbol,
    displayName,
    marketProfile,
    generatedAt,
}: NewsSnapshotProseProps) {
    const t = useTranslations('views.symbol');
    const tLabel = useTranslations('shared.enumLabel');
    const narrowed = narrowNewsContent(content);
    if (narrowed === null) return null;

    const driverParagraphs = narrowed.currentDriverKo
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    return (
        <SnapshotSummarySection
            title={t('NewsSnapshotProse.23befe')}
            displayName={displayName}
            marketProfile={marketProfile}
            asOf={generatedAt}
        >
            <div className="space-y-4 text-sm leading-6 text-secondary-300">
                {narrowed.overallSentiment !== null && (
                    <p className="font-medium text-secondary-200">
                        {t('NewsSnapshotProse.0e9c3d', {
                            v0: symbol,
                            v1: tLabel(
                                SENTIMENT_LABEL_KEY[narrowed.overallSentiment]
                            ),
                        })}
                    </p>
                )}

                {driverParagraphs.length > 0 && (
                    <div className="space-y-2">
                        {driverParagraphs.map((line, i) => (
                            <p key={`line-${i}-${line}`}>{line}</p>
                        ))}
                    </div>
                )}

                <SnapshotBulletList
                    title={t('NewsSnapshotProse.d65c2f')}
                    symbol={symbol}
                    ariaSuffix={t('NewsSnapshotProse.d65c2f')}
                    items={narrowed.keyEventsKo}
                    keyPrefix="event"
                />
                <SnapshotBulletList
                    title={t('NewsSnapshotProse.1244e3')}
                    symbol={symbol}
                    ariaSuffix={t('NewsSnapshotProse.1244e3')}
                    items={narrowed.upcomingEventsKo}
                    keyPrefix="upcoming"
                />
            </div>
        </SnapshotSummarySection>
    );
}
