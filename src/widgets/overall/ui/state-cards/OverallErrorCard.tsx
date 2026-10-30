'use client';

import { useTranslations } from 'next-intl';
import type { OverallAxis } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

/** OverallAxis → `shared.symbolTab` 카탈로그 키. 탭바와 같은 라벨을 쓴다. */
const AXIS_TAB_KEY: Record<OverallAxis, string> = {
    technical: 'chart',
    fundamental: 'fundamental',
    news: 'news',
    options: 'options',
};

interface OverallErrorCardProps {
    message: string;
    /** 실패한 분석 축. 없으면 축 안내를 붙이지 않는다. */
    axis?: OverallAxis;
    /** 다시 시도. 결과가 없는 오류에서 쓰므로 캐시를 우회하지 않는 일반 요청이어야 한다. */
    onRetry: () => void;
}

/** 결과 없이 끝난 분석 실패 카드. 로케일 문구와 번역된 축 이름을 보여 준다. */
export function OverallErrorCard({
    message,
    axis,
    onRetry,
}: OverallErrorCardProps) {
    const t = useTranslations('widgets.overall');
    // extract.mjs의 동적 키 탐지는 번역자를 직접 호출하는 파일 안의 조회만 본다 —
    // `AXIS_TAB_KEY[...]`를 이 파일의 `tTab(...)`에 그대로 넣는다.
    const tTab = useTranslations('shared.symbolTab');
    return (
        <section
            aria-labelledby="overall-error-heading"
            className={cn(SURFACE_CARD, 'border-ui-danger/30 p-6')}
        >
            <h2
                id="overall-error-heading"
                className={cn(HEADING_SECTION, 'mb-2 text-balance')}
            >
                {t('OverallContent.8b7ae7')}
            </h2>
            <p className="text-sm text-ui-danger-text" role="alert">
                {message}
                {axis !== undefined &&
                    t('axisFailed', { v0: tTab(AXIS_TAB_KEY[axis]) })}
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                {t('OverallContent.0c767c')}
            </button>
        </section>
    );
}
