/**
 * `/developers` 슬라이스가 공유하는 타입. 섹션 컴포넌트는 비동기가 아니라 페이지가 만든 번역기를 받으므로
 * 그 번역기 타입과, 섹션들이 같은 모양으로 넘기는 표 행 타입을 여기에 둔다.
 */

import type { getTranslations } from 'next-intl/server';
import type { PUBLIC_API_DOC_PATHS } from '@/shared/config/publicApi';

/** 페이지가 `views.developers` 네임스페이스로 만든 번역기. 섹션·카드는 비동기 컴포넌트가 아니라 이것을 받는다. */
export type DevelopersTranslator = Awaited<ReturnType<typeof getTranslations>>;

/** 이름-설명 두 열 표(`InfoTable`)의 한 행. */
export interface InfoRow {
    readonly term: string;
    readonly body: string;
    /** 본문 뒤에 붙는 현지어 보충 문장(본문이 영어 원문이어도 이 문장은 페이지 언어다). */
    readonly note?: string;
}

/** `PUBLIC_API_DOC_PATHS`의 값 하나(`/openapi.json`, `/skill` …). 내려받기 링크와 파일 이름이 여기서 나온다. */
export type DeveloperDocPath =
    (typeof PUBLIC_API_DOC_PATHS)[keyof typeof PUBLIC_API_DOC_PATHS];
