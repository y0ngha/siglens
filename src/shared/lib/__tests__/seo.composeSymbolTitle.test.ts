import {
    composeSymbolTitle,
    seoTitleWidth,
    SEO_TITLE_MAX_WIDTH,
} from '@/shared/lib/seo';

describe('composeSymbolTitle', () => {
    it('예산이 남으면 tail까지 붙인다', () => {
        expect(
            composeSymbolTitle({
                ticker: 'AAPL',
                koreanName: '애플',
                core: '주가 전망',
                tail: '차트·매매 신호',
            })
        ).toBe('애플(AAPL) 주가 전망 — 차트·매매 신호');
    });

    it('예산이 모자라면 tail을 먼저 버린다', () => {
        const t = composeSymbolTitle({
            ticker: 'DJT',
            koreanName: '트럼프 미디어 & 테크놀로지 그룹',
            core: '공포 탐욕 지수',
            tail: '0~100 점수와 5단계',
        });
        expect(t).toBe('트럼프 미디어 & 테크놀로지 그룹(DJT) 공포 탐욕 지수');
        expect(seoTitleWidth(t)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
    });

    it('그래도 모자라면 한국어명을 버리고 core는 지킨다', () => {
        const t = composeSymbolTitle({
            ticker: 'NVDL',
            koreanName: '그래닛셰어스 2배 레버리지 NVDA 데일리 ETF',
            core: '공포 탐욕 지수',
            tail: '0~100 점수와 5단계',
        });
        expect(t).toContain('공포 탐욕 지수');
        expect(t).toContain('NVDL');
        expect(t).not.toContain('그래닛셰어스');
        expect(seoTitleWidth(t)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
    });

    it('한국어명이 없으면 티커로 조립한다', () => {
        expect(
            composeSymbolTitle({
                ticker: 'AAPL',
                core: '주가 전망',
                tail: '차트·매매 신호',
            })
        ).toBe('AAPL 주가 전망 — 차트·매매 신호');
    });

    it('tail이 없으면 core만 붙인다', () => {
        expect(
            composeSymbolTitle({
                ticker: 'AAPL',
                koreanName: '애플',
                core: '옵션 분석',
            })
        ).toBe('애플(AAPL) 옵션 분석');
    });

    it('어떤 입력에도 core는 살아남고 예산을 넘지 않는다', () => {
        const t = composeSymbolTitle({
            ticker: 'ABCDEFGHIJKLMNOP',
            koreanName: '가'.repeat(50),
            core: '공포 탐욕 지수',
        });
        expect(t).toContain('공포 탐욕 지수');
        expect(seoTitleWidth(t)).toBeLessThanOrEqual(SEO_TITLE_MAX_WIDTH);
    });
});
