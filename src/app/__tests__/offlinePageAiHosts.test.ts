import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES } from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';

const ROOT = path.resolve(__dirname, '../../..');
const offline = readFileSync(path.join(ROOT, 'public/offline.html'), 'utf8');
const aiHostSource = readFileSync(
    path.join(ROOT, 'src/shared/config/aiHost.ts'),
    'utf8'
);

function quotedList(source: string, pattern: RegExp): string[] {
    const body = source.match(pattern)?.[1] ?? '';
    return [...body.matchAll(/'([^']+)'/g)].map(m => m[1]!).sort();
}

/**
 * `public/offline.html`은 정적 파일이라 ai 호스트 판정·로케일 목록을 import하지 못하고 손으로
 * 적는다. 원본(`AI_HOSTS`, `LOCALES`)이 바뀌었는데 이쪽이 남으면 설치한 SIGLENS AI 앱의
 * 오프라인 화면이 메인 사이트 이름으로 돌아간다.
 */
describe('offline.html — 손으로 적은 목록이 원본과 같다', () => {
    it('ai 호스트 목록이 aiHost.ts의 AI_HOSTS와 같다', () => {
        expect(quotedList(offline, /var AI_HOSTS = \[([^\]]*)\]/)).toEqual(
            quotedList(aiHostSource, /const AI_HOSTS[^[]*\[([^\]]*)\]/)
        );
    });

    it('제품명이 brandAiName과 같다(기본 로케일·그 외)', () => {
        const names = offline.match(/\? '([^']+)' : '([^']+)'/);
        expect(names?.[1]).toBe(brandAiName('en'));
        expect(names?.[2]).toBe(brandAiName(DEFAULT_LOCALE));
        // 접두사 로케일은 모두 같은 표기여야 이 파일의 2갈래 분기가 맞다.
        for (const locale of LOCALES.filter(l => l !== DEFAULT_LOCALE)) {
            expect(brandAiName(locale)).toBe(brandAiName('en'));
        }
    });

    it('접두사 로케일 목록이 기본 로케일을 뺀 LOCALES와 같다', () => {
        expect(quotedList(offline, /\[([^\]]*)\]\.indexOf\(seg\)/)).toEqual(
            LOCALES.filter(l => l !== DEFAULT_LOCALE).sort()
        );
    });
});
