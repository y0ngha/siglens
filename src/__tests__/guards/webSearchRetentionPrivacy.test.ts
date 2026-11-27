import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    WEB_SEARCH_KEPT_FIELDS,
    WEB_SEARCH_RETENTION_DAYS,
} from '@/shared/api/web/webSearchResult';

/**
 * 저장된 웹 검색 결과를 N일 뒤 제목·링크만 남기고 지우는 규칙(`shared/api/web/webSearchResult.ts`)은 개인정보처리방침의
 * 약속이다. 코드를 바꾸고 방침을 안 고치면 방침이 거짓이 되고, 방침만 바꾸면 고지가 코드를 앞서 나간다. **가장 높은
 * 버전**의 4개 언어 원문이 일수와 "제목·링크만"을 적고 있는지 보고, 남기는 필드 목록이 제목·URL 둘뿐인지 고정한다.
 */
const PRIVACY_DIR = path.resolve(process.cwd(), 'db/seeds/terms/privacy');

const VERSION = Math.max(
    ...readdirSync(PRIVACY_DIR).flatMap(name => {
        const match = /^v(\d+)\.md$/.exec(name);
        return match?.[1] === undefined ? [] : [Number(match[1])];
    })
);
const read = (suffix: string): string =>
    readFileSync(path.join(PRIVACY_DIR, `v${VERSION}${suffix}.md`), 'utf8');

const DAYS = String(WEB_SEARCH_RETENTION_DAYS);

const CLAIMS: Record<string, RegExp> = {
    ko: new RegExp(
        `웹 검색 결과는 저장된 지 ${DAYS}일이 지나면 제목과 링크만 남기고`
    ),
    en: new RegExp(
        `Web search results stored in a conversation are automatically reduced to their title and link only ${DAYS} days after`
    ),
    ja: new RegExp(`保存から${DAYS}日が過ぎるとタイトルとリンクだけを残して`),
    zh: new RegExp(`保存满${DAYS}天后自动只保留标题和链接`),
};

describe('웹 검색 결과 보존 기간은 개인정보처리방침과 같다', () => {
    it('남기는 필드는 제목과 URL뿐이다', () => {
        expect([...WEB_SEARCH_KEPT_FIELDS]).toEqual(['title', 'url']);
    });

    it.each([
        ['ko', ''],
        ['en', '.en'],
        ['ja', '.ja'],
        ['zh', '.zh'],
    ])(
        `최신 방침(%s)이 ${WEB_SEARCH_RETENTION_DAYS}일 뒤 제목·링크만 남긴다는 약속을 적는다`,
        (locale, suffix) => {
            expect(read(suffix)).toMatch(CLAIMS[locale]);
        }
    );
});
