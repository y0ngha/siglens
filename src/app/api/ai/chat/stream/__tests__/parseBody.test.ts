import { describe, expect, it, vi } from 'vitest';
import { followUpLine } from '@/app/api/ai/chat/followUps';
import {
    GUEST_HISTORY_MESSAGE_MAX_CHARS,
    parseBody,
} from '@/app/api/ai/chat/stream/_lib/parseBody';
import { MESSAGE_MAX_CHARS } from '@/features/agent-chat/lib/messageLimits';
import {
    CHAT_IMAGE_DECODED_MAX_BYTES,
    CHAT_IMAGES_PER_MESSAGE_MAX,
} from '@/shared/config/chatImages';

const png = (bytes = 8) => ({
    mediaType: 'image/png',
    data: Buffer.alloc(bytes, 7).toString('base64'),
});

describe('parseBody', () => {
    it('action 생략 시 send로 해석한다', () => {
        expect(parseBody({ message: ' hi ' })).toEqual({
            conversationId: null,
            message: 'hi',
            action: 'send',
            history: [],
            images: [],
        });
    });

    it('배열이 문자열로 바뀌면 send와 같아 보이는 action도 거절한다', () => {
        expect(parseBody({ action: ['send'], message: 'x' })).toBeNull();
    });

    it('action: null은 거절한다', () => {
        expect(parseBody({ action: null, message: 'x' })).toBeNull();
    });

    it('공백뿐인 메시지는 거절한다', () => {
        expect(parseBody({ message: '   ' })).toBeNull();
    });

    it('상한을 넘는 메시지는 거절한다', () => {
        expect(
            parseBody({ message: 'a'.repeat(MESSAGE_MAX_CHARS + 1) })
        ).toBeNull();
    });

    it('상한 길이 메시지는 받는다', () => {
        expect(
            parseBody({ message: 'a'.repeat(MESSAGE_MAX_CHARS) })
        ).not.toBeNull();
    });

    it('regenerate는 빈 메시지를 허용한다', () => {
        expect(parseBody({ action: 'regenerate' })).toMatchObject({
            action: 'regenerate',
            message: '',
        });
    });

    it.each([0, -1, 1.5, '2', null, undefined])(
        'edit: editSeq=%s는 거절한다',
        editSeq => {
            expect(
                parseBody({ action: 'edit', message: 'x', editSeq })
            ).toBeNull();
        }
    );

    it('edit: 양의 정수 editSeq는 본문에 실린다', () => {
        expect(
            parseBody({ action: 'edit', message: 'x', editSeq: 3 })
        ).toMatchObject({ action: 'edit', editSeq: 3 });
    });

    it('게스트 기록: 형식이 틀리면 거절한다', () => {
        expect(parseBody({ message: 'x', history: 'no' })).toBeNull();
        expect(
            parseBody({
                message: 'x',
                history: [{ role: 'tool', content: 'c' }],
            })
        ).toBeNull();
    });

    it('게스트 기록: 최근 20개만 남긴다', () => {
        const history = Array.from({ length: 25 }, (_, i) => ({
            role: 'user',
            content: `m${i}`,
        }));
        const parsed = parseBody({ message: 'x', history });
        expect(parsed?.history).toHaveLength(20);
        expect(parsed?.history[0]?.content).toBe('m5');
    });

    it('게스트 기록: 공백뿐인 항목은 버린다', () => {
        const parsed = parseBody({
            message: 'x',
            history: [
                { role: 'user', content: '  ' },
                { role: 'user', content: ' keep ' },
            ],
        });
        expect(parsed?.history).toEqual([{ role: 'user', content: 'keep' }]);
    });

    it('게스트 기록: 항목 길이를 상한으로 자른다', () => {
        const parsed = parseBody({
            message: 'x',
            history: [
                {
                    role: 'user',
                    content: 'z'.repeat(GUEST_HISTORY_MESSAGE_MAX_CHARS + 10),
                },
            ],
        });
        expect(parsed?.history[0]?.content).toHaveLength(
            GUEST_HISTORY_MESSAGE_MAX_CHARS
        );
    });

    it('게스트 기록: assistant 답변에는 후속 질문 마커 줄을 되붙인다', () => {
        const followUps = ['더 알려줘', '다른 종목은?'];
        const parsed = parseBody({
            message: 'x',
            history: [{ role: 'assistant', content: 'ans', followUps }],
        });
        expect(parsed?.history[0]?.content).toBe(
            `ans${followUpLine(followUps)}`
        );
    });

    it('게스트 기록: 마커 줄이 붙어도 상한을 넘지 않고 줄은 잘리지 않는다', () => {
        const followUps = ['더 알려줘'];
        const line = followUpLine(followUps);
        const parsed = parseBody({
            message: 'x',
            history: [
                {
                    role: 'assistant',
                    content: 'z'.repeat(GUEST_HISTORY_MESSAGE_MAX_CHARS),
                    followUps,
                },
            ],
        });
        const content = parsed?.history[0]?.content ?? '';
        expect(content).toHaveLength(GUEST_HISTORY_MESSAGE_MAX_CHARS);
        expect(content.endsWith(line)).toBe(true);
    });

    it('게스트 기록: user 항목의 followUps는 무시한다', () => {
        const parsed = parseBody({
            message: 'x',
            history: [{ role: 'user', content: 'q', followUps: ['a'] }],
        });
        expect(parsed?.history[0]?.content).toBe('q');
    });
    describe('이미지', () => {
        it('이미지가 있으면 빈 메시지도 받고 디코드하지 않은 base64 문자열을 싣는다', () => {
            const parsed = parseBody({ message: '', images: [png(8)] });
            expect(parsed?.message).toBe('');
            expect(parsed?.images).toEqual([png(8).data]);
        });

        it('검증 중에는 이미지를 디코드(Buffer 할당)하지 않는다', () => {
            const from = vi.spyOn(Buffer, 'from');
            const parsed = parseBody({
                message: 'x',
                images: [png(CHAT_IMAGE_DECODED_MAX_BYTES)],
            });
            const decodeCalls = from.mock.calls.filter(
                (call: readonly unknown[]) => call[1] === 'base64'
            );
            from.mockRestore();
            expect(parsed?.images.every(i => typeof i === 'string')).toBe(true);
            expect(decodeCalls).toHaveLength(0);
        });

        it('이미지도 글도 없으면 거절한다', () => {
            expect(parseBody({ message: '  ', images: [] })).toBeNull();
        });

        it('이미지가 있어도 글이 상한을 넘으면 거절한다', () => {
            expect(
                parseBody({
                    message: 'a'.repeat(MESSAGE_MAX_CHARS + 1),
                    images: [png()],
                })
            ).toBeNull();
        });

        it('4장은 받고 5장은 거절한다', () => {
            const four = Array.from(
                { length: CHAT_IMAGES_PER_MESSAGE_MAX },
                () => png()
            );
            expect(
                parseBody({ message: 'x', images: four })?.images
            ).toHaveLength(4);
            expect(
                parseBody({ message: 'x', images: [...four, png()] })
            ).toBeNull();
        });

        it('base64가 아닌 값·data: 접두사·줄바꿈은 거절한다', () => {
            const bad = [
                'not base64!',
                'data:image/png;base64,AAAA',
                'AAAA\nAAAA',
                'AAA',
            ];
            bad.forEach(data => {
                expect(
                    parseBody({
                        message: 'x',
                        images: [{ mediaType: 'image/png', data }],
                    })
                ).toBeNull();
            });
        });

        it('허용하지 않는 mediaType·모양은 거절한다', () => {
            expect(
                parseBody({
                    message: 'x',
                    images: [{ mediaType: 'image/svg+xml', data: png().data }],
                })
            ).toBeNull();
            expect(parseBody({ message: 'x', images: ['AAAA'] })).toBeNull();
            expect(parseBody({ message: 'x', images: 'AAAA' })).toBeNull();
        });

        it('디코드 후 10MB 이하는 받고 초과는 거절한다', () => {
            expect(
                parseBody({
                    message: 'x',
                    images: [png(CHAT_IMAGE_DECODED_MAX_BYTES)],
                })?.images
            ).toHaveLength(1);
            expect(
                parseBody({
                    message: 'x',
                    images: [png(CHAT_IMAGE_DECODED_MAX_BYTES + 1)],
                })
            ).toBeNull();
        });

        it('edit는 이미지를 읽고 regenerate는 이미지가 실려 오면 거절한다', () => {
            expect(
                parseBody({
                    action: 'edit',
                    editSeq: 2,
                    message: 'x',
                    images: [png()],
                })?.images
            ).toHaveLength(1);
            expect(
                parseBody({ action: 'regenerate', images: [png()] })
            ).toBeNull();
            expect(parseBody({ action: 'regenerate' })?.images).toEqual([]);
        });

        it('게스트 기록: imageCount가 있는 user 항목은 끝 줄에 첨부 표식이 붙는다', () => {
            const parsed = parseBody({
                message: 'x',
                history: [
                    { role: 'user', content: '이거 어때?', imageCount: 2 },
                ],
            });
            expect(parsed?.history[0]?.content).toBe(
                '이거 어때?\n[attached images: 2]'
            );
        });

        it('게스트 기록: 글 없이 이미지만 있던 user 항목은 표식만 남는다', () => {
            const parsed = parseBody({
                message: 'x',
                history: [{ role: 'user', content: '', imageCount: 1 }],
            });
            expect(parsed?.history).toEqual([
                { role: 'user', content: '[attached images: 1]' },
            ]);
        });

        it('게스트 기록: 긴 글이어도 표식 줄은 잘리지 않고 상한을 넘지 않는다', () => {
            const parsed = parseBody({
                message: 'x',
                history: [
                    {
                        role: 'user',
                        content: 'z'.repeat(GUEST_HISTORY_MESSAGE_MAX_CHARS),
                        imageCount: 3,
                    },
                ],
            });
            const content = parsed?.history[0]?.content ?? '';
            expect(content).toHaveLength(GUEST_HISTORY_MESSAGE_MAX_CHARS);
            expect(content.endsWith('\n[attached images: 3]')).toBe(true);
        });

        it('게스트 기록: imageCount가 0·음수·소수·5 이상·assistant면 거절한다', () => {
            [0, -1, 1.5, 5, '2'].forEach(imageCount => {
                expect(
                    parseBody({
                        message: 'x',
                        history: [{ role: 'user', content: 'q', imageCount }],
                    })
                ).toBeNull();
            });
            expect(
                parseBody({
                    message: 'x',
                    history: [
                        { role: 'assistant', content: 'a', imageCount: 1 },
                    ],
                })
            ).toBeNull();
        });
    });
});
