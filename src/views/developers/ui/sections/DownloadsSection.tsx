import {
    PUBLIC_API_BASE_PATH,
    PUBLIC_API_DOC_PATHS,
} from '@/shared/config/publicApi';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import {
    DEVELOPER_DOWNLOAD_PATHS,
    downloadFileName,
} from '../../lib/downloads';
import type { DeveloperDocPath, DevelopersTranslator } from '../../types';
import { INLINE_CODE, NOTE_TEXT } from '../developersStyles';
import { DeveloperSection } from '../layout/DeveloperSection';

interface Props {
    readonly t: DevelopersTranslator;
    readonly title: string;
    /** 문단 끝에 보이는 기본 URL(`https://siglens.io/api/v1`). */
    readonly apiBase: string;
}

/**
 * 내려받기: OpenAPI JSON·YAML과 SKILL.md 카드, 그리고 기본 URL.
 *
 * 같은 오리진 파일 다운로드라 next/link가 아니라 일반 앵커다(크롤러도 파일 링크로 읽는다). 링크는 상대 경로(계정
 * 화면의 Skill 링크와 같다)라 미리보기·로컬 환경에서도 그 서버의 파일을 받는다.
 */
export function DownloadsSection({ t, title, apiBase }: Props) {
    // 경로마다 설명 한 줄 — `Record`라 문서 경로가 늘면 설명을 빠뜨린 채 컴파일되지 않는다.
    const bodies: Readonly<Record<DeveloperDocPath, string>> = {
        [PUBLIC_API_DOC_PATHS.openapiJson]: t('downloads.jsonBody'),
        [PUBLIC_API_DOC_PATHS.openapiYaml]: t('downloads.yamlBody'),
        [PUBLIC_API_DOC_PATHS.skill]: t('downloads.skillBody'),
    };
    return (
        <DeveloperSection id="downloads" title={title} sub={t('downloads.sub')}>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {DEVELOPER_DOWNLOAD_PATHS.map(path => {
                    const file = downloadFileName(path);
                    return (
                        <li
                            key={path}
                            className={cn(
                                SURFACE_CARD,
                                'flex flex-col p-4 sm:p-5'
                            )}
                        >
                            <h3 className={cn(HEADING_SUBSECTION, 'font-mono')}>
                                {file}
                            </h3>
                            <p className="mt-2 flex-1 text-sm leading-6 text-secondary-300">
                                {bodies[path]}
                            </p>
                            <a
                                href={`${PUBLIC_API_BASE_PATH}${path}`}
                                download={file}
                                className={cn(
                                    BUTTON_OUTLINE,
                                    'mt-4 h-10 px-4 text-sm'
                                )}
                            >
                                {t('downloads.action', { file })}
                            </a>
                        </li>
                    );
                })}
            </ul>
            <p className={cn('mt-6', NOTE_TEXT)}>
                {t('downloads.baseUrl')}{' '}
                <code className={INLINE_CODE}>{apiBase}</code>
            </p>
        </DeveloperSection>
    );
}
