import { describe, expect, it } from 'vitest';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';
import { koMessage } from '@/shared/test-utils/koMessage';

describe('catalogTranslator', () => {
    it('지원하지 않는 로케일이면 ko로 대체하지 않고 던진다', () => {
        expect(() => catalogTranslator('shared.lib.fearGreed', 'jp')).toThrow(
            '지원하지 않는 로케일: jp'
        );
    });

    it('카탈로그에 없는 키는 던진다', () => {
        const t = catalogTranslator('shared.lib.fearGreed');
        expect(() => t('__missing__')).toThrow('__missing__');
    });

    it('has는 없는 키에 false를 돌려준다', () => {
        expect(
            catalogTranslator('shared.lib.fearGreed').has('__missing__')
        ).toBe(false);
    });

    it('로케일별 카탈로그를 읽는다', () => {
        const en = catalogTranslator('entities.analysis.fallback', 'en');
        const ko = catalogTranslator('entities.analysis.fallback', 'ko');
        expect(en('unavailable')).not.toBe(ko('unavailable'));
    });
});

describe('koMessage', () => {
    it('없는 경로는 던진다', () => {
        expect(() => koMessage('shared.__missing__')).toThrow('__missing__');
    });
});
