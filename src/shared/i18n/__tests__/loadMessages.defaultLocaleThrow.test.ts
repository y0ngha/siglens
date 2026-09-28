/**
 * `loadMessages`의 `if (locale === DEFAULT_LOCALE) return {};` 분기는 기본
 * 로케일(ko) 카탈로그 자체가 로드 실패하는 경우다 — 실제 `messages/ko.json`은
 * 항상 존재하므로 자연 상태에서는 재현할 수 없다. 그 모듈만 목으로 던지게 해
 * "폴백 대상마저 없을 때 빈 객체로 떨어진다"는 안전망을 검증한다.
 */
vi.mock('../../../../messages/ko.json', () => {
    throw new Error('catalog missing');
});

describe('loadMessages — 기본 로케일 카탈로그도 로드 실패하는 경우', () => {
    it('ko 카탈로그 로드가 실패하면 빈 객체로 떨어진다(무한 폴백 방지)', async () => {
        const { loadMessages } = await import('../loadMessages');
        expect(await loadMessages('ko')).toEqual({});
    });
});
