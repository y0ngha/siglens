import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import type { EmailMessage } from '@/shared/email/types';
import { SITE_URL } from '@/shared/lib/seo';
import { createSignalLabelResolver } from './lib/signalLabelResolver';
import { buildSampleReportEmailInput } from './lib/sampleReportData';
import {
    buildReportEmail,
    type ReportEmailTranslator,
    type SignalLabelResolver,
} from './templates/reportEmail';

/**
 * 메일 리포트의 서버 전용 조립 지점. 번역 카탈로그를 읽는 I/O(`getTranslations`)가 있어
 * `lib/`(순수 함수만 둔다, EN-1)가 아니라 entity 루트 `server.ts`에 둔다 —
 * `entities/sitemap-entry/server.ts`와 같은 자리다.
 */

/**
 * 메일 템플릿에 넘기는 번역자와 신호 라벨 리졸버를 만드는 곳. 발송 cron과 비회원용 샘플
 * 페이지가 같은 사전·같은 리졸버를 써야 샘플이 실제 메일과 갈라지지 않는다.
 *
 * 요청 스코프가 없는 호출(cron)도 있어 로케일을 명시한다 — 빠지면 next-intl이
 * `headers()`로 물러나 정적 렌더가 꺼진다.
 */
export async function getReportEmailTranslator(
    locale: Locale
): Promise<ReportEmailTranslator> {
    // next-intl 번역자는 `(key, values?) => string` 호출을 받는 함수지만 키를 리터럴 유니온으로
    // 좁힌 제네릭 타입이라 문자열 키 시그니처에 바로 대입되지 않는다. 템플릿은 이 네임스페이스의
    // 키만 쓰고, 런타임 호출 형태는 같다.
    return (await getTranslations({
        locale,
        namespace: 'entities.email-report.email',
    })) as unknown as ReportEmailTranslator;
}

/** 대시보드 `SignalBadge`와 같은 사전. 미등록 타입은 리졸버가 걸러 심볼 키가 메일에 새지 않는다. */
export async function getReportSignalLabelResolver(
    locale: Locale
): Promise<SignalLabelResolver> {
    const tLabel = await getTranslations({
        locale,
        namespace: 'shared.enumLabel',
    });
    return createSignalLabelResolver({
        has: key => tLabel.has(key),
        label: key => tLabel(key),
    });
}

/**
 * 비회원용 샘플 페이지가 보여 주는 메일 한 통. 발송 cron과 같은 번역자·라벨 리졸버·
 * `buildReportEmail`을 거치고, 데이터만 고정 샘플이다 — 시장 데이터·DB 조회가 없다.
 */
export async function buildSampleReportEmail(
    locale: Locale
): Promise<EmailMessage> {
    const [t, signalLabel, sampleT] = await Promise.all([
        getReportEmailTranslator(locale),
        getReportSignalLabelResolver(locale),
        getTranslations({
            locale,
            namespace: 'entities.email-report.sample',
        }),
    ]);
    return buildReportEmail(
        buildSampleReportEmailInput({
            locale,
            t,
            signalLabel,
            sampleText: key => sampleT(key),
            siteUrl: SITE_URL,
        })
    );
}
