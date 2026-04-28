import type { OAuthProvider } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

interface SocialLoginButtonsProps {
    next?: string;
}

interface SocialProvider {
    id: OAuthProvider;
    label: string;
    glyph: string;
    buttonClassName: string;
}

const PROVIDERS: readonly SocialProvider[] = [
    {
        id: 'google',
        label: 'Continue with Google',
        glyph: 'G',
        buttonClassName:
            'bg-white text-slate-900 hover:bg-slate-100 ring-1 ring-slate-200',
    },
    {
        id: 'kakao',
        label: '카카오로 시작하기',
        glyph: 'K',
        buttonClassName: 'bg-[#FEE500] text-slate-900 hover:brightness-95',
    },
    {
        id: 'apple',
        label: 'Continue with Apple',
        glyph: '',
        buttonClassName:
            'bg-black text-white hover:bg-slate-900 ring-1 ring-slate-800',
    },
];

function buildHref(providerId: OAuthProvider, next?: string): string {
    const base = `/api/auth/${providerId}/start`;
    if (!next) return base;
    const params = new URLSearchParams({ next });
    return `${base}?${params.toString()}`;
}

export function SocialLoginButtons({ next }: SocialLoginButtonsProps) {
    return (
        <div className="space-y-3">
            <div
                aria-hidden
                className="border-secondary-800 text-secondary-500 my-6 flex items-center gap-3 border-t pt-3 text-xs tracking-[0.2em] uppercase"
            >
                <span className="border-secondary-800 -mt-3 bg-slate-900/80 px-2">
                    또는
                </span>
            </div>
            {PROVIDERS.map(provider => (
                <a
                    key={provider.id}
                    href={buildHref(provider.id, next)}
                    rel="nofollow"
                    className={cn(
                        'flex h-12 w-full items-center justify-center gap-3 rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
                        provider.buttonClassName
                    )}
                >
                    <span aria-hidden className="font-mono text-base">
                        {provider.glyph}
                    </span>
                    <span>{provider.label}</span>
                </a>
            ))}
        </div>
    );
}
