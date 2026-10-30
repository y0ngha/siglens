import { describe, expect, it } from 'vitest';
import {
    buildOverrides,
    buildSiteOverride,
    collapseWhitespace,
    documentTitleOf,
} from '@/app/_components/notFoundOverrides';

describe('collapseWhitespace', () => {
    it('줄바꿈·연속 공백을 한 칸으로 접고 양끝을 자른다', () => {
        expect(
            collapseWhitespace('  주소가\n            바뀌었거나   없어요 ')
        ).toBe('주소가 바뀌었거나 없어요');
    });
});

describe('documentTitleOf', () => {
    it('`제목 | 브랜드`로 조립한다', () => {
        expect(documentTitleOf('페이지를 찾을 수 없어요', '시그렌즈')).toBe(
            '페이지를 찾을 수 없어요 | 시그렌즈'
        );
    });
});

describe('buildSiteOverride', () => {
    it('ko 메인 호스트 문구: 제목에 브랜드를 붙이고 안내 문구의 줄바꿈을 접는다', async () => {
        await expect(buildSiteOverride('ko')).resolves.toEqual({
            documentTitle: '페이지를 찾을 수 없습니다 | 시그렌즈',
            headline: '페이지를 찾을 수 없습니다',
            body: '요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다. 아래에서 종목을 검색하거나, 인기 종목을 확인해 보세요.',
            homeLabel: '시그렌즈 홈으로 돌아가기',
        });
    });
});

describe('buildOverrides', () => {
    it('메인 호스트 최소 문구에는 기본 로케일(ko)이 없다 — 서버가 전체 마크업으로 그린다', async () => {
        const overrides = await buildOverrides();

        expect(Object.keys(overrides.site).sort()).toEqual(['en', 'ja', 'zh']);
        expect(Object.keys(overrides.ai).sort()).toEqual([
            'en',
            'ja',
            'ko',
            'zh',
        ]);
    });
});
