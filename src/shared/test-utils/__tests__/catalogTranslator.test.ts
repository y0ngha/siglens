import { describe, expect, it } from 'vitest';
import {
    catalogTranslator,
    resolveCatalogPath,
} from '@/shared/test-utils/catalogTranslator';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';

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
        expect(en('unavailable')).toBe(
            resolveCatalogPath(
                MESSAGE_CATALOGS.en,
                'entities.analysis.fallback.unavailable'
            )
        );
    });
});
