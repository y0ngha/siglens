import { dropSolicitations } from '../dropSolicitations';

const SOLICITATION =
    'ROSEN, A LEADING INVESTOR RIGHTS FIRM, Encourages Apple Inc. Investors to Secure Counsel Before Important Deadline in Securities Class Action';

describe('dropSolicitations는', () => {
    it('원제목이 로펌 원고 모집 광고인 행만 버리고 순서를 지킨다', () => {
        const rows = [
            { id: 1, titleEn: 'Apple reports record quarter' },
            { id: 2, titleEn: SOLICITATION },
            { id: 3, titleEn: 'Fed holds rates' },
        ];

        expect(dropSolicitations(rows).map(r => r.id)).toEqual([1, 3]);
    });

    it('번역 제목이 아니라 원제목으로 판정한다', () => {
        const rows = [{ titleEn: SOLICITATION, titleKo: '평범한 제목' }];

        expect(dropSolicitations(rows)).toEqual([]);
    });
});
