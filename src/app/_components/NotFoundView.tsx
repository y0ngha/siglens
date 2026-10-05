'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { NotFoundLayout } from '@/app/_components/NotFoundLayout';
import {
    DEFAULT_LOCATION_SURFACE,
    resolveLocationSurface,
    type LocationSurface,
} from '@/shared/i18n/locationSurface';
import {
    LOCALE_HREFLANG,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';

/**
 * 비기본 표면(다른 로케일·ai 호스트)이 쓰는 **최소 문구**. 이 객체는 클라이언트 props라
 * 모든 페이지의 Flight 페이로드에 실리므로 꼭 필요한 문자열만 담는다 — 내비 링크·바로가기·
 * 설명 문단은 없다(한국어 · 메인 호스트 전체 마크업은 서버가 `children`으로 그린다).
 */
export interface NotFoundOverride {
    readonly documentTitle: string;
    readonly headline: string;
    /** 메인 호스트에서만 있다 — SiglensAI는 제목과 새 대화 링크뿐이다. */
    readonly body?: string;
    readonly homeLabel: string;
}

export interface NotFoundOverrides {
    readonly site: Partial<Record<Locale, NotFoundOverride>>;
    readonly ai: Partial<Record<Locale, NotFoundOverride>>;
    readonly siteWordmark: string;
    readonly aiWordmark: string;
}

interface NotFoundViewProps {
    readonly overrides: NotFoundOverrides;
    /** 서버가 그린 한국어 · 메인 호스트 전체 마크업. 기본 표면에서 그대로 보인다. */
    readonly children: ReactNode;
}

/** 주소는 이 컴포넌트가 사는 동안 바뀌지 않는다 — 구독할 변경이 없다. */
function subscribeNever(): () => void {
    return () => {};
}

function encode({ locale, onAiHost }: LocationSurface): string {
    return `${locale}:${onAiHost ? 'ai' : 'site'}`;
}

/**
 * 스냅샷은 **원시 문자열**이어야 한다 — `useSyncExternalStore`는 렌더마다 스냅샷을
 * `Object.is`로 비교하므로 매번 새 객체를 돌려주면 무한 렌더가 된다.
 */
function locationSnapshot(): string {
    return encode(
        resolveLocationSurface(
            window.location.hostname,
            window.location.pathname
        )
    );
}

const DEFAULT_SNAPSHOT = encode(DEFAULT_LOCATION_SURFACE);

function parseSnapshot(snapshot: string): LocationSurface {
    const [locale, host] = snapshot.split(':');
    return { locale: locale as Locale, onAiHost: host === 'ai' };
}

/**
 * 루트 404 클라이언트 섬.
 *
 * 루트 `not-found.tsx`는 정적이어야 해서 서버는 한국어 · 메인 호스트 한 벌만 그린다
 * (`children`). 이 컴포넌트는 서버·하이드레이션 렌더에서 기본 표면을 쓰고
 * (`getServerSnapshot` — 그래서 하이드레이션 불일치가 없다), 하이드레이션이 끝난 뒤
 * 주소로 알아낸 실제 로케일·호스트가 비기본이면 최소 문구로 바꾸고 `document.title`·
 * `<html lang>`을 맞춘다. JS 없이 받는 크롤러는 기본(한국어) 문서를 받는다.
 */
export function NotFoundView({ overrides, children }: NotFoundViewProps) {
    const snapshot = useSyncExternalStore(
        subscribeNever,
        locationSnapshot,
        () => DEFAULT_SNAPSHOT
    );
    const surface = parseSnapshot(snapshot);
    const override = (surface.onAiHost ? overrides.ai : overrides.site)[
        surface.locale
    ];
    const documentTitle = override?.documentTitle;
    const lang = LOCALE_HREFLANG[surface.locale];

    useEffect(() => {
        if (documentTitle === undefined) return;
        document.title = documentTitle;
        document.documentElement.lang = lang;
    }, [documentTitle, lang]);

    if (override === undefined) return children;
    return (
        <NotFoundLayout
            wordmark={
                surface.onAiHost ? overrides.aiWordmark : overrides.siteWordmark
            }
            homeHref={localePath(surface.locale, '/')}
            title={override.headline}
            description={override.body}
            homeLabel={override.homeLabel}
        />
    );
}
