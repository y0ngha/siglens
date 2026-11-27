/**
 * 지표 카드·대순환 카드를 독자 언어로 풀어 쓰는 번역 컨텍스트를 묶는 훅.
 *
 * `'use client'`를 붙이지 않는다 — next-intl 훅만 쓰고 RSC 진입점에도 있어, 서버 컴포넌트(SEO
 * 스냅샷 산문)가 이 훅을 불러도 경계와 무관하다(`useSkillLabel`과 같은 이유).
 */
import { useFormatter, useTranslations } from 'next-intl';
import {
    formatReadingNumber,
    type ReadingRenderContext,
} from '../utils/renderIndicatorReading';

export function useReadingRenderContext(): ReadingRenderContext {
    const tReading = useTranslations('widgets.analysis.reading');
    const tLabel = useTranslations('shared.enumLabel');
    const formatter = useFormatter();
    // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접 호출하는 패턴"만 본다 —
    // 참조로 넘기면 `widgets.analysis.reading`·`shared.enumLabel`이 이 라우트의 클라이언트
    // 번들에서 빠진다. 얇은 위임 클로저로 호출을 이 파일에 남긴다(`useCopyAnalysisReport` 참고).
    return {
        t: (key, values) => tReading(key, values),
        tLabel: (key, values) => tLabel(key, values),
        format: formatReadingNumber,
        list: items => formatter.list(items),
    };
}
