import {AI_SYSTEM_PROMPT, parseJsonResponse, parseNumberEnv, stripMarkdownCodeBlock} from '@/infrastructure/ai/utils';

describe('AI_SYSTEM_PROMPT', () => {
    it('"deterministic" 키워드를 포함한다', () => {
        expect(AI_SYSTEM_PROMPT).toContain('Deterministic');
    });

    it('"한국어" 키워드를 포함한다', () => {
        expect(AI_SYSTEM_PROMPT).toContain('한국어');
    });

    it('"single valid JSON object" 지시를 포함한다', () => {
        expect(AI_SYSTEM_PROMPT).toContain('SINGLE valid JSON object');
    });

    it('"존댓말" 규칙을 포함한다', () => {
        expect(AI_SYSTEM_PROMPT).toContain('존댓말');
    });

    it('"Grounded" 원칙을 포함한다', () => {
        expect(AI_SYSTEM_PROMPT).toContain('Grounded');
    });
});

describe('parseNumberEnv', () => {
    describe('유효한 숫자 문자열이 주어지면', () => {
        it('파싱된 숫자를 반환한다', () => {
            expect(parseNumberEnv('0.5', 1)).toBe(0.5);
        });

        it('정수도 파싱한다', () => {
            expect(parseNumberEnv('3', 8192)).toBe(3);
        });

        it('0을 유효한 값으로 처리한다', () => {
            expect(parseNumberEnv('0', 1)).toBe(0);
        });
    });

    describe('유효하지 않은 입력이 주어지면', () => {
        it('undefined이면 기본값을 반환한다', () => {
            expect(parseNumberEnv(undefined, 42)).toBe(42);
        });

        it('빈 문자열이면 기본값을 반환한다', () => {
            expect(parseNumberEnv('', 42)).toBe(42);
        });

        it('NaN이 되는 문자열이면 기본값을 반환한다', () => {
            expect(parseNumberEnv('abc', 42)).toBe(42);
        });

        it('Infinity이면 기본값을 반환한다', () => {
            expect(parseNumberEnv('Infinity', 42)).toBe(42);
        });
    });
});

describe('stripMarkdownCodeBlock', () => {
    describe('입력이 마크다운 코드 블록으로 감싸진 경우', () => {
        it('json 태그가 있는 코드 블록에서 내용을 추출한다', () => {
            const input = '```json\n{"key": "value"}\n```';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });

        it('json 태그 없는 코드 블록에서 내용을 추출한다', () => {
            const input = '```\n{"key": "value"}\n```';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });

    describe('입력이 일반 텍스트인 경우', () => {
        it('코드 블록 없이 트림된 원본 텍스트를 반환한다', () => {
            const input = '  {"key": "value"}  ';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });

    describe('입력 앞뒤에 공백이 있는 경우', () => {
        it('코드 블록 내 앞뒤 공백을 제거한다', () => {
            const input = '```json\n  {"key": "value"}  \n```';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });

    describe('코드 블록 앞에 일반 텍스트가 있는 경우', () => {
        it('앞의 텍스트를 무시하고 코드 블록 내용을 반환한다', () => {
            const input = '다음과 같습니다:\n```json\n{"key": "value"}\n```';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });

    describe('코드 블록 뒤에 일반 텍스트가 있는 경우', () => {
        it('뒤의 텍스트를 무시하고 코드 블록 내용을 반환한다', () => {
            const input = '```json\n{"key": "value"}\n```\n이상입니다.';

            expect(stripMarkdownCodeBlock(input)).toBe('{"key": "value"}');
        });
    });
});

describe('parseJsonResponse', () => {
    describe('유효한 JSON이 주어지면', () => {
        it('파싱된 객체를 반환한다', () => {
            expect(parseJsonResponse('{"key":"value"}', 'Test')).toEqual({
                key: 'value',
            });
        });
    });

    describe('마크다운 코드 블록으로 감싸진 JSON이 주어지면', () => {
        it('코드 블록을 제거하고 파싱한다', () => {
            expect(
                parseJsonResponse('```json\n{"key":"value"}\n```', 'Test')
            ).toEqual({ key: 'value' });
        });
    });

    describe('유효하지 않은 JSON이 주어지면', () => {
        it('source를 포함한 에러를 던진다', () => {
            expect(() => parseJsonResponse('invalid', 'MySource')).toThrow(
                'Failed to parse MySource response as JSON'
            );
        });

        it('console.error로 source와 raw text를 기록한다', () => {
            const spy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            try {
                parseJsonResponse('invalid', 'MySource');
            } catch {
                /* expected */
            }
            expect(spy).toHaveBeenCalledWith(
                'Failed to parse MySource response. Raw text:',
                'invalid'
            );
            spy.mockRestore();
        });

        it('원래 에러를 cause로 포함한다', () => {
            try {
                parseJsonResponse('invalid', 'MySource');
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
                if (e instanceof Error) {
                    expect(e.cause).toBeInstanceOf(SyntaxError);
                }
            }
        });
    });
});
