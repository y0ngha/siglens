'use client';

import { useTranslations } from 'next-intl';
import { RouteErrorView } from '@/app/_components/RouteErrorView';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';

interface FearGreedErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * `/fear-greed` 서브트리(미국·한국·암호화폐)의 에러 경계.
 *
 * 판독값 로더 실패는 라우트가 빈 스냅샷으로 흡수하므로, 여기까지 오는 것은 예상 밖의
 * 렌더 오류다. 그 경우에도 맨 500 대신 브랜드 화면과 재시도(`reset()` — 세그먼트 재렌더)를 준다.
 */
export default function FearGreedError({ error, reset }: FearGreedErrorProps) {
    const t = useTranslations('app.fear-greed');
    const locale = useCurrentLocale();
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="FearGreedRoute"
            eyebrow={t('error.729779')}
            title={t('error.e533f3')}
            body={t('error.4749c9')}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: brandName(locale) })}
        />
    );
}
