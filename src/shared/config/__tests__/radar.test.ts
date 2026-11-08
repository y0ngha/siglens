import {
    RADAR_DASHBOARDS,
    RADAR_SITE_URL,
    radarDashboardUrl,
} from '@/shared/config/radar';

describe('radar config', () => {
    it('대시보드 URL 은 사이트 루트 뒤에 slug 를 붙인다', () => {
        expect(radarDashboardUrl('sealsq')).toBe(
            'https://dashboard.siglens.io/sealsq'
        );
    });

    it('모든 대시보드 URL 이 레이더 사이트 아래에 있고 slug 가 겹치지 않는다', () => {
        const slugs = RADAR_DASHBOARDS.map(d => d.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        for (const slug of slugs) {
            expect(
                radarDashboardUrl(slug).startsWith(`${RADAR_SITE_URL}/`)
            ).toBe(true);
        }
    });
});
