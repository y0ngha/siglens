/**
 * DB 콘텐츠 번역 파이프라인 — `content_translations`의 비-ko 행을 채운다.
 *
 *   yarn db:translate:content-locale --locale ja            # dry-run
 *   yarn db:translate:content-locale --locale ja --apply
 *   yarn db:translate:content-locale --locale ja --entity news --limit 200
 *
 * **백필과 다르다.** 백필(`backfillContentLocale.ts`)은 기존 한국어 컬럼을 `ko`
 * 행으로 옮길 뿐이다. 그것만으로는 스위치를 켜도 화면이 그대로다 — 비-ko 행이
 * 없으니 폴백이 걸려 한국어가 나간다. **이 스크립트가 실제로 다국어를 만든다.**
 *
 * **재실행 가능**: 이미 그 로케일 행이 있는 `(entity, id, field)`는 건너뛴다.
 * 배치마다 커밋하므로 중간에 죽어도 앞선 배치는 남는다 — 카탈로그 번역에서
 * 41배치(1,640키)가 42번째의 JSON 오류 하나로 날아간 적이 있다.
 *
 * **약관(`terms`)은 대상이 아니다.** 오역이 곧 의무의 변경이라 읽기 경로가
 * `source='human'` 행만 신뢰한다. AI로 채우면 화면에는 안 나오면서 행만 쌓여
 * "번역됨"이라는 착시를 준다.
 *
 * `src/shared/db/*`를 import하지 않는 이유는 `backfillContentLocale.ts`와 같다
 * (`server-only`는 Next 번들러 가상 모듈이라 `tsx`에서 해석되지 않는다).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { assertRemoteWriteAllowed, readDatabaseUrl } from './lib/dbTarget';
import {
    TRANSLATABLE_ENTITY,
    TRANSLATION_SOURCE,
} from '../../src/shared/db/contentTranslationFields';
import {
    DEFAULT_LOCALE,
    isLocale,
    type Locale,
} from '../../src/shared/i18n/locales';

/** 한 번에 모델에 보낼 항목 수. 카탈로그 번역과 같은 값. */
const BATCH_SIZE = 40;

/** 모델이 사람 이름으로 알아듣는 로케일 표기. */
const LOCALE_NAME: Record<Locale, string> = {
    ko: 'Korean',
    en: 'English',
    ja: 'Japanese',
    zh: 'Simplified Chinese',
};

/**
 * AI 번역을 **하지 않는** 엔티티.
 *
 * `terms`: 인간 번역만 신뢰한다(위 모듈 주석). 오역이 곧 의무의 변경이라
 *   읽기 경로가 `source='human'` 행만 받는다.
 *
 * 종목명·지표명은 아예 `TRANSLATABLE_ENTITY`에 없다 — 여기서 거르는 게 아니라
 * 등록 자체를 안 한다(`contentTranslationFields.ts` 주석).
 */
const EXCLUDED_ENTITIES: readonly string[] = [TRANSLATABLE_ENTITY.terms];

interface PendingRow {
    entity: string;
    entity_id: string;
    field: string;
    value: string;
}

interface Args {
    locale: Locale;
    apply: boolean;
    entity: string | null;
    limit: number | null;
}

function parseArgs(argv: readonly string[]): Args {
    const valueOf = (flag: string): string | null => {
        const index = argv.indexOf(flag);
        return index === -1 ? null : (argv[index + 1] ?? null);
    };
    const rawLocale = valueOf('--locale');
    if (rawLocale === null || !isLocale(rawLocale)) {
        throw new Error('--locale 은 ko|en|ja|zh 중 하나여야 한다');
    }
    if (rawLocale === DEFAULT_LOCALE) {
        throw new Error(
            `--locale ${DEFAULT_LOCALE} 는 원문이다 — 번역 대상이 아니다`
        );
    }
    const rawLimit = valueOf('--limit');
    return {
        locale: rawLocale,
        apply: argv.includes('--apply'),
        entity: valueOf('--entity'),
        limit: rawLimit === null ? null : Number.parseInt(rawLimit, 10),
    };
}

/**
 * 아직 그 로케일 번역이 없는 ko 행.
 *
 * `NOT EXISTS`로 거른다 — 앱에서 걸러 오면 이미 번역된 수만 행을 네트워크로
 * 실어 온 뒤 버리게 된다.
 */
async function findPending(
    sql: postgres.Sql,
    args: Args
): Promise<PendingRow[]> {
    const rows = await sql<PendingRow[]>`
        SELECT source.entity, source.entity_id, source.field, source.value
          FROM content_translations source
         WHERE source.locale = ${DEFAULT_LOCALE}
           AND source.entity <> ALL(${EXCLUDED_ENTITIES as string[]})
           ${
               args.entity === null
                   ? sql``
                   : sql`AND source.entity = ${args.entity}`
           }
           AND NOT EXISTS (
                 SELECT 1 FROM content_translations existing
                  WHERE existing.entity = source.entity
                    AND existing.entity_id = source.entity_id
                    AND existing.field = source.field
                    AND existing.locale = ${args.locale}
               )
         ORDER BY source.entity, source.entity_id, source.field
         ${args.limit === null ? sql`` : sql`LIMIT ${args.limit}`}
    `;
    return rows;
}

/**
 * 용어집. 카탈로그 번역(`scripts/i18n/translate.mjs`)과 **같은 파일**을 쓴다 —
 * UI는 "종합 결론", DB 뉴스 요약은 다른 말로 번역되면 같은 화면에서 용어가
 * 갈린다.
 */
function glossaryLines(locale: Locale): string {
    const glossary = JSON.parse(
        readFileSync(join(process.cwd(), 'messages/glossary.json'), 'utf8')
    ) as Record<string, Partial<Record<Locale, string>>>;
    return Object.entries(glossary)
        .filter(([, translations]) => translations[locale])
        .map(
            ([term, translations]) => `  "${term}" → "${translations[locale]}"`
        )
        .join('\n');
}

function buildPrompt(
    batch: readonly PendingRow[],
    locale: Locale,
    glossary: string
): string {
    const input = Object.fromEntries(
        batch.map((row, index) => [String(index), row.value])
    );
    return `You are localizing database-stored content of a Korean stock-market analysis web app into ${LOCALE_NAME[locale]}.

Rules:
- Translate the VALUE of each entry. Keep the KEY (a numeric index) unchanged.
- The content is news headlines, article summaries, site notices and economic-event commentary. Keep the register of a professional finance product: concise, neutral, no marketing fluff.
- Preserve markdown formatting and line breaks exactly.
- Ticker symbols (AAPL, 005930.KS), indicator names in Latin (RSI, MACD), company and brand names stay as-is.
- Do NOT add explanations, disclaimers, or content that is not in the source.
- Output JSON only.
${glossary ? `\nLocked terminology (use exactly):\n${glossary}\n` : ''}
Input is a JSON object of index → Korean text.
Output a JSON object with the SAME keys and translated values. No other text.

${JSON.stringify(input)}`;
}

/**
 * Gemini 호출. 키가 없으면 즉시 실패한다 — 조용히 원문을 복사하면 그 행이
 * "번역됨"으로 저장되고, 화면에는 한국어가 나가면서 재실행 대상에서도 빠진다.
 */
async function callModel(prompt: string): Promise<Record<string, string>> {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 없다');
    }
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0 },
    });
    return parseModelJson(response.text ?? '');
}

/**
 * 모델 JSON 파싱 — `jsonrepair` 폴백.
 *
 * `responseMimeType: 'application/json'`을 줘도 깨진 이스케이프가 섞여 나온다
 * (카탈로그 번역 실측: 42번째 배치에서 `Bad escaped character in JSON`).
 * 원문에 따옴표·백슬래시가 들어 있으면 확률이 올라간다.
 */
function parseModelJson(text: string): Record<string, string> {
    try {
        return JSON.parse(text) as Record<string, string>;
    } catch {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { jsonrepair } = require('jsonrepair') as {
            jsonrepair: (input: string) => string;
        };
        return JSON.parse(jsonrepair(text)) as Record<string, string>;
    }
}

export interface TranslateSummary {
    pending: number;
    translated: number;
    failedBatches: number;
}

export async function translateContentLocale(
    sql: postgres.Sql,
    args: Args
): Promise<TranslateSummary> {
    const pending = await findPending(sql, args);
    console.log(
        `[translate] ${args.locale}: 번역 대기 ${pending.length}행` +
            (args.entity === null ? '' : ` (entity=${args.entity})`)
    );
    if (!args.apply || pending.length === 0) {
        return { pending: pending.length, translated: 0, failedBatches: 0 };
    }

    const glossary = glossaryLines(args.locale);
    let translated = 0;
    let failedBatches = 0;

    for (let index = 0; index < pending.length; index += BATCH_SIZE) {
        const batch = pending.slice(index, index + BATCH_SIZE);
        let output: Record<string, string>;
        try {
            output = await callModel(buildPrompt(batch, args.locale, glossary));
        } catch (error: unknown) {
            // 배치 하나가 죽어도 나머지는 계속한다. 재실행이 남은 것만 집는다.
            failedBatches += 1;
            console.error(
                `[translate] batch ${index / BATCH_SIZE} 실패:`,
                error
            );
            continue;
        }

        const rows = batch
            .map((row, offset) => ({ row, value: output[String(offset)] }))
            .filter(
                (entry): entry is { row: PendingRow; value: string } =>
                    typeof entry.value === 'string' &&
                    entry.value.trim().length > 0
            )
            .map(({ row, value }) => ({
                entity: row.entity,
                entity_id: row.entity_id,
                field: row.field,
                locale: args.locale,
                value,
                source: TRANSLATION_SOURCE.ai,
            }));

        if (rows.length === 0) continue;
        // 배치마다 쓴다 — 뒤 배치가 죽어도 앞의 것은 남는다.
        await sql`
            INSERT INTO content_translations ${sql(rows)}
            ON CONFLICT DO NOTHING
        `;
        translated += rows.length;
        console.log(
            `[translate] ${translated}/${pending.length} (batch ${index / BATCH_SIZE})`
        );
    }
    return { pending: pending.length, translated, failedBatches };
}

async function main(): Promise<void> {
    const { databaseUrl, target } = readDatabaseUrl();
    const args = parseArgs(process.argv.slice(2));
    if (!args.apply) {
        console.log('[translate] dry-run — 실제로 쓰려면 --apply를 붙일 것');
    } else {
        // 번역은 쓰기 + 실제 과금이다. 원격 대상은 기본 거부한다.
        assertRemoteWriteAllowed(target, 'translate');
    }

    const sql = postgres(databaseUrl, { max: 1 });
    try {
        const summary = await translateContentLocale(sql, args);
        console.log(
            `[translate] ${args.apply ? 'wrote' : 'would write'} ${summary.translated}/${summary.pending} row(s)` +
                (summary.failedBatches > 0
                    ? ` — 실패 배치 ${summary.failedBatches}개(재실행하면 이어서 처리)`
                    : '')
        );
        // 실패 배치가 있으면 exit 1 — CI/크론이 성공으로 오인하면 안 된다.
        if (summary.failedBatches > 0) process.exit(1);
    } finally {
        await sql.end();
    }
}

void main().catch((error: unknown) => {
    console.error('[translate] failed:', error);
    process.exit(1);
});
