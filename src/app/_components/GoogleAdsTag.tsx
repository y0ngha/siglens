'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import {
    consumeSignupConversionFlag,
    trackAdsConversion,
} from '@/shared/lib/googleAds';

interface GoogleAdsTagProps {
    id: string;
}

/**
 * Google Ads 태그(gtag.js)와 가입 전환 기록.
 *
 * 레이아웃(서버 컴포넌트)이 `GOOGLE_ADS_ID`가 있을 때만 렌더한다 — 운영 빌드·E2E
 * 여부는 서버에서만 정확히 안다(`shared/config/googleAds.ts`).
 *
 * `allow_ad_personalization_signals: false`로 리마케팅을 끈다. 개인정보처리방침 v5가
 * "맞춤형 광고에 이용하지 않음"을 약속하므로 이 옵션을 지우면 방침이 거짓이 된다.
 *
 * 가입 플래그를 경로가 바뀔 때마다 확인하는 이유: 가입 서버 액션의 redirect는
 * 클라이언트 내비게이션이라 이 컴포넌트가 다시 마운트되지 않는다.
 */
export function GoogleAdsTag({ id }: GoogleAdsTagProps) {
    const pathname = useAppPathname();
    useEffect(() => {
        if (consumeSignupConversionFlag()) trackAdsConversion('signUp');
    }, [pathname]);
    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
                strategy="afterInteractive"
            />
            <Script id="google-ads-init" strategy="afterInteractive">
                {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{allow_ad_personalization_signals:false});`}
            </Script>
        </>
    );
}
