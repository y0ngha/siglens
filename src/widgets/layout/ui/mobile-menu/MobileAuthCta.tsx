'use client';

import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface MobileAuthCtaProps {
    /** `/login`·`/signup` href 뒤에 붙는 쿼리(`?next=…`). 없으면 빈 문자열. */
    readonly authQuery: string;
    readonly onNavigate: () => void;
}

/**
 * 드로어 바닥의 가입·로그인 CTA. 모바일 헤더에서 `회원가입` 버튼을 뺐으므로(좁은 한 줄에
 * 아이콘 넷이 서 있다) 그 진입점이 여기로 온다. 라벨은 헤더 CTA와 **같은 키**다 — 같은
 * 목적지에 다른 문구가 붙으면 안 된다. 내비 **밑**에 두고 `mt-auto`로 바닥에 붙인다.
 */
export function MobileAuthCta({ authQuery, onNavigate }: MobileAuthCtaProps) {
    const t = useTranslations('widgets.layout');
    return (
        <div className="mt-auto flex flex-col gap-2 border-t border-secondary-700 p-3">
            <Link
                href={`/signup${authQuery}`}
                prefetch={false}
                onClick={onNavigate}
                className="inline-flex min-h-11 items-center justify-center rounded bg-primary-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('HeaderUserMenu.ecb4cc')}
            </Link>
            <Link
                href={`/login${authQuery}`}
                prefetch={false}
                onClick={onNavigate}
                className="inline-flex min-h-11 items-center justify-center rounded border border-border-control px-3 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('HeaderUserMenu.e225a6')}
            </Link>
        </div>
    );
}
