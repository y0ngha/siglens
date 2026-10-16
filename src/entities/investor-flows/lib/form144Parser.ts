import {
    streamXmlElements,
    xmlChildText,
    type XmlElement,
} from '@/shared/lib/streamXmlElements';
import type { Form144Document } from '../model';

/** `MM/DD/YYYY`(Form 144 XML 형식) → `YYYY-MM-DD`. 그 밖은 null. */
export function parseUsSlashDate(raw: string | null): string | null {
    if (raw === null) return null;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
    return match === null ? null : `${match[3]}-${match[1]}-${match[2]}`;
}

/** 쉼표·공백을 지운 0 이상의 유한수. 아니면 null. */
function toNonNegative(raw: string | null): number | null {
    if (raw === null) return null;
    const value = Number(raw.replace(/[,\s]/g, ''));
    return Number.isFinite(value) && value >= 0 ? value : null;
}

/** `parent`의 직계 자식 중 이름이 `name`인 것들의 텍스트(빈 값 제외). `parent`가 없으면 빈 목록. */
function childTexts(parent: XmlElement | undefined, name: string): string[] {
    return (parent?.children ?? [])
        .filter(child => child.name === name && child.text !== '')
        .map(child => child.text);
}

function firstChild(
    element: XmlElement | undefined,
    name: string
): XmlElement | undefined {
    return element?.children.find(child => child.name === name);
}

const roundOrNull = (value: number | null): number | null =>
    value === null ? null : Math.round(value);

interface SaleBlock {
    securityClass: string | null;
    shares: number;
    valueUsd: number;
    sharesOutstanding: number | null;
    approxSaleDate: string | null;
    broker: string | null;
}

function readSaleBlock(block: XmlElement): SaleBlock | null {
    const shares = toNonNegative(xmlChildText(block, 'noOfUnitsSold'));
    const value = toNonNegative(xmlChildText(block, 'aggregateMarketValue'));
    if (shares === null || value === null) return null;
    return {
        securityClass: xmlChildText(block, 'securitiesClassTitle'),
        shares: Math.round(shares),
        valueUsd: Math.round(value),
        sharesOutstanding: roundOrNull(
            toNonNegative(xmlChildText(block, 'noOfUnitsOutstanding'))
        ),
        approxSaleDate: parseUsSlashDate(xmlChildText(block, 'approxSaleDate')),
        broker: xmlChildText(block, 'brokerOrMarketmakerDetails', 'name'),
    };
}

const earliest = (dates: readonly (string | null)[]): string | null =>
    dates.filter((d): d is string => d !== null).toSorted()[0] ?? null;
const latest = (dates: readonly (string | null)[]): string | null =>
    dates
        .filter((d): d is string => d !== null)
        .toSorted()
        .at(-1) ?? null;

/**
 * Form 144 `primary_doc.xml`의 루트(`edgarSubmission`) → 매도 예정 신고 내용. 네임스페이스 접두사는 제출 도구마다
 * 다르지만(`ns2:`·`com:`, 2026-10-15 실측) `streamXmlElements`가 로컬 이름만 남기므로 여기서는 신경 쓰지 않는다.
 *
 * `securitiesInformation`은 반복될 수 있다(종류·브로커별) — 수량·금액은 **합산**하고, 종류·브로커·유통주식 수는 첫 블록,
 * 예정일은 가장 이른 날을 쓴다. 10b5-1 계획 채택일(`noticeSignature/planAdoptionDates/planAdoptionDate`)은 여럿이면 가장
 * 늦은 날이다. 필수 값(발행사 CIK·신고자 이름·수량·금액)이 없으면 null — 호출부가 실패로 기록한다.
 */
export function parseForm144(root: XmlElement): Form144Document | null {
    const formData = firstChild(root, 'formData');
    const issuerInfo = firstChild(formData, 'issuerInfo');
    if (formData === undefined || issuerInfo === undefined) return null;
    const issuerCikRaw = xmlChildText(issuerInfo, 'issuerCik');
    const filerName = xmlChildText(
        issuerInfo,
        'nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold'
    );
    if (issuerCikRaw === null || !/^\d{1,10}$/.test(issuerCikRaw)) return null;
    if (filerName === null) return null;

    const blocks = formData.children
        .filter(child => child.name === 'securitiesInformation')
        .map(readSaleBlock);
    const sales = blocks.filter((block): block is SaleBlock => block !== null);
    const [first] = sales;
    // 블록이 없거나 하나라도 수량·금액을 못 읽었으면 합계가 틀린다 — 문서 단위 실패로 둔다.
    if (first === undefined || sales.length !== blocks.length) return null;

    const relationships = childTexts(
        firstChild(issuerInfo, 'relationshipsToIssuer'),
        'relationshipToIssuer'
    );
    const planDates = childTexts(
        firstChild(
            firstChild(formData, 'noticeSignature'),
            'planAdoptionDates'
        ),
        'planAdoptionDate'
    ).map(parseUsSlashDate);

    return {
        issuerCik: issuerCikRaw.padStart(10, '0'),
        issuerName: xmlChildText(issuerInfo, 'issuerName'),
        filerName,
        relationships,
        securityClass: first.securityClass ?? '',
        shares: sales.reduce((sum, sale) => sum + sale.shares, 0),
        valueUsd: sales.reduce((sum, sale) => sum + sale.valueUsd, 0),
        sharesOutstanding: first.sharesOutstanding,
        approxSaleDate: earliest(sales.map(sale => sale.approxSaleDate)),
        planAdoptionDate: latest(planDates),
        broker: first.broker,
    };
}

/** `primary_doc.xml` 텍스트 → 신고 내용. 루트가 없거나 필수 값이 빠졌으면 null, XML이 깨졌으면 파서 오류를 던진다. */
export async function parseForm144Xml(
    xml: string
): Promise<Form144Document | null> {
    let parsed: Form144Document | null = null;
    await streamXmlElements([xml], 'edgarSubmission', root => {
        parsed = parseForm144(root);
    });
    return parsed;
}
