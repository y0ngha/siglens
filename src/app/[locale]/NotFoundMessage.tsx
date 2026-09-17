'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SITE_NAME } from '@/shared/lib/seo';

/**
 * 만료·미존재 공유 스냅샷은 `share/[id]/page.tsx`가 `notFound()`로 보낸다
 * (예전에는 200을 돌려줘 GSC가 soft-404로 분류했다). 상태 코드는 404로 정확해졌으니
 * 문구만 그 맥락으로 돌려준다 — 공유 링크를 눌러 온 사람에게 "주소가 바뀌었다"는
 * 일반 404 문구는 틀린 설명이다.
 */
const SHARE_PATH_SEGMENT = '/share/';

/**
 * 404 헤드라인. **클라이언트 컴포넌트다** — 경로에 따라 문구가 갈리는데, 그 판단에
 * 필요한 `usePathname()`이 클라이언트 훅이라서다. `NotFoundContent`의 나머지(링크·
 * 연락처)는 서버 렌더를 유지한다.
 */
export function NotFoundMessage() {
    const t = useTranslations('app.home');
    const pathname = usePathname();
    // 로케일 접두사(`/ja/share/xxx`)가 붙을 수 있어 앞부분을 고정하지 않는다.
    const isExpiredShare = pathname.includes(SHARE_PATH_SEGMENT);

    return (
        <>
            <p className="font-mono text-sm tracking-widest text-primary-400">
                {isExpiredShare ? t('NotFoundMessage.0658dd') : '404'}
            </p>
            <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                {isExpiredShare
                    ? t('NotFoundMessage.365a70')
                    : t('not-found.6cbd6d')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                {isExpiredShare
                    ? t('NotFoundMessage.7c95d5', { v0: SITE_NAME })
                    : t('not-found.03ecab')}
            </p>
        </>
    );
}
