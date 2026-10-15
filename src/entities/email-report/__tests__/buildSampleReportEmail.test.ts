vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://siglens.io' }));

import { buildSampleReportEmail } from '@/entities/email-report/lib/buildSampleReportEmail';

describe('buildSampleReportEmail', () => {
    it('한국어 카탈로그로 실제 메일 문구와 샘플 산문을 그린다', async () => {
        const { html, subject } = await buildSampleReportEmail('ko');

        expect(subject).toContain('보유·관심종목 리포트');
        expect(html).toContain('<html lang="ko">');
        expect(html).toContain('최근 넉 달 동안 꾸준히 올라');
        // 신호 라벨은 대시보드와 같은 `shared.enumLabel.signalType` 사전에서 온다.
        expect(html).toContain('골든크로스');
        expect(html).not.toContain('golden_cross');
    });

    it('로케일마다 그 언어의 카탈로그를 쓴다', async () => {
        const { html } = await buildSampleReportEmail('en');

        expect(html).toContain('<html lang="en">');
        expect(html).toContain('The stock has climbed steadily');
        expect(html).not.toContain('최근 넉 달');
    });
});
