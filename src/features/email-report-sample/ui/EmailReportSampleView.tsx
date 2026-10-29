import { useTranslations } from 'next-intl';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

interface EmailReportSampleViewProps {
    /** `toSampleSrcDoc`를 거친 샘플 메일 HTML. */
    srcDoc: string;
}

/**
 * 기존 회원용 "설정으로" 보조 링크. 가입 CTA(버튼) 옆에서 한 단계 낮은 행동으로 읽히도록 hover에서만 밑줄이 생기는 텍스트 링크로 둔다.
 */
const SETTINGS_LINK_CLASSES =
    'text-sm font-medium text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 비회원에게 정기 메일 리포트가 어떻게 생겼는지 보여 주는 화면.
 *
 * 메일은 `sandbox`에 `allow-scripts`·`allow-same-origin` 없이 넣는다 — 스크립트가 돌지 않고
 * 부모 문서와 분리된다. 링크는 새 탭으로만 열리게 `allow-popups`만 허용하고, 열린 탭이 샌드박스를
 * 물려받지 않도록 `allow-popups-to-escape-sandbox`를 더한다.
 * 높이는 뷰포트에 맞추고 넘치는 분량은 iframe 안에서 스크롤한다 — 스크립트가 없어 내용 높이를
 * 잴 수 없고, 메일 본문 길이는 로케일마다 다르다.
 */
export function EmailReportSampleView({ srcDoc }: EmailReportSampleViewProps) {
    const t = useTranslations('features.email-report-sample');
    return (
        <main className="min-h-[calc(100dvh-var(--header-h))] bg-secondary-950 px-4 py-12">
            <div className="mx-auto w-full max-w-2xl space-y-6">
                <header>
                    <h1 className="text-2xl font-semibold text-secondary-50">
                        {t('title')}
                    </h1>
                    <p className="mt-1 text-sm leading-relaxed text-secondary-400">
                        {t('subtitle')}
                    </p>
                    <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
                        <Link
                            href="/signup"
                            className={cn(BUTTON_PRIMARY, 'h-11 px-5 text-sm')}
                        >
                            {t('signup')}
                        </Link>
                        <Link
                            href="/email-report"
                            className={SETTINGS_LINK_CLASSES}
                        >
                            {t('settings')}
                        </Link>
                    </div>
                </header>
                <section aria-label={t('frameTitle')} className="space-y-3">
                    <iframe
                        title={t('frameTitle')}
                        srcDoc={srcDoc}
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-[70dvh] min-h-[28rem] w-full rounded-lg bg-secondary-900 ring-1 ring-secondary-700"
                    />
                    <p className="text-xs leading-relaxed text-secondary-400">
                        {t('note')}
                    </p>
                </section>
            </div>
        </main>
    );
}
