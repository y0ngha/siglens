'use client';

import { useTranslations } from 'next-intl';

/** 사용자 조회가 진행 중일 때 아바타 자리를 지키는 스켈레톤(헤더 폭이 밀리지 않게 한다). */
export function UserMenuSkeleton() {
    const t = useTranslations('widgets.layout');
    return (
        <div
            role="status"
            aria-label={t('HeaderUserMenu.ce5200')}
            className="size-10 animate-pulse rounded-full bg-secondary-700 motion-reduce:animate-none"
        />
    );
}
