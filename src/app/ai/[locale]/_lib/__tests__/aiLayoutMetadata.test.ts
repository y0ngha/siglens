import { describe, expect, it } from 'vitest';
import { buildAiLayoutMetadata } from '../aiLayoutMetadata';

describe('buildAiLayoutMetadata', () => {
    it('기본은 색인하지 않는다', () => {
        expect(buildAiLayoutMetadata('en').robots).toEqual({
            index: false,
            follow: false,
        });
    });

    it('제목 템플릿에 로케일 제품명을 쓴다', () => {
        expect(buildAiLayoutMetadata('ko').title).toEqual({
            default: '시그렌즈 AI',
            template: '%s | 시그렌즈 AI',
        });
        expect(buildAiLayoutMetadata('en').title).toEqual({
            default: 'SIGLENS AI',
            template: '%s | SIGLENS AI',
        });
    });

    it('ai 호스트의 네이버 소유 확인 토큰을 싣는다', () => {
        expect(buildAiLayoutMetadata('ko').verification).toEqual({
            other: {
                'naver-site-verification':
                    'dd05a56cc099f67ca0597793f6965c8c9bd13ba3',
            },
        });
    });
});
