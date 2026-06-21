import { describe, it, expect } from 'vitest';
import { ROOT_TITLE, SITE_DESCRIPTION, ROOT_KEYWORDS } from '../seo';

describe('root SEO copy is multi-asset (stocks + crypto)', () => {
    it('mentions both 미국 주식 and 암호화폐 in the title', () => {
        expect(ROOT_TITLE).toContain('미국 주식');
        expect(ROOT_TITLE).toContain('암호화폐');
    });
    it('description references crypto', () => {
        expect(SITE_DESCRIPTION).toContain('암호화폐');
    });
    it('keywords include crypto search intents', () => {
        expect(ROOT_KEYWORDS).toContain('암호화폐 분석');
        expect(ROOT_KEYWORDS).toContain('비트코인 차트');
    });
});
