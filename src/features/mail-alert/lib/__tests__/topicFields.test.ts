import { parseTopicInput } from '@/entities/mail-alert/lib/topics';
import type { MailAlertTopic } from '@/entities/mail-alert/model';
import { topicFormFields } from '@/features/mail-alert/lib/topicFields';

const TOPICS: readonly MailAlertTopic[] = [
    { kind: 'symbol', symbol: 'AAPL' },
    { kind: 'signal', signalType: 'golden_cross' },
    { kind: 'fear_greed', market: 'kr' },
];

describe('topicFormFields', () => {
    it.each(TOPICS)(
        '펼친 필드를 서버의 parseTopicInput이 같은 항목으로 되읽는다 (%j)',
        topic => {
            const form = new FormData();
            topicFormFields(topic).forEach(([name, value]) =>
                form.set(name, value)
            );
            expect(parseTopicInput(form)).toEqual(topic);
        }
    );
});
