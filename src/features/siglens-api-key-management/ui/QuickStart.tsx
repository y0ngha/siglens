'use client';

import { useTranslations } from 'next-intl';
import { API_KEY_ENV_NAME, API_KEY_PREFIX } from '@/shared/config/publicApi';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';

interface QuickStartProps {
    /** 예: `https://siglens.io/api/v1` — curl 예시의 호출 주소. */
    apiBaseUrl: string;
    /** 내려받을 Skill 파일 경로(같은 오리진). */
    skillHref: string;
}

/**
 * "30초 시작 가이드" — 키를 환경변수에 넣고, Skill 파일을 받고, curl로 한 번 불러 보는 세 단계.
 * 예시의 키 자리는 접두와 말줄임표뿐이라 실제 키 원문은 여기에 나오지 않는다.
 */
export function QuickStart({ apiBaseUrl, skillHref }: QuickStartProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const curlExample = [
        `curl -s -X POST ${apiBaseUrl}/tools/search_ticker \\`,
        `  -H "Authorization: Bearer $${API_KEY_ENV_NAME}" \\`,
        '  -H "Content-Type: application/json" \\',
        `  -d '{"query":"apple"}'`,
    ].join('\n');
    return (
        <div className="space-y-3 border-t border-secondary-700 pt-4">
            <h3 className={HEADING_SUBSECTION}>
                {t('SiglensApiKeySection.quickStartTitle')}
            </h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-secondary-300">
                <li>
                    {/* `<code>`는 CSS로만 블록이라, 공백이 없으면 텍스트로 이을 때(복사·읽기 모드) 문장 끝과 명령이 붙는다. */}
                    {t('SiglensApiKeySection.step1')}{' '}
                    <code className="mt-1 block rounded-lg bg-secondary-950 px-3 py-2 font-mono text-xs break-all text-secondary-100">
                        export {API_KEY_ENV_NAME}={API_KEY_PREFIX}…
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
