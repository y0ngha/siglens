import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { SupportedOAuthProvider } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';
import { buildSocialLoginHref } from '../lib/socialLoginHref';
import { GoogleIcon } from './GoogleIcon';

interface SocialProvider {
    id: SupportedOAuthProvider;
    icon: ReactNode;
    buttonClassName: string;
}

const PROVIDERS: readonly SocialProvider[] = [
    {
        id: 'google',
        icon: <GoogleIcon />,
        /*
           구글 브랜드 가이드가 흰 배경을 요구하는 **고정 표면**이다. 램프
           토큰(`text-secondary-900` 등)을 쓰면 라이트 테마에서 값이 뒤집혀
           흰 버튼에 흰 글자, 호버 시 버튼이 검게 변하는 상태가 된다.
           그래서 테마와 무관한 `*-fixed-light-*` 토큰을 쓴다.
        */
        buttonClassName:
            'bg-white text-on-fixed-light hover:bg-fixed-light-hover ring-1 ring-fixed-light-border',
    },
];

interface SocialLoginButtonsProps {
    /** 로그인 후 돌아갈 경로. 시작 라우트가 검증해 state에 서명해 싣는다. */
    next?: string;
}

/** 로그인·회원가입 화면의 소셜 로그인 링크 목록. 각 링크는 OAuth 시작 라우트로 간다. */
export function SocialLoginButtons({ next }: SocialLoginButtonsProps) {
    const t = useTranslations('features.auth-oauth');
    // 라벨은 로케일마다 번역한다(구글 브랜드 가이드도 현지화 문구를 허용한다).
    // 키를 `PROVIDERS`에 변수로 두면 정적 스캔이 못 잡아 `i18n:extract --write`가
    // 키를 지우므로 여기서 리터럴로 부른다.
    const labels: Record<SupportedOAuthProvider, string> = {
        google: t('SocialLoginButtons.ffa5ee'),
    };
    return (
        <div className="space-y-3">
            <div
                aria-hidden
                className="my-6 flex items-center gap-3 border-t border-secondary-700 pt-3 text-xs tracking-[0.2em] text-secondary-500 uppercase"
            />

            {PROVIDERS.map(provider => (
                <a
                    key={provider.id}
                    href={buildSocialLoginHref(provider.id, next)}
                    rel="nofollow"
                    className={cn(
                        'focus-visible:ring-primary-500 flex h-12 w-full items-center justify-center gap-3 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                        provider.buttonClassName
                    )}
                >
                    {provider.icon}
                    <span>{labels[provider.id]}</span>
                </a>
            ))}
        </div>
    );
}
