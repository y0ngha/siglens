import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { useId, type ReactNode } from 'react';
import { formatSnapshotAsOf } from '@/shared/lib/formatSnapshotAsOf';
import type { MarketProfileId } from '@/shared/config/marketProfile';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface SnapshotSummarySectionProps {
    /** 섹션 헤딩 텍스트. 생략 시 "최근 분석 요약". */
    title?: string;
    /** 캡션에 노출되는 심볼 표시명(예: "Apple Inc."). */
    displayName: string;
    /**
     * 캡션 문구·타임존을 고르는 데 쓴다(`AS_OF_CAPTION_COPY`, `formatSnapshotAsOf`).
     * 필수 prop이고 안전한 기본값이 없다 — 이 셸은 us-equity·kr-equity·crypto
     * 페이지 전부에서 렌더되므로, 생략하면 항상 미국 장마감으로 잘못 캡션되는
     * SEO 감사 실측 결함(2026-08-18: KR·crypto 페이지가 "미국 장마감 기준"을
     * 자처)이 그대로 재발한다.
     */
    marketProfile: MarketProfileId;
    /**
     * 스냅샷 행의 `generatedAt`. 있으면 h2 옆에 "지난 AI 분석" 배지를 렌더하고
     * 캡션에 실제 기준일을 노출한다. 없으면 시장별 고정 캡션으로 폴백한다(배지
     * 없음) — `AS_OF_CAPTION_COPY[marketProfile].fallback`.
     */
    asOf?: Date;
    children: ReactNode;
}

/**
 * 기준일 캡션의 시장별 문구.
 *
 * `fallback`은 `asOf`가 없을 때 쓰는 완결된 문장, `suffix`는 `asOf`가 있을 때
 * `formatSnapshotAsOf`가 포맷한 날짜 뒤에 붙는 접미사다. crypto는 정규장 마감이
 * 없는 24/7 시장이라 "장마감"이라는 말 자체가 성립하지 않으므로 "UTC 기준"으로
 * 대체한다. `Record<MarketProfileId, …>`라 세 값을 모두 채우지 않으면 컴파일이
 * 막힌다 — `marketProfile`은 항상 타입이 보장된 값이라(런타임 미신뢰 입력이
 * 아니다) `sessionSpecFor`류의 `_exhaustive: never` 런타임 가드는 불필요하다.
 */
/**
 * 캡션 문구는 **카탈로그 키**로 들고 있는다.
 *
 * 날짜만 로케일화하고 이 접미사를 한국어로 두면 `/en/AAPL`이
 * `August 18, 2026 미국 장마감 기준`으로 나온다 — 통째로 한국어일 때보다
 * 나쁘게 읽힌다(반쪽 번역이 만드는 전형적 결함).
 */
const AS_OF_CAPTION_KEY: Record<
    MarketProfileId,
    { fallback: string; suffix: string }
> = {
    'us-equity': {
        fallback: 'SnapshotSummarySection.asOfUsEquityFallback',
        suffix: 'SnapshotSummarySection.asOfUsEquity',
    },
    'kr-equity': {
        fallback: 'SnapshotSummarySection.asOfKrEquityFallback',
        suffix: 'SnapshotSummarySection.asOfKrEquity',
    },
    crypto: {
        fallback: 'SnapshotSummarySection.asOfCryptoFallback',
        suffix: 'SnapshotSummarySection.asOfCrypto',
    },
};

/**
 * pre-warm된 SEO 분석 스냅샷의 프로즈 콘텐츠를 감싸는 재사용 셸.
 *
 * audit fix FIX 4: 카드 셸은 `TechnicalFactsSummary`(Suspense-fallback
 * 대역이라 `bg-secondary-800 rounded-lg p-4`가 정당화되는 예외 케이스)가
 * 아니라, 이 섹션들이 실제로 나란히 놓이는 제품 전역 우세 패턴(67곳)인
 * `border-secondary-700 bg-secondary-800 rounded-lg border p-6`을 따른다 —
 * 이전 셸은 소수 패턴(5곳)이라 이 섹션들이 주변 카드보다 부실해 보였다.
 * 순수 프레젠테이션 서버 컴포넌트다 — 'use client' 없음, 데이터 페칭 없음,
 * request context 접근 없음.
 *
 * 프레임은 항상 그린다: 스냅샷·프로즈 존재 여부 판단은 호출부 책임이다.
 * 프로즈가 없을 때 빈 셸을 렌더하지 않으려면 호출부가 이 컴포넌트를 아예
 * 마운트하지 않아야 한다(예: `TechnicalSnapshotProse`가 summary 부재 시
 * `null`을 반환해 이 셸을 감싸지 않는 것과 동일한 계약).
 *
 * 캡션은 `asOf`가 주어지면 스냅샷 행의 실제 기준일(`formatSnapshotAsOf`로
 * `marketProfile`의 타임존으로 포맷)을 노출하고, 없으면 `marketProfile`별 고정
 * 캡션(`AS_OF_CAPTION_COPY[marketProfile].fallback`)으로 폴백한다. 두 경로 모두
 * 렌더 중 `new Date()`를 호출하지 않는다 — `asOf`는 항상 DB 행의 `generatedAt`
 * 에서 와야 하며, 그래야 같은 캐시 엔트리가 재검증 시점과 무관하게 항상 같은
 * 문자열을 렌더한다(결정적 출력 유지, cold-gen dynamic API 회피).
 *
 * A1(감사): `formatSnapshotAsOf`는 Invalid Date에 `null`을 반환한다(throw하지
 * 않음). 배지("지난 AI 분석")와 캡션 문구는 반드시 같은 조건에서 갈려야 한다 —
 * 그래서 포맷된 문자열을 먼저 계산해두고, `null`을 `asOf === undefined`와
 * 완전히 동일하게 취급한다. 조건이 갈라지면 배지는 뜨는데 캡션은 고정 문구인
 * (또는 그 반대인) 자기모순적 렌더가 생긴다.
 *
 * SEO 감사(2026-08-18): 이전에는 캡션이 "미국 장마감 기준"으로 하드코딩돼
 * 있었다 — 한국 주식·크립토 페이지도 미국 장마감을 자처했고, America/New_York
 * 고정 타임존이 표시 날짜를 하루 밀거나 당길 수도 있었다. `marketProfile`을
 * 스레딩해 라벨과 타임존을 시장에 맞게 고른다.
 */
export function SnapshotSummarySection({
    title,
    displayName,
    marketProfile,
    asOf,
    children,
}: SnapshotSummarySectionProps) {
    const t = useTranslations('views.symbol');
    // 기본값을 파라미터 자리에 둘 수 없다 — 컴포넌트 본문 밖이라 훅이 아직 없다.
    const tMisc = useTranslations('shared.ui.misc');
    const resolvedTitle = title ?? tMisc('recentSummary');
    const locale = useResolvedLocale();
    const headingId = useId();
    const formattedAsOf =
        asOf === undefined
            ? null
            : formatSnapshotAsOf(asOf, marketProfile, locale);
    const captionKey = AS_OF_CAPTION_KEY[marketProfile];
    const caption =
        formattedAsOf === null
            ? `${displayName} · ${t(captionKey.fallback)}`
            : `${displayName} · ${formattedAsOf} ${t(captionKey.suffix)}`;

    return (
        <section
            aria-labelledby={headingId}
            className="flex flex-col gap-4 rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <div className="flex flex-col gap-1">
                {/*
                 * audit fix FIX 5: 헤딩 램프가 역전돼 있었다 — 이 h2가
                 * text-secondary-200/text-sm이고, 각 렌더러 내부 h3들이
                 * text-secondary-100/text-sm이라 h3가 자기 h2보다 더 밝고
                 * 같은 크기였다. 제품의 다른 카드 h2 컨벤션(text-lg
                 * font-semibold tracking-tight)으로 맞추고, h3는
                 * text-secondary-200(DESIGN.md:363 "subsection headers are
                 * neutral text-secondary-200")으로 낮춘다 — h3 쪽은 각
                 * *SnapshotProse.tsx 렌더러에서 처리.
                 */}
                <div className="flex flex-wrap items-center gap-2">
                    <h2 id={headingId} className={HEADING_SECTION}>
                        {resolvedTitle}
                    </h2>
                    {formattedAsOf !== null && (
                        <span className="rounded-full border border-secondary-600 bg-secondary-900/60 px-2 py-0.5 text-xs font-medium text-secondary-300">
                            {t('SnapshotSummarySection.220156')}
                        </span>
                    )}
                </div>
                <p className="text-xs text-secondary-400">{caption}</p>
            </div>
            {children}
        </section>
    );
}
