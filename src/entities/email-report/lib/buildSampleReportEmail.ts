import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import type { EmailMessage } from '@/shared/email/types';
import { buildReportEmail } from '../templates/reportEmail';
import {
    getReportEmailTranslator,
    getReportSignalLabelResolver,
} from './reportEmailTranslators';
import { buildSampleReportEmailInput } from './sampleReportData';

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
