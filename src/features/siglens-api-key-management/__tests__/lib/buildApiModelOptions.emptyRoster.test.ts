import { buildApiModelOptionGroups } from '@/features/siglens-api-key-management/lib/buildApiModelOptions';

// 로스터에 모델이 없는 provider를 등록한 상황 — 계정 페이지는 `groups.length > 0`으로
// "BYOK 사용 가능"을 판단하므로(발급 확인 모달·기본 모델 선택기가 같은 기준), 이 경우 그룹이
// 비어야 둘이 함께 "키 없음"으로 일치한다.
vi.mock('@/entities/siglens-api-key/lib/apiModels', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/entities/siglens-api-key/lib/apiModels')
    >()),
    listApiSelectableModels: () => [],
}));

describe('buildApiModelOptionGroups — 선택 가능한 모델이 없는 provider', () => {
    it('provider를 등록했어도 모델이 없으면 그룹이 비어 있다', () => {
        expect(buildApiModelOptionGroups(['anthropic', 'openai'])).toEqual([]);
    });
});
