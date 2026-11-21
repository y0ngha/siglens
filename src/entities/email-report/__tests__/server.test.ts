vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://siglens.io' }));

import {
    buildSampleReportEmail,
    getReportSignalLabelResolver,
} from '@/entities/email-report/server';

describe('buildSampleReportEmail', () => {
    it('한국어 카탈로그로 실제 메일 문구와 샘플 산문을 그린다', async () => {
        const { html, subject } = await buildSampleReportEmail('ko');

        expect(subject).toContain('보유종목과 관심종목 리포트');
        expect(html).toContain('<html lang="ko">');
        expect(html).toContain('최근 넉 달 동안 꾸준히 올라');
        // 신호 라벨은 대시보드와 같은 `shared.enumLabel.signalType` 사전에서 온다.
        expect(html).toContain('골든크로스');
        expect(html).not.toContain('golden_cross');
    });

    it('푸터 사유는 설정에서 켠 것이 아니라 수신에 동의한 것으로 적는다(가입 화면 동의도 같은 문구를 쓴다)', async () => {
        const { html } = await buildSampleReportEmail('ko');

        expect(html).toContain(
            '시그렌즈 메일 리포트 수신에 동의하셔서 보내 드리는 메일이에요.'
        );
        expect(html).not.toContain('설정에서 수신을 켜');
    });

    it('푸터 사유는 영어 카탈로그에서도 동의 문구다', async () => {
        const { html } = await buildSampleReportEmail('en');

        expect(html).toContain(
            'because you agreed to receive SIGLENS email reports.'
        );
        expect(html).not.toContain('turned on email reports');
    });

    it('로케일마다 그 언어의 카탈로그를 쓴다', async () => {
        const { html } = await buildSampleReportEmail('en');

        expect(html).toContain('<html lang="en">');
        expect(html).toContain('The stock has climbed steadily');
        expect(html).not.toContain('최근 넉 달');
    });
});

describe('getReportSignalLabelResolver', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('사전에 있는 신호 타입은 로케일 라벨로 바꾼다', async () => {
        const resolve = await getReportSignalLabelResolver('ko');

        expect(resolve('golden_cross')).toBe('골든크로스');
    });

    it('미등록 타입은 null이고 console.warn에 타입 이름을 남긴다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const resolve = await getReportSignalLabelResolver('ko');

        expect(resolve('brand_new_type')).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('brand_new_type')
        );
    });
});
