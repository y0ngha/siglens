import type { MailAlertTopic } from '@/entities/mail-alert/model';

/**
 * 항목을 폼 필드(`kind`와 그에 맞는 `symbol`·`signalType`·`market`)로 편다. 서버의 `parseTopicInput`이
 * 읽는 이름과 같다 — 코드 확인 폼이 숨은 입력으로 싣는다.
 */
export function topicFormFields(
    topic: MailAlertTopic
): readonly (readonly [name: string, value: string])[] {
    switch (topic.kind) {
        case 'symbol':
            return [
                ['kind', 'symbol'],
                ['symbol', topic.symbol],
            ];
        case 'signal':
            return [
                ['kind', 'signal'],
                ['signalType', topic.signalType],
            ];
        case 'fear_greed':
            return [
                ['kind', 'fear_greed'],
                ['market', topic.market],
            ];
    }
}
