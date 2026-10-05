import { useTranslations } from 'next-intl';
import type { SnapshotConfidence } from '@/shared/lib/types';

interface SampleFooterTextProps {
    confidence: SnapshotConfidence;
    /** 점수를 매기는 데 쓴 거래일 수. */
    sampleSize: number;
}

/**
 * 공포·탐욕 점수 하단의 표본 안내 **문장만** 낸다(래퍼 요소는 호출부가 정한다).
 *
 * 종목 탭(`FearGreedPage`·`FearGreedFactsSummary`)과 시장 탭(`MarketFearGreedPage`)이 같은
 * 두 문장을 쓴다 — 정상이면 "지난 N거래일과 비교해 매긴 점수예요", 제한이면 "비교할 기록이
 * N거래일뿐이라 점수가 덜 정확할 수 있어요". 세 곳에 삼항을 복제하면 문구·분기가 따로 갈라진다.
 *
 * `'use client'`를 두지 않는다: `useTranslations`는 서버 컴포넌트에서도 동작하므로(next-intl
 * `react-server` 진입점) 서버인 `FearGreedFactsSummary`와 클라이언트인 `FearGreedPage` 양쪽에서
 * 같은 컴포넌트를 쓴다. 번역자 호출을 리터럴로 이 파일에 두어야 추출기가 키를 라우트에 싣는다.
 */
export function SampleFooterText({
    confidence,
    sampleSize,
}: SampleFooterTextProps) {
    const t = useTranslations('shared.lib.fearGreed');
    return (
        <>
            {confidence === 'normal'
                ? t('sampleFooterNormal', { v0: sampleSize })
                : t('sampleFooterLimited', { v0: sampleSize })}
        </>
    );
}
