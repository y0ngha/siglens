import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';
import type { OAuthProvider, SupportedOAuthProvider } from '@/shared/lib/types';

interface OAuthAccountCardProps {
    provider: SupportedOAuthProvider;
    email: string;
    name?: string;
    /** provider 프로필 사진. 없으면 같은 크기의 빈 원으로 자리만 잡는다. */
    avatarUrl?: string;
}

const PROVIDER_LABEL: Partial<Record<OAuthProvider, string>> = {
    google: 'Google',
};

/** 동의 화면 상단의 "어느 계정으로 가입하는지" 요약 — provider 프로필의 이메일·이름·사진. */
export function OAuthAccountCard({
    provider,
    email,
    name,
    avatarUrl,
}: OAuthAccountCardProps) {
    const t = useTranslations('features.auth-oauth-consent');
    // 브랜드명은 번역하지 않는다. 라벨이 없는 provider는 식별자를 그대로 쓴다.
    const providerLabel = PROVIDER_LABEL[provider] ?? provider;

    return (
        <div className={cn(SURFACE_NESTED, 'flex items-center gap-3 p-4')}>
            {avatarUrl ? (
                <Image
                    src={avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full"
                />
            ) : (
                <div
                    aria-hidden="true"
                    className="size-8 rounded-full bg-secondary-800"
                />
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-secondary-100">
                    {email}
                </p>
                {name ? (
                    <p className="truncate text-xs text-secondary-300">
                        {name}
                    </p>
                ) : null}
                <p className="text-xs text-secondary-400">
                    {/* 어순이 로케일마다 달라 provider 이름은 문구 안의 자리표시자로 넣는다. */}
                    {t('OAuthAccountCard.7af734', { v0: providerLabel })}
                </p>
            </div>
        </div>
    );
}
