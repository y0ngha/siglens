import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import type {
    ReportEmailTranslator,
    SignalLabelResolver,
} from '../templates/reportEmail';
import { createSignalLabelResolver } from './signalLabelResolver';

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
