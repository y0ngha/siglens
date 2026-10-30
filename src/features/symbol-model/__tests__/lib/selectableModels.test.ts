import type { ModelId } from '@y0ngha/siglens-core';
import { splitSelectableModels } from '@/features/symbol-model/lib/selectableModels';

const FREE = 'gemini-3.5-flash-lite' as ModelId;
const HAIKU = 'claude-haiku-5-5' as ModelId;
const SONNET = 'claude-sonnet-5-5' as ModelId;

describe('splitSelectableModels', () => {
    it('꺼진 모델 중 등급 목록에 있는 것만 unavailableModels로 표시한다', () => {
        expect(
            splitSelectableModels([FREE, HAIKU], [HAIKU, SONNET])
                .unavailableModels
        ).toEqual([HAIKU]);
    });

    it('꺼진 모델은 selectableModels에서 뺀다', () => {
        expect(
            splitSelectableModels([FREE, HAIKU], [HAIKU, SONNET])
                .selectableModels
        ).toEqual([FREE]);
    });

    it('꺼진 모델이 등급 목록에 없으면 등급 목록 배열을 그대로 돌려준다(같은 참조)', () => {
        const allowed = [FREE, HAIKU];

        expect(splitSelectableModels(allowed, [SONNET]).selectableModels).toBe(
            allowed
        );
    });
});
