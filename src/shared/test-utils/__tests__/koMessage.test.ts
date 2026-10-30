import { describe, expect, it } from 'vitest';
import { resolveCatalogPath } from '@/shared/test-utils/catalogTranslator';
import { koMessage } from '@/shared/test-utils/koMessage';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';

describe('koMessage', () => {
    it('있는 경로는 ko 카탈로그의 문자열을 돌려준다', () => {
        expect(koMessage('entities.analysis.fallback.unavailable')).toBe(
            resolveCatalogPath(
                MESSAGE_CATALOGS.ko,
                'entities.analysis.fallback.unavailable'
            )
        );
    });

    it('없는 경로는 던진다', () => {
        expect(() => koMessage('shared.__missing__')).toThrow('__missing__');
    });
});
