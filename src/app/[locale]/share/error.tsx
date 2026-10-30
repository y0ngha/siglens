'use client';

import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';
import { RouteErrorView } from '@/app/_components/RouteErrorView';

interface ShareErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * `/share/[id]` 서브트리의 오류 경계. 공유 페이지 안의 처리되지 않은 렌더 오류(예상 밖 스냅샷
 * 모양, 종류별 패널의 렌더 실패 등)를 루트 오류 화면 대신 이 브랜드 화면으로 degrade한다.
 */
export default function ShareError({ error, reset }: ShareErrorProps) {
    const t = useTranslations('app.share');
    const locale = useCurrentLocale();
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="ShareRoute"
            eyebrow={t('error.729779')}
            title={t('error.3cf233')}
            body={t('error.1dedc8', { v0: brandName(locale) })}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: brandName(locale) })}
        />
    );
}
