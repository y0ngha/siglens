'use client';

import { useTranslations } from 'next-intl';
import { RouteErrorView } from '@/app/_components/RouteErrorView';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';

interface EconomyErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * `/economy` 서브트리(미국·한국)의 에러 경계.
 *
 * 로더 실패는 라우트가 degrade 렌더로 흡수하지만, 캐시 없는 ISR cold-gen 중의 예상 밖
 * throw(DB/Redis 클라이언트 초기화, core 오류)는 이 경계가 없으면 맨 500이 된다.
 * `reset()`은 세그먼트를 다시 렌더해 일시 장애에서 회복한다.
 */
export default function EconomyError({ error, reset }: EconomyErrorProps) {
    const t = useTranslations('app.economy');
    const locale = useCurrentLocale();
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="EconomyRoute"
            eyebrow={t('error.729779')}
            title={t('error.250bba')}
            body={t('error.19cf82')}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: brandName(locale) })}
        />
    );
}
