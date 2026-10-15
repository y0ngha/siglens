/** Real SEC/FINRA record shapes (2026-10-15 probe), trimmed. Synthetic variants are derived from real rows and noted. */

export const PRIMARY_DOC_ORIGINAL =
    '<?xml version="1.0" encoding="UTF-8"?>\n<edgarSubmission xsi:schemaLocation="http://www.sec.gov/edgar/thirteenffiler eis_13F_Filer.xsd" xmlns="http://www.sec.gov/edgar/thirteenffiler" xmlns:ns1="http://www.sec.gov/edgar/common" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <schemaVersion>X0202</schemaVersion>\n  <headerData>\n    <submissionType>13F-HR</submissionType>\n    <filerInfo>\n      <liveTestFlag>LIVE</liveTestFlag>\n      <flags>\n        <confirmingCopyFlag>false</confirmingCopyFlag>\n        <overrideInternetFlag>false</overrideInternetFlag>\n      </flags>\n      <filer>\n        <credentials>\n          <cik>0002148692</cik>\n          <ccc>XXXXXXXX</ccc>\n        </credentials>\n      </filer>\n      <periodOfReport>09-30-2026</periodOfReport>\n    </filerInfo>\n  </headerData>\n  <formData>\n    <coverPage>\n      <reportCalendarOrQuarter>09-30-2026</reportCalendarOrQuarter>\n      <isAmendment>false</isAmendment>\n      <filingManager>\n        <name>15 Wealth Advisors LLC</name>\n        <address>\n          <ns1:street1>291 N ARCHER AVE</ns1:street1>\n          <ns1:city>MUNDELEIN</ns1:city>\n          <ns1:stateOrCountry>IL</ns1:stateOrCountry>\n          <ns1:zipCode>60060</ns1:zipCode>\n        </address>\n      </filingManager>\n      <reportType>13F HOLDINGS REPORT</reportType>\n      <form13FFileNumber>028-27227</form13FFileNumber>\n      <crdNumber>000337459</crdNumber>\n      <secFileNumber>801-135695</secFileNumber>\n      <provideInfoForInstruction>N</provideInfoForInstruction>\n    </coverPage>\n    <signatureBlock>\n      <name>MIRANDA O\'KEEFE</name>\n      <title>CHIEF COMPLIANCE OFFICER</title>\n      <phone>847-735-7103</phone>\n      <signature>/s/ MIRANDA O\'KEEFE</signature>\n      <city>Mundelein</city>\n      <stateOrCountry>IL</stateOrCountry>\n      <signatureDate>10-14-2026</signatureDate>\n    </signatureBlock>\n    <summaryPage>\n      <otherIncludedManagersCount>0</otherIncludedManagersCount>\n      <tableEntryTotal>108</tableEntryTotal>\n      <tableValueTotal>399130224</tableValueTotal>\n    </summaryPage>\n  </formData>\n</edgarSubmission>\n';

export const PRIMARY_DOC_NEW_HOLDINGS =
    '<?xml version="1.0" encoding="UTF-8"?>\n<edgarSubmission xmlns="http://www.sec.gov/edgar/thirteenffiler" xmlns:com="http://www.sec.gov/edgar/common">\n  <schemaVersion>X0202</schemaVersion>\n  <headerData>\n    <submissionType>13F-HR/A</submissionType>\n    <filerInfo>\n      <liveTestFlag>LIVE</liveTestFlag>\n      <flags>\n        <confirmingCopyFlag>false</confirmingCopyFlag>\n        <returnCopyFlag>true</returnCopyFlag>\n        <overrideInternetFlag>false</overrideInternetFlag>\n      </flags>\n      <filer>\n        <credentials>\n          <cik>0001768130</cik>\n          <ccc>XXXXXXXX</ccc>\n        </credentials>\n      </filer>\n      <periodOfReport>06-30-2026</periodOfReport>\n    </filerInfo>\n  </headerData>\n  <formData>\n    <coverPage>\n      <reportCalendarOrQuarter>06-30-2026</reportCalendarOrQuarter>\n      <isAmendment>true</isAmendment>\n      <amendmentNo>1</amendmentNo>\n      <amendmentInfo>\n        <amendmentType>NEW HOLDINGS</amendmentType>\n      </amendmentInfo>\n      <filingManager>\n        <name>HOWARD FINANCIAL SERVICES, LTD.</name>\n        <address>\n          <com:street1>8350 MEADOW ROAD</com:street1>\n          <com:street2>SUITE 181</com:street2>\n          <com:city>DALLAS</com:city>\n          <com:stateOrCountry>TX</com:stateOrCountry>\n          <com:zipCode>75231</com:zipCode>\n        </address>\n      </filingManager>\n      <reportType>13F HOLDINGS REPORT</reportType>\n      <form13FFileNumber>028-19410</form13FFileNumber>\n      <crdNumber>000107978</crdNumber>\n      <secFileNumber>801-46741</secFileNumber>\n      <provideInfoForInstruction>N</provideInfoForInstruction>\n    </coverPage>\n    <signatureBlock>\n      <name>Jason Post</name>\n      <title>CCO</title>\n      <phone>214-346-0785</phone>\n      <signature>Jason Post</signature>\n      <city>Dallas</city>\n      <stateOrCountry>TX</stateOrCountry>\n      <signatureDate>10-14-2026</signatureDate>\n    </signatureBlock>\n    <summaryPage>\n      <otherIncludedManagersCount>0</otherIncludedManagersCount>\n      <tableEntryTotal>238</tableEntryTotal>\n      <tableValueTotal>927269006</tableValueTotal>\n    </summaryPage>\n  </formData>\n</edgarSubmission>\n';

export const PRIMARY_DOC_RESTATEMENT =
    '<?xml version="1.0" encoding="UTF-8"?>\n<edgarSubmission xmlns="http://www.sec.gov/edgar/thirteenffiler" xmlns:com="http://www.sec.gov/edgar/common">\n  <schemaVersion>X0202</schemaVersion>\n  <headerData>\n    <submissionType>13F-HR/A</submissionType>\n    <filerInfo>\n      <liveTestFlag>LIVE</liveTestFlag>\n      <flags>\n        <confirmingCopyFlag>false</confirmingCopyFlag>\n        <returnCopyFlag>false</returnCopyFlag>\n        <overrideInternetFlag>false</overrideInternetFlag>\n      </flags>\n      <filer>\n        <credentials>\n          <cik>0001828808</cik>\n          <ccc>XXXXXXXX</ccc>\n        </credentials>\n      </filer>\n      <periodOfReport>03-31-2017</periodOfReport>\n    </filerInfo>\n  </headerData>\n  <formData>\n    <coverPage>\n      <reportCalendarOrQuarter>03-31-2017</reportCalendarOrQuarter>\n      <isAmendment>true</isAmendment>\n      <amendmentNo>1</amendmentNo>\n      <amendmentInfo>\n        <amendmentType>RESTATEMENT</amendmentType>\n        <confDeniedExpired>false</confDeniedExpired>\n      </amendmentInfo>\n      <filingManager>\n        <name>Oslo Pensjonsforsikring AS</name>\n        <address>\n          <com:street1>POSTBOKS 6623 ST. OLAVS PLASS</com:street1>\n          <com:city>Oslo</com:city>\n          <com:stateOrCountry>Q8</com:stateOrCountry>\n          <com:zipCode>0129</com:zipCode>\n        </address>\n      </filingManager>\n      <reportType>13F HOLDINGS REPORT</reportType>\n      <form13FFileNumber>028-26869</form13FFileNumber>\n      <provideInfoForInstruction>N</provideInfoForInstruction>\n    </coverPage>\n    <signatureBlock>\n      <name>Stig Faltinsen</name>\n      <title>Chief Investment Officer</title>\n      <phone>004723360800</phone>\n      <signature>Stig Faltinsen</signature>\n      <city>Oslo</city>\n      <stateOrCountry>Q8</stateOrCountry>\n      <signatureDate>10-09-2026</signatureDate>\n    </signatureBlock>\n    <summaryPage>\n      <otherIncludedManagersCount>0</otherIncludedManagersCount>\n      <tableEntryTotal>9</tableEntryTotal>\n      <tableValueTotal>192505791</tableValueTotal>\n    </summaryPage>\n  </formData>\n</edgarSubmission>\n';

/** Real rows (ABBOTT, MSFT, NVDA) + variants derived from them: a Put row, a PRN row, a duplicate MSFT row, a non-universe CUSIP. */
export const INFO_TABLE_SAMPLE =
    '<?xml version="1.0" ?>\n<informationTable xsi:schemaLocation="http://www.sec.gov/edgar/document/thirteenf/informationtable eis_13FDocument.xsd" xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable" xmlns:n1="http://www.sec.gov/edgar/document/thirteenf/informationtable" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <infoTable>\n    <nameOfIssuer>ABBOTT LABORATORIES</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>002824100</cusip>\n    <value>1912972</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>19357</sshPrnamt>\n      <sshPrnamtType>SH</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <investmentDiscretion>SOLE</investmentDiscretion>\n    <votingAuthority>\n      <Sole>0</Sole>\n      <Shared>0</Shared>\n      <None>19357</None>\n    </votingAuthority>\n  </infoTable>\n  <infoTable>\n    <nameOfIssuer>MICROSOFT CORP</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>594918104</cusip>\n    <value>3485841</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>6795</sshPrnamt>\n      <sshPrnamtType>SH</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <investmentDiscretion>SOLE</investmentDiscretion>\n    <votingAuthority>\n      <Sole>0</Sole>\n      <Shared>0</Shared>\n      <None>6795</None>\n    </votingAuthority>\n  </infoTable>\n  <infoTable>\n    <nameOfIssuer>MICROSOFT CORP</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>594918104</cusip>\n    <value>3485841</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>6795</sshPrnamt>\n      <sshPrnamtType>SH</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <putCall>Put</putCall>\n    <investmentDiscretion>SOLE</investmentDiscretion>\n    <votingAuthority>\n      <Sole>0</Sole>\n      <Shared>0</Shared>\n      <None>6795</None>\n    </votingAuthority>\n  </infoTable>\n  <infoTable>\n    <nameOfIssuer>NVIDIA CORPORATION</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>67066G104</cusip>\n    <value>6618509</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>28979</sshPrnamt>\n      <sshPrnamtType>PRN</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <investmentDiscretion>SOLE</investmentDiscretion>\n    <votingAuthority>\n      <Sole>0</Sole>\n      <Shared>0</Shared>\n      <None>28979</None>\n    </votingAuthority>\n  </infoTable>\n  <infoTable>\n    <nameOfIssuer>MICROSOFT CORP</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>594918104</cusip>\n    <value>2000</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>5</sshPrnamt>\n      <sshPrnamtType>SH</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <investmentDiscretion>SOLE</investmentDiscretion>\n    <votingAuthority>\n      <Sole>0</Sole>\n      <Shared>0</Shared>\n      <None>6795</None>\n    </votingAuthority>\n  </infoTable>\n  <infoTable>\n    <nameOfIssuer>ABBOTT LABORATORIES</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>ZZZZZZZZ9</cusip>\n    <value>1912972</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>19357</sshPrnamt>\n      <sshPrnamtType>SH</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <investmentDiscretion>SOLE</investmentDiscretion>\n    <votingAuthority>\n      <Sole>0</Sole>\n      <Shared>0</Shared>\n      <None>19357</None>\n    </votingAuthority>\n  </infoTable>\n  <infoTable>\n    <nameOfIssuer>NVIDIA CORPORATION</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>67066G104</cusip>\n    <value>6618509</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>28979</sshPrnamt>\n      <sshPrnamtType>SH</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <investmentDiscretion>SOLE</investmentDiscretion>\n    <votingAuthority>\n      <Sole>0</Sole>\n      <Shared>0</Shared>\n      <None>28979</None>\n    </votingAuthority>\n  </infoTable>\n</informationTable>\n';

export const INFO_TABLE_ZERO_SHARES_ROW =
    '<infoTable>\n    <nameOfIssuer>ABBOTT LABORATORIES</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>002824100</cusip>\n    <value>1912972</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>0</sshPrnamt>\n      <sshPrnamtType>SH</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <investmentDiscretion>SOLE</investmentDiscretion>\n    <votingAuthority>\n      <Sole>0</Sole>\n      <Shared>0</Shared>\n      <None>19357</None>\n    </votingAuthority>\n  </infoTable>';

/** Real `ns1:`-prefixed information table (OSLO PENSJONSFORSIKRING), first two rows. */
export const INFO_TABLE_PREFIXED =
    '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<ns1:informationTable xmlns:ns1="http://www.sec.gov/edgar/document/thirteenf/informationtable">\n    <ns1:infoTable>\n    <ns1:nameOfIssuer>Amazon.com, Inc.</ns1:nameOfIssuer>\n    <ns1:titleOfClass>COM</ns1:titleOfClass>\n    <ns1:cusip>023135106</ns1:cusip>\n    <ns1:figi>BBG000BVPV84</ns1:figi>\n    <ns1:value>22163500</ns1:value>\n    <ns1:shrsOrPrnAmt>\n      <ns1:sshPrnamt>25000</ns1:sshPrnamt>\n      <ns1:sshPrnamtType>SH</ns1:sshPrnamtType>\n    </ns1:shrsOrPrnAmt>\n    <ns1:investmentDiscretion>SOLE</ns1:investmentDiscretion>\n    <ns1:votingAuthority>\n      <ns1:Sole>25000</ns1:Sole>\n      <ns1:Shared>0</ns1:Shared>\n      <ns1:None>0</ns1:None>\n    </ns1:votingAuthority>\n  </ns1:infoTable>\n  <ns1:infoTable>\n    <ns1:nameOfIssuer>AstraZeneca Plc</ns1:nameOfIssuer>\n    <ns1:titleOfClass>COM</ns1:titleOfClass>\n    <ns1:cusip>G0593M107</ns1:cusip>\n    <ns1:figi>BBG000C0YDQ1</ns1:figi>\n    <ns1:value>21250106</ns1:value>\n    <ns1:shrsOrPrnAmt>\n      <ns1:sshPrnamt>340000</ns1:sshPrnamt>\n      <ns1:sshPrnamtType>SH</ns1:sshPrnamtType>\n    </ns1:shrsOrPrnAmt>\n    <ns1:investmentDiscretion>SOLE</ns1:investmentDiscretion>\n    <ns1:votingAuthority>\n      <ns1:Sole>340000</ns1:Sole>\n      <ns1:Shared>0</ns1:Shared>\n      <ns1:None>0</ns1:None>\n    </ns1:votingAuthority>\n  </ns1:infoTable>\n</ns1:informationTable>\n';

export const FORM_INDEX_SAMPLE =
    'Description:           Daily Index of EDGAR Dissemination Feed by Form Type\nLast Data Received:    Oct 14, 2026\nComments:              webmaster@sec.gov\nAnonymous FTP:         ftp://ftp.sec.gov/edgar/\n \n \n \n \nForm Type   Company Name                                                  CIK\n13F-HR/A         HOWARD FINANCIAL SERVICES, LTD.                               1768130     20261014    edgar/data/1768130/0001768130-26-000005.txt                                                \n13F-HR/A         OSLO PENSJONSFORSIKRING AS                                    1828808     20261014    edgar/data/1828808/0001828808-26-000071.txt                                                \n13F-NT           Danelo Ltd                                                    2058288     20261014    edgar/data/2058288/0001104659-26-115798.txt                                                \n13F-HR           15 Wealth Advisors LLC                                        2148692     20261014    edgar/data/2148692/0002085853-26-001185.txt                                                \n13F-HR           6th Street Advisors, LLC                                      2102803     20261014    edgar/data/2102803/0002102803-26-000004.txt                                                \n10-K             COMTECH TELECOMMUNICATIONS CORP /DE/                          23197       20261014    edgar/data/23197/0000023197-26-000114.txt                                                \n';

export const FILING_INDEX_JSON = {
    directory: {
        item: [
            {
                'last-modified': '2026-10-14 09:11:50',
                name: '0002085853-26-001185-index-headers.html',
                type: 'text.gif',
                size: '',
            },
            {
                'last-modified': '2026-10-14 09:11:50',
                name: '0002085853-26-001185-index.html',
                type: 'text.gif',
                size: '',
            },
            {
                'last-modified': '2026-10-14 09:11:50',
                name: '0002085853-26-001185.txt',
                type: 'text.gif',
                size: '',
            },
            {
                'last-modified': '2026-10-14 09:11:50',
                name: 'infotable.xml',
                type: 'text.gif',
                size: '50330',
            },
            {
                'last-modified': '2026-10-14 09:11:50',
                name: 'primary_doc.xml',
                type: 'text.gif',
                size: '2082',
            },
        ],
        name: '/Archives/edgar/data/2148692/000208585326001185',
        'parent-dir': '/Archives/edgar/data/2148692',
    },
};

export const FILING_INDEX_JSON_AMENDMENT = {
    directory: {
        item: [
            {
                'last-modified': '2026-10-14 16:30:23',
                name: '0001768130-26-000005-index-headers.html',
                type: 'text.gif',
                size: '',
            },
            {
                'last-modified': '2026-10-14 16:30:23',
                name: '0001768130-26-000005-index.html',
                type: 'text.gif',
                size: '',
            },
            {
                'last-modified': '2026-10-14 16:30:23',
                name: '0001768130-26-000005.txt',
                type: 'text.gif',
                size: '',
            },
            {
                'last-modified': '2026-10-14 16:30:23',
                name: 'HFSQ22026A.xml',
                type: 'text.gif',
                size: '118412',
            },
            {
                'last-modified': '2026-10-14 16:30:23',
                name: 'primary_doc.xml',
                type: 'text.gif',
                size: '2142',
            },
        ],
        name: '/Archives/edgar/data/1768130/000176813026000005',
        'parent-dir': '/Archives/edgar/data/1768130',
    },
};

export const CNMS_SAMPLE =
    'Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market\n20261014|AAAA|118|0|225.044000|Q\n20261014|AAPL|9631783.539541|35528|16757126.582296|B,Q,N\n20261014|BF/A|45034.898359|0|61861.113864|B,Q,N\n20261014|BFAM|180243.169157|0|255180.680897|B,Q,N\n20261014|BF/B|828017.219928|155|1313552.866243|B,Q,N\n20261014|MSFT|2755359.844409|30267|7199830.196138|B,Q,N\n';

export const SHORT_INTEREST_SAMPLE =
    '"accountingYearMonthNumber"|"symbolCode"|"issueName"|"issuerServicesGroupExchangeCode"|"marketClassCode"|"currentShortPositionQuantity"|"previousShortPositionQuantity"|"stockSplitFlag"|"averageDailyVolumeQuantity"|"daysToCoverQuantity"|"revisionFlag"|"changePercent"|"changePreviousNumber"|"settlementDate"\n"20260930"|"A"|"Agilent Technologies Inc."|"A"|"NYSE"|"5240309"|"5078629"||"2950874"|"1.78"||"3.18"|"161680"|"2026-09-30"\n"20260930"|"AAAA"|"Amplius Aggressive Asset Alloc"|"H"|"BZX"|"4104"|"7213"||"2521"|"1.63"||"-43.10"|"-3109"|"2026-09-30"\n"20260930"|"AAPL"|"Apple Inc. Common Stock"|"R"|"NNM"|"120763539"|"128753092"||"39858260"|"3.03"||"-6.21"|"-7989553"|"2026-09-30"\n"20260930"|"BFA"|"Brown-Forman Corporation Class"|"A"|"NYSE"|"619119"|"565722"||"179636"|"3.45"||"9.44"|"53397"|"2026-09-30"\n"20260930"|"BFB"|"Brown-Forman Corporation Class"|"A"|"NYSE"|"31059339"|"32481900"||"2589736"|"11.99"||"-4.38"|"-1422561"|"2026-09-30"\n"20260930"|"MSFT"|"Microsoft Corporation Common S"|"R"|"NNM"|"61133927"|"67346414"||"23981233"|"2.55"||"-9.22"|"-6212487"|"2026-09-30"\n';
