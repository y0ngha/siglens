import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findSignalHub } from '@/entities/signal-history/lib/signalHubs';
import { enterLocale } from '@/shared/lib/enterLocale';
// 별칭 경로로 import한다 — 로케일 커버리지 가드가 `@/app/[locale]/…/_lib/*Metadata`만 따라가 읽는다.
import { signalHubMetadata } from '@/app/[locale]/market/signals/_lib/signalHubMetadata';
import { SignalHubBody } from '../_components/SignalHubBody';

// 1h — 기록은 장 마감 뒤 하루 한두 번 늘고, 기록기가 태그(`signal-history`)를 무효화해 그보다 빨리
// 반영된다. 이 값은 상한일 뿐이다.
export const revalidate = 3600;

// 빈 배열 = on-demand ISR(`src/app/CLAUDE.md` AP-1). 배포 빌드에는 DB가 없어 빌드 때 그리지 않는다.
export function generateStaticParams(): { signal: string }[] {
    return [];
}

interface SignalHubRouteProps {
    readonly params: Promise<{ locale: string; signal: string }>;
}

export async function generateMetadata({
    params,
}: SignalHubRouteProps): Promise<Metadata> {
    const { locale: rawLocale, signal } = await params;
    const locale = enterLocale(rawLocale);
    const hub = findSignalHub(signal);
    // 메타데이터에서도 404를 낸다 — 빠뜨리면 없는 경로가 홈 메타데이터를 상속한다(AP-3).
    if (hub === null) notFound();
    return signalHubMetadata(params, locale, hub);
}

export default async function SignalHubPage({ params }: SignalHubRouteProps) {
    const { locale: rawLocale, signal } = await params;
    const locale = enterLocale(rawLocale);
    const hub = findSignalHub(signal);
    if (hub === null) notFound();
    return <SignalHubBody hub={hub} locale={locale} />;
}
