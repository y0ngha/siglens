'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';

interface QuickStartProps {
    apiBaseUrl: string;
    skillHref: string;
}

export function QuickStart({ apiBaseUrl, skillHref }: QuickStartProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const curlExample = [
        `curl -s -X POST ${apiBaseUrl}/tools/search_ticker \\`,
        '  -H "Authorization: Bearer $SIGLENS_API_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '{"query":"apple"}'`,
    ].join('\n');
    return (
        <div className="space-y-3 border-t border-secondary-700 pt-4">
            <h3 className="text-sm font-semibold text-secondary-100">
                {t('SiglensApiKeySection.quickStartTitle')}
            </h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-secondary-300">
                <li>
                    {t('SiglensApiKeySection.step1')}
                    <code className="mt-1 block rounded-lg bg-secondary-950 px-3 py-2 font-mono text-xs break-all text-secondary-100">
                        export SIGLENS_API_KEY=slk_…
                    </code>
                </li>
                <li>
                    {t('SiglensApiKeySection.step2')}
                    <div className="mt-2">
                        {/* 같은 오리진 파일 다운로드라 next/link가 아니라 일반 앵커다. */}
                        <a
                            href={skillHref}
                            download="SKILL.md"
                            className={cn(BUTTON_OUTLINE, 'h-9 px-4 text-sm')}
                        >
                            {t('SiglensApiKeySection.downloadSkill')}
                        </a>
                    </div>
                </li>
                <li>
                    {t('SiglensApiKeySection.step3')}
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-secondary-950 px-3 py-2 font-mono text-xs text-secondary-100">
                        {curlExample}
                    </pre>
                </li>
            </ol>
        </div>
    );
}
