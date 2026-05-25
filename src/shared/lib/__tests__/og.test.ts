import {
    OG_IMAGE_WIDTH,
    OG_IMAGE_HEIGHT,
    OG_BG,
    OG_FG,
    OG_ACCENT,
    OG_MUTED,
    OG_CONTAINER_PADDING,
    OG_TICKER_FONT_SIZE,
    OG_LABEL_FONT_SIZE,
    OG_SITE_NAME_FONT_SIZE,
    OG_SITE_NAME_TOP,
    OG_SITE_NAME_RIGHT,
    OG_LABEL_MARGIN_TOP,
} from '@/shared/lib/og';

describe('OG image dimensions', () => {
    it('OG_IMAGE_WIDTH is 1200 (standard OG width)', () => {
        expect(OG_IMAGE_WIDTH).toBe(1200);
    });

    it('OG_IMAGE_HEIGHT is 630 (standard OG height)', () => {
        expect(OG_IMAGE_HEIGHT).toBe(630);
    });
});

describe('OG color constants', () => {
    it('OG_BG is dark navy hex color', () => {
        expect(OG_BG).toBe('#0f172a');
    });

    it('OG_FG is white', () => {
        expect(OG_FG).toBe('#ffffff');
    });

    it('OG_ACCENT is blue', () => {
        expect(OG_ACCENT).toBe('#3b82f6');
    });

    it('OG_MUTED is slate gray', () => {
        expect(OG_MUTED).toBe('#94a3b8');
    });

    it('all color values are valid hex colors', () => {
        const hexPattern = /^#[0-9a-f]{6}$/;
        expect(OG_BG).toMatch(hexPattern);
        expect(OG_FG).toMatch(hexPattern);
        expect(OG_ACCENT).toMatch(hexPattern);
        expect(OG_MUTED).toMatch(hexPattern);
    });
});

describe('OG layout constants', () => {
    it('OG_CONTAINER_PADDING is a CSS pixel value', () => {
        expect(OG_CONTAINER_PADDING).toBe('80px');
    });

    it('OG_TICKER_FONT_SIZE is 240', () => {
        expect(OG_TICKER_FONT_SIZE).toBe(240);
    });

    it('OG_LABEL_FONT_SIZE is 64', () => {
        expect(OG_LABEL_FONT_SIZE).toBe(64);
    });

    it('OG_SITE_NAME_FONT_SIZE is 32', () => {
        expect(OG_SITE_NAME_FONT_SIZE).toBe(32);
    });

    it('OG_SITE_NAME_TOP is 56', () => {
        expect(OG_SITE_NAME_TOP).toBe(56);
    });

    it('OG_SITE_NAME_RIGHT is 72', () => {
        expect(OG_SITE_NAME_RIGHT).toBe(72);
    });

    it('OG_LABEL_MARGIN_TOP is 32', () => {
        expect(OG_LABEL_MARGIN_TOP).toBe(32);
    });
});
