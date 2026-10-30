'use client';

import { useTranslations } from 'next-intl';
import { RouteErrorView } from '@/app/_components/RouteErrorView';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';

interface RootErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * 로케일 세그먼트의 기본 에러 경계 — 자체 `error.tsx`가 없는 모든 라우트(홈·계정·인증·법률·문서
 * 페이지 등)에서 빠져나온 렌더 오류를 받아 브랜드 화면과 재시도를 보여 준다. `reset()`은 실패한
 * 세그먼트를 제자리에서 다시 그린다.
 */
export default function RootError({ error, reset }: RootErrorProps) {
    const t = useTranslations('app.home');
    const locale = useCurrentLocale();
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="RootRoute"
            eyebrow={t('error.729779')}
            title={t('error.80dac7')}
            body={t('error.32c8a0')}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: brandName(locale) })}
        />
    );
}
