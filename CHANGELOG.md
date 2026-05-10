# Changelog

## [0.11.4](https://github.com/y0ngha/siglens/compare/v0.11.3...v0.11.4) (2026-05-10)


### Bug Fixes

* 신뢰도 툴팁 z-index, 스피너 CSS, 번역 캐시, 뉴스 해시 충돌 4건 버그 수정 ([824ed83](https://github.com/y0ngha/siglens/commit/824ed83c447b5d9cc782e06c2405937cf3b5da66))


### Features

* AI 분석 뉴스 30일로 다시 변경 ([b703be2](https://github.com/y0ngha/siglens/commit/b703be22e76024aef648402ecb6166b309bf013b))

## [0.11.3](https://github.com/y0ngha/siglens/compare/v0.11.2...v0.11.3) (2026-05-08)


### Bug Fixes

* 뉴스 종합 분석 다시 진행 안하던 버그 수정 ([fcbe289](https://github.com/y0ngha/siglens/commit/fcbe289dd045156ce8bd4c33080492a50006f9ea))

## [0.11.2](https://github.com/y0ngha/siglens/compare/v0.11.1...v0.11.2) (2026-05-08)


### Bug Fixes

* 예외 로깅 추가 및 getCurrentUser try-catch 내부로 이동 ([8879173](https://github.com/y0ngha/siglens/commit/887917324a35e8b3492aedd9218e11b1f19fbb78))
* 훅 선언 순서 수정 및 작업 취소 API 검증 강화 ([8f1f0d1](https://github.com/y0ngha/siglens/commit/8f1f0d103ad98f69a2c8c8c4c0260690c591e44c))
* address PR [#430](https://github.com/y0ngha/siglens/issues/430) review (5 blockers + 2 suggestions) ([a99539c](https://github.com/y0ngha/siglens/commit/a99539c9c52529c128ae843b0b52fd13261548d1))
* address PR [#432](https://github.com/y0ngha/siglens/issues/432) review — extract usePageHideCancel, move types to domain ([33dd06f](https://github.com/y0ngha/siglens/commit/33dd06f929298224b8c10f6708a71ae0617e47d4))
* apply PR review feedback on cancel-job-on-page-unload ([abd6cb6](https://github.com/y0ngha/siglens/commit/abd6cb600773de06c2ea4169cf4e7d9e1815cfd8))
* cancel analysis jobs on page unload via pagehide + sendBeacon ([52a7d75](https://github.com/y0ngha/siglens/commit/52a7d758a3535fef51fc5ec634059afc455159ff))
* handle AnalysisGateBlockedResult in 3 consumer hooks + comment cleanup ([dbb99f4](https://github.com/y0ngha/siglens/commit/dbb99f41fabfe4c17f1cafc5c3105530a5e36046))
* handle key_error status in 3 consumer hooks ([82eae67](https://github.com/y0ngha/siglens/commit/82eae67210d088ac4a469678a227e902dba93e35))
* round 5 review (B1 test, S1-S4 cleanup, Q1 optimization) ([bbe7622](https://github.com/y0ngha/siglens/commit/bbe76222784737e2e666cca9d01bb224f7143b14))
* round 6 review (B1 cast comment, B2 import dedup, S1 domain types, S2 redundant comment) ([4733bb0](https://github.com/y0ngha/siglens/commit/4733bb00cb2f0caecae32ce495fc2d6470311917))
* round 7 review (B1 cast safety, B2-B5 import dedup, suggestion re-export cleanup) ([c1758d9](https://github.com/y0ngha/siglens/commit/c1758d937d3b0ccda7e5cf5713713abf6c9a86dd))


### Features

* extract shared tier+BYOK gate helper ([09c2bd8](https://github.com/y0ngha/siglens/commit/09c2bd8a78acf697180f5197b63ba6225178ef2b))
* **fundamental:** tier + BYOK forwarding to siglens-core ([56a0d48](https://github.com/y0ngha/siglens/commit/56a0d481c8c56e63c8811946faf123d6e89a0af1))
* **news:** tier + BYOK forwarding to siglens-core ([90014ca](https://github.com/y0ngha/siglens/commit/90014ca2c509d5b53f083f77cba0c41bf32f3dd9))
* **overall:** tier + BYOK forwarding to siglens-core ([60400e7](https://github.com/y0ngha/siglens/commit/60400e7f8693a8f02d37f133cccd4de2981fc163))


### Reverts

* Revert "refactor: delegate isFreeChatModel to siglens-core isFreeModel" ([8ac6b36](https://github.com/y0ngha/siglens/commit/8ac6b36fa3e73d187a9855b6fbb3ce35acfb2c5a))

## [0.11.1](https://github.com/y0ngha/siglens/compare/v0.11.0...v0.11.1) (2026-05-08)

# [0.11.0](https://github.com/y0ngha/siglens/compare/v0.10.2...v0.11.0) (2026-05-08)


### Bug Fixes

* 공포탐욕지수 페이지 챗봇 컨텍스트 미발행 오류 ([5ab2057](https://github.com/y0ngha/siglens/commit/5ab2057a8ce8305e240a22924557bc91e8a7da38))
* 리뷰 코멘트 반영 — 타입 중복 제거, 죽은 코드 정리 ([eda2afa](https://github.com/y0ngha/siglens/commit/eda2afab50f6bf203225f650b3ac336c8e7d4b54))
* 모달 제대로 안나오는 이슈 수정 ([d69d39d](https://github.com/y0ngha/siglens/commit/d69d39d5ed426a43c38d7128e157d8e129ac8c09))
* 모델 게이트 통합 + 모바일 바텀시트 클릭·z-index·헤더 수정 ([e0682c0](https://github.com/y0ngha/siglens/commit/e0682c0af479d866935a21ec6a95a4ba011e4965))
* 모바일 기기에서 챗봇 입력 상자 작동 불가 수정 ([5edfd08](https://github.com/y0ngha/siglens/commit/5edfd08250d86515db0470a600b93492112f101e))
* 모바일 환경 플로팅 버튼 버그 수정 ([d522ef3](https://github.com/y0ngha/siglens/commit/d522ef384b0f37e8dbb7ea892836f396a40429f5))
* 문의하기 완료 후 내용 개행 처리 ([afab200](https://github.com/y0ngha/siglens/commit/afab200b5fa706775959086f0015298032557b65))
* 비밀번호 검증 로직 도메인층 분리 및 UI 수정 ([311d1c2](https://github.com/y0ngha/siglens/commit/311d1c2c93582b8e7d7cc34aaec3d94541dfe8a2))
* 비밀번호 재설정 동일 비밀번호 오류 처리 개선 ([0cbf8e8](https://github.com/y0ngha/siglens/commit/0cbf8e8b3c8a966a9e5b9d57e8712436c87f481a))
* 비밀번호 재설정 토큰 검증 순서 및 TOCTOU 취약점 수정 ([44ce015](https://github.com/y0ngha/siglens/commit/44ce015832e3b2b8653c372b464b53ec5e586a88))
* 비밀번호 초기화 폼에서 입력값 오류 시 유효성 검사 상태 초기화 ([2d4d5b5](https://github.com/y0ngha/siglens/commit/2d4d5b5d5657ee3bcd50971d0aac1bfeea8817a8))
* 빌드 오류 해결 ([f32cc71](https://github.com/y0ngha/siglens/commit/f32cc71891d534c8171a4c41674f989d1d87db7f))
* 섹터 성과 API 호출 정리 ([182851a](https://github.com/y0ngha/siglens/commit/182851ad6b77c667137335bfbb2b46dbcc9fd37b))
* 소셜 로그인 OAuth 콜백 에러 처리 및 테스트 추가 ([43926d1](https://github.com/y0ngha/siglens/commit/43926d176d395efbd85b24626492c52941dcdb82))
* 연락처 폼 에러 메시지 처리 개선 ([25c3cd9](https://github.com/y0ngha/siglens/commit/25c3cd971fd754a5d43da0609b3bd820dd4f56bb))
* 이메일/비밀번호 trim 처리 일관성 및 LoginUserErrorCode 타입 정확화 ([022c4a9](https://github.com/y0ngha/siglens/commit/022c4a969d5a8731a53dd6b3a923ba6bfea2d5e9))
* 장식용 체크마크에 aria-hidden 추가 ([69d000a](https://github.com/y0ngha/siglens/commit/69d000aabfec353663d1b49787399b2fa4ff650f))
* 종합 분석 진행시 계속해서 AI 분석 요청 날리는 버그 수정 ([5adb891](https://github.com/y0ngha/siglens/commit/5adb8912791caf2f3bbcfbdcbea6488092d27a7d))
* 채팅 패널 열 때 저장된 값 사용 안하는 버그 수정 ([53c5219](https://github.com/y0ngha/siglens/commit/53c5219577f21553ac93549ac5b926275a41614f))
* 채팅/분석 API 키 라우팅 수정 및 채팅 말풍선 너비 개선 ([58e81e6](https://github.com/y0ngha/siglens/commit/58e81e60903c7ec8d0cf95be30e523b8d75fb939))
* 코드 리뷰 피드백 반영 - 타입 및 구조 개선 ([5009556](https://github.com/y0ngha/siglens/commit/50095560a47f9b0c976e32cae61d1f05c09b7479))
* 타입 오류 해결 ([35f3223](https://github.com/y0ngha/siglens/commit/35f322390d8ffbf14366b429faf0c17912bbc7a1))
* 펀더멘털 + 종합에서 사용되는 API 오류 수정 ([cf1e1c2](https://github.com/y0ngha/siglens/commit/cf1e1c28340683249088d381d8c1c391a71588ca))
* 프로필 카드 slot으로 변경 및 useChat 버그 수정 ([905e540](https://github.com/y0ngha/siglens/commit/905e54073978679baa21b0e17e81d1a58fb73553))
* 헤더 인증 상태 깜박임 원천 제거 (two-level Suspense) ([df4c095](https://github.com/y0ngha/siglens/commit/df4c095ad56687949614188f15a782ef2a91b1c0))
* 헤더 인증 상태 깜빡임 제거 ([677664b](https://github.com/y0ngha/siglens/commit/677664b447f4d982003eee8657c3dbbaae221ffc))
* 헤더 인증 상태 플래시 및 Navigation 블로킹 에러 해결 ([65f1c8e](https://github.com/y0ngha/siglens/commit/65f1c8e495dc81f6f5d81a09f16cb677f0d30654))
* 헤더 인증 상태 플래시 및 Navigation 블로킹 에러 해결 ([31c51b0](https://github.com/y0ngha/siglens/commit/31c51b0f04b72bbb41e7ae61929af11d2d7c8c16))
* 회원가입 폼 '표시 이름' 필드 제어 입력 구현 ([26b4544](https://github.com/y0ngha/siglens/commit/26b45446058a900468b4229705864f065dde7357))
* 회원가입 플로우 버그 수정 (이메일 검증 토큰 재시도 지원 및 비밀번호 상태 동기화) ([ac1e3cb](https://github.com/y0ngha/siglens/commit/ac1e3cb6a64dacbc7cd2b472a8172ac4e2bd95a9))
* 훅 선언 순서 수정 및 WHAT 주석 제거 ([ab1a9e5](https://github.com/y0ngha/siglens/commit/ab1a9e51fd28ed20d3a5559229b51cbae78e9b64))
* abort error는 console에 안찍도록 수정 ([f1045a5](https://github.com/y0ngha/siglens/commit/f1045a5575bdc6cfae3731d19a95471b90004ebe))
* address PR [#411](https://github.com/y0ngha/siglens/issues/411) review comments ([013bf50](https://github.com/y0ngha/siglens/commit/013bf502b2765ce4d3bc8cd746d9581f49117d0e))
* address PR [#411](https://github.com/y0ngha/siglens/issues/411) round 2 review comments ([105277f](https://github.com/y0ngha/siglens/commit/105277ff8269cce4b4c43e5ac7c90b1c45717009))
* address PR [#411](https://github.com/y0ngha/siglens/issues/411) round 3 review comments ([8ed5d18](https://github.com/y0ngha/siglens/commit/8ed5d1889d7d8424df8b32f2183a361276e206ef))
* address PR [#412](https://github.com/y0ngha/siglens/issues/412) review comments ([1844834](https://github.com/y0ngha/siglens/commit/184483494ff3ed2cdc3ef7c7f4f1b2f0eeac9e8b))
* address PR [#412](https://github.com/y0ngha/siglens/issues/412) round 2 review comments ([32c8091](https://github.com/y0ngha/siglens/commit/32c8091cb08dc2fd2b5b2f7bbd64ffb6cc89d4b4))
* address PR [#412](https://github.com/y0ngha/siglens/issues/412) round 3 review comments ([fc723c5](https://github.com/y0ngha/siglens/commit/fc723c506b37e0fe0f610a1b857e3c81f6568b95))
* address PR [#414](https://github.com/y0ngha/siglens/issues/414) review comments (round 1) ([c5ca6d9](https://github.com/y0ngha/siglens/commit/c5ca6d94f8fa03d7b4ee82af33dfc6345c294e88)), closes [#0](https://github.com/y0ngha/siglens/issues/0) [#4](https://github.com/y0ngha/siglens/issues/4)
* address PR [#414](https://github.com/y0ngha/siglens/issues/414) review comments (round 2) ([7502ec2](https://github.com/y0ngha/siglens/commit/7502ec209432a214ddbbfefac09d7bea7fa97cfa)), closes [#4](https://github.com/y0ngha/siglens/issues/4) [#15](https://github.com/y0ngha/siglens/issues/15)
* address PR [#414](https://github.com/y0ngha/siglens/issues/414) review comments (round 3) ([44df35f](https://github.com/y0ngha/siglens/commit/44df35f852c8ac2b140ee53aa211e060101f2c9f)), closes [#4](https://github.com/y0ngha/siglens/issues/4) [#1](https://github.com/y0ngha/siglens/issues/1)
* address PR [#414](https://github.com/y0ngha/siglens/issues/414) review comments (round 4) ([94363d1](https://github.com/y0ngha/siglens/commit/94363d132a18c30ea4d3ca024410ba757a9b785f)), closes [#4](https://github.com/y0ngha/siglens/issues/4) [#14](https://github.com/y0ngha/siglens/issues/14)
* address round 4 PR review comments ([a03e22d](https://github.com/y0ngha/siglens/commit/a03e22df0b0d41174db3b115ac76c374d40ea60b))
* address round 4 PR review suggestions ([551ebc0](https://github.com/y0ngha/siglens/commit/551ebc053b3cc473f8eacc4d0e2754277c4ebb32))
* address round 5 PR review comments ([9d27598](https://github.com/y0ngha/siglens/commit/9d275985c22620ddaadc3fcffac874f20aa65c36))
* address round 5 PR review suggestions ([e99084c](https://github.com/y0ngha/siglens/commit/e99084c397f1d70f9c02284a8bacfd4a2f0e5f9b))
* address round 6 PR review comments ([207739a](https://github.com/y0ngha/siglens/commit/207739ad4717702a780267fcf0141b9f70734751))
* address round 6 PR review suggestions ([a6f42be](https://github.com/y0ngha/siglens/commit/a6f42be963e593df56976e7dea097e3f37a85af5))
* address round 7 PR review comments ([bc7e3de](https://github.com/y0ngha/siglens/commit/bc7e3deb7e357898ed45a3b02db89fa9a9407b57))
* address round 7 PR review suggestions ([5b4933e](https://github.com/y0ngha/siglens/commit/5b4933eff7e30dd62b325cf59ee7ad886b4bc22f))
* address round 8 PR review suggestions ([c03611e](https://github.com/y0ngha/siglens/commit/c03611eca312bd312f9fe8168d11875198b4a0cb))
* AI 분석 진행시 localStorage에 있는 값 다 불러온 후 진행될 수 있도록 처리 ([0737edc](https://github.com/y0ngha/siglens/commit/0737edcc128a2b9506da6c25e455a1e5ddf0583c))
* ai provider 형식 변경 후 오류나는 부분 수정 ([cbbd8e6](https://github.com/y0ngha/siglens/commit/cbbd8e6b9a770aecbcdd42d4bd8e692c62d01d52))
* apply review feedback - hook order, readonly array, model variant formatting, and spacing ([99dae22](https://github.com/y0ngha/siglens/commit/99dae221a141464598b342ed188779799ef6484a))
* apply review-agent round 1 findings for issue [#396](https://github.com/y0ngha/siglens/issues/396) ([67cce33](https://github.com/y0ngha/siglens/commit/67cce332245024280379bee09e61146342fb8403))
* apply review-agent round 2 findings for issue [#396](https://github.com/y0ngha/siglens/issues/396) ([f938565](https://github.com/y0ngha/siglens/commit/f9385652c508a9cf81b7558d93f3af0825995ebd))
* aria-label 접근성 수정 ([e0eca96](https://github.com/y0ngha/siglens/commit/e0eca963ea7e22e2539fed6f41b16b5e559098a1))
* **auth:** apply PR [#420](https://github.com/y0ngha/siglens/issues/420) review feedback ([2288469](https://github.com/y0ngha/siglens/commit/22884699e57c6ae5cd68ce6c1d2b0339d0d3d358))
* cleanup footer styles and update MISTAKES.md ([ace0ced](https://github.com/y0ngha/siglens/commit/ace0ced8de7e8a96f3287d936169c6461fce448d)), closes [#1](https://github.com/y0ngha/siglens/issues/1)
* collectMdFiles ENOENT 시 빈 배열 반환 (skills 디렉토리 lazy 생성 허용) ([7d3ae82](https://github.com/y0ngha/siglens/commit/7d3ae82aa7dd2bba626321549c1cd85531c92fc2))
* comprehensive review fixes for 28 findings since 980c37c ([b15686b](https://github.com/y0ngha/siglens/commit/b15686bd7b2ca88ec3e0db5a06a214eae407ccb7)), closes [#407](https://github.com/y0ngha/siglens/issues/407)
* contact form accessibility and safety fixes ([57407b5](https://github.com/y0ngha/siglens/commit/57407b5b68606519f75ee0a9d067a1e17a96db25))
* deleteAccountAction 테스트 케이스 수정 ([164d352](https://github.com/y0ngha/siglens/commit/164d352749309eb804270388cf39628cf157ce63))
* **design:** tailWind 스타일 오류 수정 ([8062b56](https://github.com/y0ngha/siglens/commit/8062b56806bcc62e9c7c0714e10fc872a05786e5))
* error boundary 오류 수정 ([bd20216](https://github.com/y0ngha/siglens/commit/bd20216f462fe4f9a3ab1b99f299f89b0c83d787))
* **fearGreed:** address ComparisonGauges review findings ([ed17b4a](https://github.com/y0ngha/siglens/commit/ed17b4ae9cc30aa24675dc91a81107eb47cb75af))
* **fearGreed:** address fear-greed route shell review findings ([efe4f2c](https://github.com/y0ngha/siglens/commit/efe4f2c1c865106f8db8b842307962e892b1bf1c))
* **fearGreed:** address FearGreedCard review findings ([2dd2cf2](https://github.com/y0ngha/siglens/commit/2dd2cf2073136e94ca496d3f5cbd44ed7cd83d6f))
* **fearGreed:** address FearGreedHeaderChip review findings ([310be3b](https://github.com/y0ngha/siglens/commit/310be3bed7e17c96bb75cbd6c1b99955c7085112))
* **fearGreed:** address GroupBar review findings (a11y + style) ([cb9c127](https://github.com/y0ngha/siglens/commit/cb9c127b4eab604d2ad8af3367deb8314b43c1ce))
* **fearGreed:** address labels review (utils/ + Korean label + return type) ([2d9ce1e](https://github.com/y0ngha/siglens/commit/2d9ce1e661bf14e713df253dbf51ade358fe1aed))
* **fearGreed:** address PR [#428](https://github.com/y0ngha/siglens/issues/428) review (4 blockers + 4 suggestions) ([1e1cea3](https://github.com/y0ngha/siglens/commit/1e1cea3786e826ba79677d7460a588fdfb0c250b))
* **fearGreed:** address PR [#428](https://github.com/y0ngha/siglens/issues/428) round 2 review (1 blocker + 3 suggestions) ([cc30a1b](https://github.com/y0ngha/siglens/commit/cc30a1bca7362aeb1e44937d14ad4012241c1647))
* **fearGreed:** address SelfNormWarningBadge review findings ([b3537c7](https://github.com/y0ngha/siglens/commit/b3537c7c4d09443932994e0549e092171695ae6a))
* **fearGreed:** address useFearGreed review findings ([2008b49](https://github.com/y0ngha/siglens/commit/2008b49f7776c3eded1f49d56ee134383b77cd02))
* **fearGreed:** extract shared LABEL_TEXT + Hero magic numbers ([2e45f84](https://github.com/y0ngha/siglens/commit/2e45f84f7d4856c46a6c38dc38bc7dadd5a4b2a8))
* **fearGreed:** wire FearGreedCard through 1Day-only mounted wrapper ([1f7317d](https://github.com/y0ngha/siglens/commit/1f7317d9e351392b1158ae97bb25320514d3ec67))
* **feat:** proxy 동작 안하던 이슈 수정 및 path 추가 ([e77a658](https://github.com/y0ngha/siglens/commit/e77a65851e9645dcf483744d644f60eab8135aaf))
* FMP 섹터 성능 API 불안정성으로 SectorDirectionCard 제거 ([05eca28](https://github.com/y0ngha/siglens/commit/05eca2871a1363d785b468edceb850de65f87854))
* from 정리할 때 ?? > ||으로 변경 ([e12996f](https://github.com/y0ngha/siglens/commit/e12996f316f2935a888c5dfad29a34080930666c))
* getAssetInfo에서 translate 이후 저장이 잘 될 수 있도록 waitUntil 처리 ([1787dc5](https://github.com/y0ngha/siglens/commit/1787dc5c1269b0e839eb7c17475417246b4e3580))
* getBars 하이드레이션 오류 수정 및 극공포, 극탐욕 단어 수정 ([587a01d](https://github.com/y0ngha/siglens/commit/587a01dca94dd34c7807b9d389a7c67524848902))
* improve type safety and clean up submitContactAction ([38483ae](https://github.com/y0ngha/siglens/commit/38483ae2df1687a415993996037899c105f3ce25))
* merge duplicate @y0ngha/siglens-core imports ([90e1292](https://github.com/y0ngha/siglens/commit/90e129286d3a896f81a4e1e4598dc171bd804d3c))
* move overflow-hidden + rounded-xl to ChatPanel to preserve visual corners ([60e026e](https://github.com/y0ngha/siglens/commit/60e026e87f3a2895b8b07fbd5139536fa894ebe9))
* neon-http 드라이버 트랜잭션 미지원 오류 해결 ([45679f9](https://github.com/y0ngha/siglens/commit/45679f9b33eedf2876e0674e1a4fd270c2976de1))
* Next.js 16 PPR — usePathname/cookies/searchParams 컴포넌트 Suspense wrap (prerender 오류 해소) ([b7df1c0](https://github.com/y0ngha/siglens/commit/b7df1c05927e542dd849706f6f4cf563656c5183))
* openai 오류 수정 ([9588075](https://github.com/y0ngha/siglens/commit/95880759189211ee513e48c7347268bcb6a22728))
* post-9e88a2f9 audit — drizzle/모델/폴링/AI provider 안전성 ([1808355](https://github.com/y0ngha/siglens/commit/180835553bc40b22709b71e2ab31b562174701c6))
* PR [#391](https://github.com/y0ngha/siglens/issues/391) 리뷰 코멘트 반영 ([15eb634](https://github.com/y0ngha/siglens/commit/15eb63446ad8e638ea33629c153486363e57050f))
* PR [#391](https://github.com/y0ngha/siglens/issues/391) 리뷰 코멘트 반영 ([6e3a303](https://github.com/y0ngha/siglens/commit/6e3a3036784635afc882f0c8559c61bbfe64bccb))
* PR [#395](https://github.com/y0ngha/siglens/issues/395) 리뷰 코멘트 반영 ([d6b1dc7](https://github.com/y0ngha/siglens/commit/d6b1dc75c32cb2731d1290a69112c19c8219c141))
* PR [#395](https://github.com/y0ngha/siglens/issues/395) 리뷰 코멘트 반영 ([4ed8881](https://github.com/y0ngha/siglens/commit/4ed8881ae6269224ce250cf82dbe0ec9676a6b21))
* PR [#395](https://github.com/y0ngha/siglens/issues/395) 리뷰 코멘트 반영 ([ef0c736](https://github.com/y0ngha/siglens/commit/ef0c7363b9e246b01297978ef0c6f84f081edde2))
* PR [#395](https://github.com/y0ngha/siglens/issues/395) 리뷰 코멘트 반영 ([e775000](https://github.com/y0ngha/siglens/commit/e775000125fa33ee868ab93e1aa8a62b0bf57d83))
* PR [#395](https://github.com/y0ngha/siglens/issues/395) 리뷰 코멘트 반영 ([a0c7cc3](https://github.com/y0ngha/siglens/commit/a0c7cc3e22318ca042ad458d4a257db3bb2bc926))
* PR [#395](https://github.com/y0ngha/siglens/issues/395) 리뷰 코멘트 반영 (테스트 assertion, import 수정) ([d39b251](https://github.com/y0ngha/siglens/commit/d39b25121d7736a760caa1ce0bb54d2098acf4e5))
* PR [#405](https://github.com/y0ngha/siglens/issues/405) review comments ([80bfbbc](https://github.com/y0ngha/siglens/commit/80bfbbc50378cf8abe2ef7abb1cbca699f4ad047)), closes [#4](https://github.com/y0ngha/siglens/issues/4)
* PR [#405](https://github.com/y0ngha/siglens/issues/405) round 2 — invert AuthUserRecord layer + JSDoc cleanup ([853b7fd](https://github.com/y0ngha/siglens/commit/853b7fd387125e08af34ef9039cb7af458a01cd5))
* PR [#405](https://github.com/y0ngha/siglens/issues/405) round 3 — alias imports + single-line JSDoc + re-export chain ([4bdb08d](https://github.com/y0ngha/siglens/commit/4bdb08da6df03afe4ff57c04b7d290531174ce50))
* PR [#405](https://github.com/y0ngha/siglens/issues/405) round 4 — single-line JSDoc + Promise.allSettled ([ac0e215](https://github.com/y0ngha/siglens/commit/ac0e2158276a892c54b3c35139a651fbee8c56ce))
* PR [#413](https://github.com/y0ngha/siglens/issues/413) 검토 후속 — chat/header layout 공통화 + 캐시-only NewsAugment + breadcrumb/error 처리 정리 ([9e31d5f](https://github.com/y0ngha/siglens/commit/9e31d5f2fea4fab4ecdc5b8c4d17522acca8e6f0))
* PR [#413](https://github.com/y0ngha/siglens/issues/413) Gemini A-1 — CRON_SECRET undefined bypass 차단 + GET→PATCH + 테스트 ([a775c91](https://github.com/y0ngha/siglens/commit/a775c91c49a50b455c8479e36d766a49f367e39a))
* PR [#413](https://github.com/y0ngha/siglens/issues/413) Gemini A-2 — FMP fetch에 AbortSignal.timeout(10s) 추가 ([6f8dabd](https://github.com/y0ngha/siglens/commit/6f8dabd9490580a23988c533ac240047085cbcae))
* PR [#413](https://github.com/y0ngha/siglens/issues/413) Gemini A-4 — ensureNewsCardsAnalyzedAction을 waitUntil로 감싸기 ([4e95cae](https://github.com/y0ngha/siglens/commit/4e95cae2c205363968d2084ef06cdd60e36827a5))
* PR [#413](https://github.com/y0ngha/siglens/issues/413) R24 — SKILL_CATEGORIES에 fundamental/news 추가 + RANGE_TO_HOURS 의도 노출 + submitted 케이스 주석 보완 ([7be0ba2](https://github.com/y0ngha/siglens/commit/7be0ba21b39707dc785141e88a6ec19fbb115438))
* PR [#413](https://github.com/y0ngha/siglens/issues/413) R3 B3 — domain/types.ts import 최상단으로 이동 ([dbe5a03](https://github.com/y0ngha/siglens/commit/dbe5a036edf6293c0fb9b3cdf84047768a7d7937))
* PR [#417](https://github.com/y0ngha/siglens/issues/417) R1 리뷰 반영 — lib layer, JSDoc, datePublished, 매직 넘버 ([f94466a](https://github.com/y0ngha/siglens/commit/f94466a4f04cbb7479f465274918b7b1216fec3f)), closes [#1](https://github.com/y0ngha/siglens/issues/1) [#2](https://github.com/y0ngha/siglens/issues/2)
* PR [#417](https://github.com/y0ngha/siglens/issues/417) R2 리뷰 반영 — 매직 넘버, 인라인 타입, OG image 중복 ([2d8faba](https://github.com/y0ngha/siglens/commit/2d8fabaec037c78c9eefdc307401152827e5e4de))
* PR [#417](https://github.com/y0ngha/siglens/issues/417) R3 리뷰 반영 — infra 테스트 보강 + ARIA 시맨틱 정리 ([67d4211](https://github.com/y0ngha/siglens/commit/67d4211ea59e6418750fd2858931593801ff3d01))
* PR [#417](https://github.com/y0ngha/siglens/issues/417) R4 리뷰 반영 + 레이어 규칙 갱신 ([eb07b1e](https://github.com/y0ngha/siglens/commit/eb07b1e713b009d5ee174376f84a7e3e61414042)), closes [#0](https://github.com/y0ngha/siglens/issues/0)
* PR [#417](https://github.com/y0ngha/siglens/issues/417) R5 리뷰 반영 — getAssetInfoCached 테스트 + 워크트리 CLAUDE.md 갱신 ([bd7d673](https://github.com/y0ngha/siglens/commit/bd7d67398b64b6f26df1e2c7121909a3d77f124c))
* PR [#417](https://github.com/y0ngha/siglens/issues/417) R6 비필수 Suggestion + Question 반영 ([91f26fb](https://github.com/y0ngha/siglens/commit/91f26fb2eac0388a89d2d349b8c5852dd0c71b8a))
* PR [#418](https://github.com/y0ngha/siglens/issues/418) R2 — context hook 분리 + flicker 가드 + drift 트랩 제거 ([2d2d44a](https://github.com/y0ngha/siglens/commit/2d2d44a2723dff27a612c85902f3f06ebe4c32b6)), closes [#15](https://github.com/y0ngha/siglens/issues/15)
* PR [#418](https://github.com/y0ngha/siglens/issues/418) R3 — Suspense fragment wrapper 제거 + R3 reviewer Blocker 거부 기록 ([4888d93](https://github.com/y0ngha/siglens/commit/4888d93389d05877e496f7acadc8adf20b8b1647))
* PR [#418](https://github.com/y0ngha/siglens/issues/418) R4 — utility 폴더 이동 + props drilling 제거 + buildChatState 추출 + cache-only 회귀 테스트 ([9e1d081](https://github.com/y0ngha/siglens/commit/9e1d081833a2bc1f16f70db0e6245df781c9db98))
* PR [#418](https://github.com/y0ngha/siglens/issues/418) R5 — hook 선언 순서 정리 + buildChatState utils/ 분리 + 단언 강화 ([8e03256](https://github.com/y0ngha/siglens/commit/8e03256d464e7c31f6528aec7c32c749178a5b6b))
* PR [#418](https://github.com/y0ngha/siglens/issues/418) R6 — types 분리 + hook 선언 순서 예외 WHY 주석 + test mock reset ([961092a](https://github.com/y0ngha/siglens/commit/961092abc051fdb929458ff55bd231c7197bc515))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 10 — 시멘틱 토큰·expect 명시화·TermsKind·반환타입·중복슬러그 테스트 ([13f80d2](https://github.com/y0ngha/siglens/commit/13f80d2899cd75c60b8874ab259469084038732b))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 11 — outer try-catch·a11y aria 수정·선언형 패턴·훅 이동 ([87291bf](https://github.com/y0ngha/siglens/commit/87291bf163cd7b6e9a01ba80528afc634ac224f6))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 12 — role=status 테스트 동기화·불필요한 mock 제거·WHAT 주석 삭제 ([d14ca79](https://github.com/y0ngha/siglens/commit/d14ca79be5871cf573f852d2e1f4b085b6fe8080))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 13 — createOAuthUser null 브랜치 커버리지·픽스처 정합·병렬 시드 ([fc4e7d1](https://github.com/y0ngha/siglens/commit/fc4e7d18d9e7ed1ce97ff91b51ce8110e75d296e))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 14 — expect 명시화·@/ 임포트·ring-offset·Suspense fallback ([89121a9](https://github.com/y0ngha/siglens/commit/89121a959d653d23a678cc2eb5a3b19990f1a29d))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 15 — redirect mock·OR분기 테스트·FinalizeOAuthSignupError 타입 추출 ([1e59150](https://github.com/y0ngha/siglens/commit/1e59150acf16913ca3e2fdec355ac7b644701192))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 16 — SocialLoginUser* 데드코드 제거·callback route 테스트 추가 ([a544032](https://github.com/y0ngha/siglens/commit/a544032364968da01b2663d92ae65de2ddb1aec3))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 17 — pendingStore null 테스트·created null 명시·섹션 주석 제거 ([45f356d](https://github.com/y0ngha/siglens/commit/45f356d9e0a309081e0746b07b1b1887f1f77dd2))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 18 — outer catch 2번째 분기 테스트·migrate 반환 타입 추가 ([d937387](https://github.com/y0ngha/siglens/commit/d937387cf6f216268129de03a4e73c7df9e85264))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 2 — 아키텍처·타입·slugger 수정 ([b409535](https://github.com/y0ngha/siglens/commit/b4095357eb8e56d222b4021ebd241c65ff80d137))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 3 — 레이어 위반·중복 상수·Redis 예외 처리 ([0759152](https://github.com/y0ngha/siglens/commit/0759152f625955eccb1381ddee29b35ec2ecf04e))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 4 — 에러 URL 상수 추출 + 테스트 분기 추가 ([a7ee050](https://github.com/y0ngha/siglens/commit/a7ee05023bfebca818d69b006e78c00e961754cb))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 5 — formError dead code 제거 + re-export 정리 ([75dddfa](https://github.com/y0ngha/siglens/commit/75dddfae4296417a6a54bc5ea189be3cf2f8f3d9))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 6 — 타임존 버그·re-export·atomic getdel·CSS casing ([6245fef](https://github.com/y0ngha/siglens/commit/6245feffa784cf692003ab3bf2145bf053fc8fc8))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 7 — isSecureCookieEnv 중복 호출 제거 ([53644de](https://github.com/y0ngha/siglens/commit/53644de82c6e8e36b9e6e3b7bdfdd8fdf95f4c3c))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 8 — tryParse 커버리지·termsRepo mock·registerAction db 검증 ([67359cd](https://github.com/y0ngha/siglens/commit/67359cd047d9b1e249bc5c23072e19380ae1e6b4))
* PR [#420](https://github.com/y0ngha/siglens/issues/420) Round 9 — catch 블록 에러 로깅 추가 ([3447dc0](https://github.com/y0ngha/siglens/commit/3447dc00ae0cc45ca791412ac3f157049acad346))
* PR [#422](https://github.com/y0ngha/siglens/issues/422) R1 — 인터페이스 추출 / NEXT_PUBLIC 제거 / hook 순서 / as-cast 보증 ([e916f69](https://github.com/y0ngha/siglens/commit/e916f69c80c11b050233625724a00fdf0889621c)), closes [hi#impact](https://github.com/hi/issues/impact)
* PR [#422](https://github.com/y0ngha/siglens/issues/422) R2 — enum mirror exhaustiveness / 매직넘버 제거 / 상수 export ([03175bb](https://github.com/y0ngha/siglens/commit/03175bb287d4df20d1f8ea167a7a288ef6cfc01f))
* PR [#422](https://github.com/y0ngha/siglens/issues/422) R3 — shared news polling constants + remove infrastructure console.log ([80c1b54](https://github.com/y0ngha/siglens/commit/80c1b54969e54f611cdbd3e070174bc52b160341))
* PR [#423](https://github.com/y0ngha/siglens/issues/423) R2 — hook declaration order, thinkingBudget test assertions, queryConfig return type ([be29dc6](https://github.com/y0ngha/siglens/commit/be29dc6667328c9214806e183a42bb2d716f989d))
* PR [#423](https://github.com/y0ngha/siglens/issues/423) R3 — countEnriched dual-field check, QueryClientProvider in NewsList tests, onPollingComplete coverage ([71bfd9f](https://github.com/y0ngha/siglens/commit/71bfd9f0a7a798039b412e06f695b22cd56da1fe))
* PR [#423](https://github.com/y0ngha/siglens/issues/423) R4 — export MAX_POLL_DURATION_MS + countEnriched reuses isPendingAnalysis ([196a757](https://github.com/y0ngha/siglens/commit/196a7574984628c47dd057b9edc0f36d42420d3d))
* PR [#423](https://github.com/y0ngha/siglens/issues/423) R5 — reset visibleCount on symbol change + onPollingComplete negative test cases ([c2042d4](https://github.com/y0ngha/siglens/commit/c2042d477675a65b09290486fac3784945835e29))
* PR [#423](https://github.com/y0ngha/siglens/issues/423) R6 — hook order + spy assertions + EMPTY_SNAPSHOT_MAX_POLLS + DISABLED_THINKING_BUDGET ([2c7eb19](https://github.com/y0ngha/siglens/commit/2c7eb19df103fb401afe9675659817544bedbe02))
* PR [#423](https://github.com/y0ngha/siglens/issues/423) Round 1 — hook declaration order, useState for initialEnrichedCount, prevSymbol render reset ([cab7a45](https://github.com/y0ngha/siglens/commit/cab7a45fc67f50b10ce285a9da080a1d120f36d7))
* PR [#424](https://github.com/y0ngha/siglens/issues/424) review blockers — extract key-fallback helper, add repo tests, fix journal timestamp ([52f41dc](https://github.com/y0ngha/siglens/commit/52f41dca124461f20439db128ae4e89f166cb183))
* PR [#425](https://github.com/y0ngha/siglens/issues/425) 리뷰 반영 — listBySymbol mock 추가 및 DB-first 필터링 테스트 ([eafc064](https://github.com/y0ngha/siglens/commit/eafc064f65c53ec7a0cf3043ba93afa40bb562e9))
* PR [#425](https://github.com/y0ngha/siglens/issues/425) round 2 — listBySymbol 호출 검증, fresh 빈 배열 early return ([906b40b](https://github.com/y0ngha/siglens/commit/906b40b370fd0c8885f63da5e96bcafaba135851))
* PR [#425](https://github.com/y0ngha/siglens/issues/425) round 3 — listBySymbol 실패 테스트 추가, WHAT 주석 정리 ([a51181d](https://github.com/y0ngha/siglens/commit/a51181df96c460516033d596fb523e309e6dfa88))
* PR [#429](https://github.com/y0ngha/siglens/issues/429) 리뷰 코멘트 반영 (race condition, 동시성, 매직 넘버, 인라인 타입) ([fae7ec5](https://github.com/y0ngha/siglens/commit/fae7ec59e77635c5153d1b13f5c7282663a0b11e))
* PR 리뷰 코멘트 반영 — 누락된 유틸 추가, 타입 정의, 테스트 설명 수정 ([37ed3b7](https://github.com/y0ngha/siglens/commit/37ed3b74776bb6d69e30ce2c18c0dbd4557eebaf))
* PR review comment 반영 ([868e736](https://github.com/y0ngha/siglens/commit/868e736b9f2fd1f7c2baea81e87c3ad2d53894ba))
* PR review comment 반영 ([18b9938](https://github.com/y0ngha/siglens/commit/18b99388ac46219e2e8baeb20bad71156aa57f5d))
* PR review comment 반영 ([e6a5c55](https://github.com/y0ngha/siglens/commit/e6a5c557ba3c65b22c30a1d28648f0e44421d973))
* PR review comment 반영 ([8be913f](https://github.com/y0ngha/siglens/commit/8be913f861d0638623223e0a2bafa1922fa4d67d))
* PR review comment 반영 ([dd0f1d1](https://github.com/y0ngha/siglens/commit/dd0f1d1b0c20e4b1e8a3abe74b3374e5b16edd41))
* PR review comment 반영 (라운드 7) ([dbff7af](https://github.com/y0ngha/siglens/commit/dbff7af1498a9a4fd702177a54507469b3cf7e67))
* pr review fix ([5edc47c](https://github.com/y0ngha/siglens/commit/5edc47c7623f61e32618d1f29160f0c30803c14d))
* PR Round 1 fix Task 2.11 — 'use client' + timeframe 검증 + retry 상한 + focus ring ([1ae399c](https://github.com/y0ngha/siglens/commit/1ae399ccfaa1c56a8e044085db756b7f235a85d9))
* PR Round 1 fix Tasks 2.12 — cn() + 고아 border 클래스 제거 ([dde2af8](https://github.com/y0ngha/siglens/commit/dde2af81b21c54ffb895e0b318d40470634af6cb))
* pr-reivew fix ([ce9dd64](https://github.com/y0ngha/siglens/commit/ce9dd64dcf1c63855d9ec149d8da849b8fbc0c69))
* pr-review fix ([044e6f8](https://github.com/y0ngha/siglens/commit/044e6f8e09ecc5853b4eaf54a19d5f9ac6540c72))
* Pro 티어 게이트 모달, 모바일 탭 클릭, 뱃지 레이아웃 수정 ([8a8c891](https://github.com/y0ngha/siglens/commit/8a8c8919f3b4239aaee442307962a532843e4bdf))
* pwa 배너 안보여줄 때 null 반환하도록 수정 ([cfb9b74](https://github.com/y0ngha/siglens/commit/cfb9b74a1308d58d603c8efdee97dd3d8360a042))
* **pwa:** remove unnecessary ts-expect-error in manifest ([834cb6a](https://github.com/y0ngha/siglens/commit/834cb6a89d8ce653be9a5f696312fd840fafbd6c))
* **pwa:** replace img with next/image in IosInstallModal ([e7b55a9](https://github.com/y0ngha/siglens/commit/e7b55a9db5e5a204bf42dfa662b2849d7c09477a))
* Redis cache 마이그레이션 테스트 수정 ([11d1090](https://github.com/y0ngha/siglens/commit/11d1090d3f1be783c60da691a0d900c7d30c630a))
* registerAction 오류 로직 개선 ([ef4116d](https://github.com/y0ngha/siglens/commit/ef4116da7ea7e15abc362155cf7885d1e015a18d))
* remove console.error and wire isPending to submit button in OAuth consent form ([464a1c3](https://github.com/y0ngha/siglens/commit/464a1c33b697b60656854392683e7f472ab6b1e1))
* remove unnecessary 'use client' from RSC card components + fix 컨센서스 tooltip text ([53470c2](https://github.com/y0ngha/siglens/commit/53470c295139e07fbff8ebb98e76f6ac9bb542ed))
* replace raw Tailwind colors with design system tokens ([0421d02](https://github.com/y0ngha/siglens/commit/0421d0249a4f4bdf9a56e5dd76a02fe6a2c8a3e2))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) review (extract magic numbers + branch coverage) ([f47184f](https://github.com/y0ngha/siglens/commit/f47184fb9849e3579d3b970e400ed90c48307ef5))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) review comments (merge conflict, path aliases, score boundaries, ARIA) ([cced65d](https://github.com/y0ngha/siglens/commit/cced65dbb424213a4e023d8ade57632121882b46))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 10 review (BOUNDARIES → domain/, FAQ 하드코딩 제거, 단위 테스트 신규) ([ccd0d5e](https://github.com/y0ngha/siglens/commit/ccd0d5e72440f3906af55ad3ccd8e6bb33009040))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 11 review (Tests §13 — import shared labels instead of literal hardcode) ([c3b1624](https://github.com/y0ngha/siglens/commit/c3b1624a3d26614cfd32090ed0aaf0b0d02d1b8a))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 12 review (SnapshotConfidence → domain/types, TICK_VALUES boundary 상수) ([f45f466](https://github.com/y0ngha/siglens/commit/f45f466a60391ff69e6c2a15485a9a31619a9b8b))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 13 review (CONFIDENCE_LIMITED_LABEL import + 가운뎃점 잔여 제거) ([66abfd3](https://github.com/y0ngha/siglens/commit/66abfd37e6255b94550f027f86a66bbf14679e95))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 14 review (import/first + useFearGreedFromSymbol shared hook + JSDoc 정리) ([2988311](https://github.com/y0ngha/siglens/commit/298831185371349b294fe91907c4f738033b0d06))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 15 review (named type aliases + UseFearGreedResult 단일화) ([e880479](https://github.com/y0ngha/siglens/commit/e88047921152e386a1cd55edd169479cb1612a8f))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 6 review (extract classifyScore + formatConfidenceFooter, FearGreedLabel import) ([7a8cb1d](https://github.com/y0ngha/siglens/commit/7a8cb1dac485dda8359adfbaf6a802e111443648))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 7 review (4축 라벨, drift 주석, Suspense 의도) ([abada9b](https://github.com/y0ngha/siglens/commit/abada9b87e4e4545200974efe70d007e9e1af369))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 8 review (labels.ts → lib/, JSDoc/magic-number cleanup) ([4ecc0e1](https://github.com/y0ngha/siglens/commit/4ecc0e16d7d2993b676ebec270c7dfd61f5d38b1))
* resolve PR [#428](https://github.com/y0ngha/siglens/issues/428) round 9 review (SEGMENTS boundaries import + SnapshotConfidence type) ([8ae0b1e](https://github.com/y0ngha/siglens/commit/8ae0b1e1d799592bb4fa2ba556b5fc970f85f668))
* review fix ([70e5674](https://github.com/y0ngha/siglens/commit/70e5674a1afa3231b93fec92eb295b3527099f55))
* RootLayout — getCurrentUser를 HeaderWithUser Suspense 컴포넌트로 추출 ([7aff228](https://github.com/y0ngha/siglens/commit/7aff2289896a5c8c4e19f084cafa2a4d8222849f))
* SigLens > Siglens ([5e1c1f1](https://github.com/y0ngha/siglens/commit/5e1c1f1fa619edd2294b2cbbc5e6a6026b42e3bf))
* SubmitButton focus-visible ring offset for WAI-ARIA consistency ([30694a3](https://github.com/y0ngha/siglens/commit/30694a36c13080ade16e4c4419068ed0b7f891da))
* terms upsert 진행시 conflict 발생했을 때 doNothing으로 교체 ([f3ed347](https://github.com/y0ngha/siglens/commit/f3ed3475e0a3f56e0a2c93758daf99dde3f165cf))
* TS 오류 수정 ([a3fd211](https://github.com/y0ngha/siglens/commit/a3fd211bd9b15f64c25ba637f7f46f943d7e5de9))
* upsert 오류 수정 ([d4882e6](https://github.com/y0ngha/siglens/commit/d4882e63063529fe2aa04d28be6343c55f073d7b))
* upstash 직렬화 버그 수정 ([14ac217](https://github.com/y0ngha/siglens/commit/14ac2177f20508089e3ce57c0c6e53638a118a48))
* wrap API calls in try-catch for error handling ([d928ab3](https://github.com/y0ngha/siglens/commit/d928ab3829557ce6059a3ef4fa911de7232d4676))


### Features

* /[symbol]/fundamental 페이지 + 9개 섹션 컴포넌트 (RSC + Suspense) ([6e376fa](https://github.com/y0ngha/siglens/commit/6e376fad5745b500a9cfc42b31ef76d1edd990e8))
* /[symbol]/news 페이지 + sentiment 뱃지 + 종합 AI 분석 ([e199372](https://github.com/y0ngha/siglens/commit/e19937245f84bdf211568368c4eebeae7f549831))
* /[symbol]/overall 페이지 + 명시 트리거 + 의존성 진행 UI ([c33336a](https://github.com/y0ngha/siglens/commit/c33336afe91db4a5fe43ed64229de577f5984c16))
* /account 페이지 추가 ([652963b](https://github.com/y0ngha/siglens/commit/652963bee47c1dd5da618065361e74fcf35e041d))
* 계정 설정 페이지에 스켈레톤 추가 ([22ee10d](https://github.com/y0ngha/siglens/commit/22ee10d5abef265fe6736d2b4d9cd08e7b931530))
* 계정 설정 화면에서 Tier > 회원 등급으로 변경 ([4d65bb8](https://github.com/y0ngha/siglens/commit/4d65bb8d126cc9b6b254920ac11e9a60e647e85a))
* 공포 지수 > 공포 탐욕 지수로 변경 및 뱃지 위치 변경 ([80b9d2d](https://github.com/y0ngha/siglens/commit/80b9d2d3f28be7f3db15f95db03f76efbb214817))
* 공포/탐욕 지수 페이지 오류 수정 및 최적화 ([45f3c48](https://github.com/y0ngha/siglens/commit/45f3c48aea4b3970efad1c58c5255e21de6b453c))
* 구글 로그인 버튼 logo text > svg로 변경 ([26eee85](https://github.com/y0ngha/siglens/commit/26eee8545451046ae36bac9773905527c67a6872))
* 뉴스 페이지 사용성 개선 ([7da7267](https://github.com/y0ngha/siglens/commit/7da726757c71eb6b311c68f5a74dbf30c4821a60))
* 메인화면 정리 및 버튼 정리 ([08f27ce](https://github.com/y0ngha/siglens/commit/08f27ce80b40bc3ec0505eca1f5eda8d8a8de7e6))
* 모든 심볼 페이지 탭에서 AI 모델 선택 통합 ([b84bf13](https://github.com/y0ngha/siglens/commit/b84bf13b479ed025f7820e5ef2fd27b06de3be97))
* 모바일 바텀 시트 모바일 환경 & 하이드레이션 완료 후 나오도록 처리 ([16dbc74](https://github.com/y0ngha/siglens/commit/16dbc74476f5a94f5521d4d11f74bdb4555742b6))
* 분석 페이지에 모델 선택 UI 통합 ([f544781](https://github.com/y0ngha/siglens/commit/f54478104bd0a21bb5a718d0976aa05d56122aae))
* 분석 훅 cancel 로직 추가 ([983a2d4](https://github.com/y0ngha/siglens/commit/983a2d4129846ce21bc76826fd7e3f6ab8509194))
* 비밀번호 강도 힌트 가로배치로 변경 ([f63b9e8](https://github.com/y0ngha/siglens/commit/f63b9e883f63863c02a4d899d6bdd2a40a168a51))
* 비밀번호 재설정 확인 필드 및 동일 비밀번호 검증 추가 ([09007a1](https://github.com/y0ngha/siglens/commit/09007a1dee24865c150b10376c7d5baee1503d9d))
* 비밀번호 재설정 UI 및 siglens-core 0.1.14 연동 ([4d872e7](https://github.com/y0ngha/siglens/commit/4d872e7c3638d62fb0acf6f9918194920cbf5e90))
* 비밀번호 재설정 V2 마이그레이션 (Redis 기반) ([d8e35c8](https://github.com/y0ngha/siglens/commit/d8e35c80038a46411bb497dccd290d10a1bf5bbc))
* 새 분석 9개 Server Action (submit/poll/cancel × Fundamental/News/Overall) ([767aa40](https://github.com/y0ngha/siglens/commit/767aa40fbda379691338fd81e0d585e58cdd0b5b))
* 소셜 로그인 UI 구현 ([#369](https://github.com/y0ngha/siglens/issues/369) PR-2) ([2827d55](https://github.com/y0ngha/siglens/commit/2827d55e93159c2e34057842f1c38c66e9413878))
* 아바타 URL이 있는 경우 아바타 로딩하도록 추가 ([cc4e099](https://github.com/y0ngha/siglens/commit/cc4e09986c564cf2d9d1ff324c10fb16e35e1329))
* 영어 안내 메시지 > 한국어로 변경 ([ed3a534](https://github.com/y0ngha/siglens/commit/ed3a534aa881082720aa136a975446d4daa10cc1))
* 유명 티커 업데이트 스크립트 실행 ([cfd110f](https://github.com/y0ngha/siglens/commit/cfd110f476b7a9045ae3e71f23b6401d41892dfd))
* 이메일 인증 가입 흐름 (3단계) 구현 ([fd34f03](https://github.com/y0ngha/siglens/commit/fd34f0372a2fe94146d12fc6eddb50d338388e6b)), closes [siglens-core#55](https://github.com/siglens-core/issues/55)
* 이메일 인증 UI 구현 ([#369](https://github.com/y0ngha/siglens/issues/369)) ([0443801](https://github.com/y0ngha/siglens/commit/044380103a0452d50d352255bd3bff10a1c54f39))
* 이메일 전송시 얼만큼 유효한지 메일에 추가 ([b0fca08](https://github.com/y0ngha/siglens/commit/b0fca083ab63b9db63122b4b9de87aee874c8527))
* 종목 페이지 헤더 세그먼트 탭 (차트/뉴스/펀더/종합) ([6b1a811](https://github.com/y0ngha/siglens/commit/6b1a81100a52d0cdfb4ffd4838b96cdf1c661a6b))
* 차트 페이지에 뉴스 자료 종합 보강 섹션 추가 (A2+A3) ([b96a994](https://github.com/y0ngha/siglens/commit/b96a99461e9880ca7ce625d90abaab832c591072))
* 챗봇 멀티 provider 모델 선택 (Claude/Gemini/ChatGPT) ([734fa82](https://github.com/y0ngha/siglens/commit/734fa82480bfe065e3fb85a0ea5234275fe5cf98))
* 챗봇 페이지 전환 시 컨텍스트 시스템 메시지 추가 (usePathname 감지) ([7f568e2](https://github.com/y0ngha/siglens/commit/7f568e2c9d7b5e11ae4bb7448ce8872f9bb6071a))
* 카카오 로그인 임시 비활성화 ([ea487a1](https://github.com/y0ngha/siglens/commit/ea487a10d29c02d843e82dee83d4b23899f43cc5))
* 크로스링크 카드 내용 변경 ([8791e19](https://github.com/y0ngha/siglens/commit/8791e192621d410473a5349c843397baae9ce0bf))
* 테이블 변경사항 마이그레이션 ([e3fd6af](https://github.com/y0ngha/siglens/commit/e3fd6af9d8c514568c46dbf0e2992278188e17fe))
* 패스워드 재설정 내용 보여줄 때 개행되어서 보여줄 수 잇도록 변경 ([d6eab07](https://github.com/y0ngha/siglens/commit/d6eab07862141d0837d6bc686fd4b9a60b73350a))
* 펀더 -> 펀더멘털로 정정 ([ddff885](https://github.com/y0ngha/siglens/commit/ddff885f9e750ed7008b1eb5d2d8f2dbf28927b8))
* 페이지 끝 cross-link 카드 컴포넌트 + 설명 문구 ([42a34f2](https://github.com/y0ngha/siglens/commit/42a34f261ac88f362fb3e6046f510e939f5bd978))
* 헤더 버튼 크기 맞추기 및 TickerAutocomplete CSS 오류 수정 ([cb5d512](https://github.com/y0ngha/siglens/commit/cb5d5125923c3db94049f3b5d2fc1abdba4dd784))
* 헤더에 아바타 URL 전달 ([8042b63](https://github.com/y0ngha/siglens/commit/8042b634fa94a20759a0e4fac212da0ccf52af15))
* 회사 설명 한글 번역 및 thinking budget 지원 ([e06d18f](https://github.com/y0ngha/siglens/commit/e06d18fef90c1f85808b21cf32ed7520bb92b229))
* 회사 설명 한글 번역 및 thinking budget 지원 ([2032596](https://github.com/y0ngha/siglens/commit/2032596aba41c0d3401fe16ea981b929ae7fe66e))
* 회원 탈퇴 영역에 '위험존' 제거 ([08afedb](https://github.com/y0ngha/siglens/commit/08afedb4801df9ca15e0b7de92530fd92b502de8))
* 회원탈퇴 액션 및 UI 구현 ([3f28027](https://github.com/y0ngha/siglens/commit/3f2802710db0501710997b581f495ae7a028d281))
* 회원탈퇴 UI 통합 및 법률 페이지 갱신 ([c9630d8](https://github.com/y0ngha/siglens/commit/c9630d8258518084da390111b7b672211a5f353f))
* account API key management UI (ApiKeySection) ([8c2dbf1](https://github.com/y0ngha/siglens/commit/8c2dbf1e4b3f760ba6c121e1f26ac0cd71c413ab))
* add InfoTooltip to fundamental cards and fix mobile UX issues ([36cf3f2](https://github.com/y0ngha/siglens/commit/36cf3f23d043a77b6e3d5fcf6cec433248fef9de))
* add priceImpact to news DB schema and domain types ([49993fc](https://github.com/y0ngha/siglens/commit/49993fcf8985ad707c2d5966949178bb255a2ee3))
* AI 모델 기본값 및 스토리지 키 도메인 로직 ([13c3680](https://github.com/y0ngha/siglens/commit/13c3680bc9999906c998eefd9c847931e207fc21))
* AI 모델 선택 UI 컴포넌트 및 훅 구현 ([7a90cf2](https://github.com/y0ngha/siglens/commit/7a90cf20f91e5b7b791d6a9658b7504e48fda460))
* API Key Field 생성 ([ab120da](https://github.com/y0ngha/siglens/commit/ab120da2c7f05440472d1e6fe6dc31fcbd1c2599))
* API Key Section 문구 변경 ([d543813](https://github.com/y0ngha/siglens/commit/d5438132505199084212491d4af25fdf6b1bb788))
* auth 에러 메시지 한국어 통일 및 이메일 인증 enumeration 회피 복원 ([58a510a](https://github.com/y0ngha/siglens/commit/58a510a6ef72404ff92a05529e6f1cd3232a90bb))
* **auth:** add ConsentCheckboxGroup component ([a5218f6](https://github.com/y0ngha/siglens/commit/a5218f662460f523171fe0c62ff8389186f1c229))
* **auth:** add OAuth consent flow for new social login users ([a20d5a5](https://github.com/y0ngha/siglens/commit/a20d5a5506a98053c9ace903de0cb6390ec9c9b0))
* **auth:** integrate consent collection into email signup flow ([cc46fad](https://github.com/y0ngha/siglens/commit/cc46fad9e8e727b9bb439c591ebc36289da3fb1c))
* **auth:** integrate terms consent into email signup flow ([3b54661](https://github.com/y0ngha/siglens/commit/3b54661263be687267c7cc6f73ca454d9f48637a))
* Contact Us 페이지를 구조화된 문의 폼으로 대체 ([#398](https://github.com/y0ngha/siglens/issues/398)) ([a4627cb](https://github.com/y0ngha/siglens/commit/a4627cb052bc629b0ef80b702787079f6bfe8089))
* **db:** add agreementRepository with insertMany ([88477c2](https://github.com/y0ngha/siglens/commit/88477c20a9ac45e0b2e22e39af1716928caf950f))
* **db:** add terms and agreements tables ([f73d8d0](https://github.com/y0ngha/siglens/commit/f73d8d03e70270e5ce5cdc22bdf4f98a07f5717d))
* **db:** add TERMS_KIND_VALUES constant ([c17de66](https://github.com/y0ngha/siglens/commit/c17de66c292015d4260909fd4e3b4a265adfe033))
* **db:** add termsRepository with findActive and upsertFromSeed ([7af7d27](https://github.com/y0ngha/siglens/commit/7af7d27d13423321bbeaa53a6085bc6fedcabf1f))
* DEFAULT_SITE_URL 상수 export ([61af34d](https://github.com/y0ngha/siglens/commit/61af34d77d0ae7ce2400fc38b3c3e8d32ecf7853))
* **design:** Api Key Section 저장된 이후 삭제와 같은 라인에 보이도록 UI 수정 ([2ebed57](https://github.com/y0ngha/siglens/commit/2ebed57da963e9d1f16845f50a6ca3636a4b8cca))
* domain/llm modelTier + infrastructure/llm Server Actions + tests ([87c5702](https://github.com/y0ngha/siglens/commit/87c570243b5b32ab1d21d9b37efd9d3649519563))
* **domain:** add legal/termsKind re-export ([4e661f4](https://github.com/y0ngha/siglens/commit/4e661f4d88fb210c20660d9bc55e4e76d0907bd4))
* earnings-calendar Cron sync (Vercel Cron 06:00 UTC) ([c5862b5](https://github.com/y0ngha/siglens/commit/c5862b51dcbb6c95ecc472302e62790e34cd6481))
* **fearGreed:** a11y + i18n polish (SVG warning icon, Intl.NumberFormat, empty-state copy, chart aria-label) ([05be0c3](https://github.com/y0ngha/siglens/commit/05be0c3556f060c2b6844adc56a4ae9ae1113344))
* **fearGreed:** add '공포 지수' tab to TABS (before '종합') ([dbed8da](https://github.com/y0ngha/siglens/commit/dbed8dad853a6f9a464c7a18935f426e88b7af46))
* **fearGreed:** add /[symbol]/fear-greed route shell + stub page ([1c00132](https://github.com/y0ngha/siglens/commit/1c00132bac0060707ea92b483eb1062ff7bb4d82))
* **fearGreed:** add factor label/format helpers ([65dcb44](https://github.com/y0ngha/siglens/commit/65dcb44adbb698f8578b9ee0d4ae19d3563e254f))
* **fearGreed:** add FearGreedCard for analysis panel ([9e4d0c2](https://github.com/y0ngha/siglens/commit/9e4d0c206274add2fbccde132664e7ab68040581))
* **fearGreed:** add FearGreedComparisonGauges (Now/1W/1M/1Y) ([cf8ff6f](https://github.com/y0ngha/siglens/commit/cf8ff6f4511d227316bd137a1e7be7c5b40b3538))
* **fearGreed:** add FearGreedGroupBar with factor breakdown ([97a54d2](https://github.com/y0ngha/siglens/commit/97a54d27f64432b98b05f77142730c854203c997))
* **fearGreed:** add FearGreedHero semicircle gauge ([ca36ff6](https://github.com/y0ngha/siglens/commit/ca36ff6b04b21cc80a0178325efd86adcbd50b35))
* **fearGreed:** add FearGreedHistoricalChart line chart ([912fdab](https://github.com/y0ngha/siglens/commit/912fdabf674cc3bdfada579f371df273fa949d26))
* **fearGreed:** add header chip ([30c9430](https://github.com/y0ngha/siglens/commit/30c943037aa395990cccefd29b7742f2b1ad2d9a))
* **fearGreed:** add OG/Twitter meta + WebPage/Breadcrumb/FAQ JSON-LD ([c163610](https://github.com/y0ngha/siglens/commit/c1636105b311cabd41d3e975de45c929af5ce441))
* **fearGreed:** add QUERY_KEYS.fearGreed factory ([53caa44](https://github.com/y0ngha/siglens/commit/53caa440fa92e6628e77a7e8b47454dcdad3db07))
* **fearGreed:** add SelfNormWarningBadge ([66ff023](https://github.com/y0ngha/siglens/commit/66ff023375061a590dea31a10d33de9494ffc646))
* **fearGreed:** add useFearGreed hook ([4171018](https://github.com/y0ngha/siglens/commit/41710181ac96b62e47b94d4a063ba34127cf6b17))
* **fearGreed:** compose FearGreedPage with Hero + Comparison + Groups + Historical ([0182862](https://github.com/y0ngha/siglens/commit/0182862be1f93f5281c2944f87116662dbae93b1))
* **fearGreed:** desktop 2-column layout (Hero+Comparison left, Groups right) ([e88e380](https://github.com/y0ngha/siglens/commit/e88e3807840d816d4d243b0f71072d6c234e5506))
* **fearGreed:** extract FearGreedGauge primitive + CNN-style mini gauges ([2b78ea9](https://github.com/y0ngha/siglens/commit/2b78ea938e32633dd6ce6d05ac02c75de96568b9))
* **fearGreed:** GroupBar score-color fill + bold extreme percentiles ([664652d](https://github.com/y0ngha/siglens/commit/664652d4eacadf606208f1d764da6ba192a22476))
* **fearGreed:** guide section + per-section h2 + CrossLinkCards expansion ([37f9807](https://github.com/y0ngha/siglens/commit/37f9807e9444ae496e800968aad6070163219bc4))
* **fearGreed:** hero gauge — needle indicator + tick labels + bigger sentiment label ([a621e06](https://github.com/y0ngha/siglens/commit/a621e066b94a11fe2f2e806c77c1b9c8637f28af))
* **fearGreed:** mount header chip in SymbolLayoutHeader ([36fdde1](https://github.com/y0ngha/siglens/commit/36fdde1d74b390d8c4dd4202de56c997ad47f159))
* **fearGreed:** replace NewsAugment with FearGreedCard in ChartContent ([a106317](https://github.com/y0ngha/siglens/commit/a106317728567e32553f81905aa9988b62a3edf1))
* **fearGreed:** SEO foundation (sr-only h1 + canonical helper + sitemap entry) ([4b837af](https://github.com/y0ngha/siglens/commit/4b837af0ec8748d2ccaeb554f023d3d5d9ae26b7))
* FMP Fundamental client (15 endpoint, FundamentalDataProvider 구현) ([2030fec](https://github.com/y0ngha/siglens/commit/2030fec7614651b78d0421c5aa0783abc3eccc84))
* FMP News + Earnings client (NewsProvider 구현) ([209c190](https://github.com/y0ngha/siglens/commit/209c19027403e6b2f5dece8bee9db5e94920be71))
* gpt, claude 변경될 형식에 맞춰 수정 ([be77a54](https://github.com/y0ngha/siglens/commit/be77a5445b6538724b1f274bb0a1180caa293d11))
* info tooltip 전체 영역에 대해 친절하게 개선 ([e30b156](https://github.com/y0ngha/siglens/commit/e30b156b07537bf07c23044e0a6837867487a7f8))
* InfoTooltip 보다 친절하게 개선 ([9a353a1](https://github.com/y0ngha/siglens/commit/9a353a1de92dd6a4587f2353aadd09a735b78f12))
* **legal:** add PolicyMarkdownBody component ([10b5063](https://github.com/y0ngha/siglens/commit/10b50632fe6c377279a92788909ceb6452480906))
* **lib:** add legal-toc extractor for h2 headings ([60cbea0](https://github.com/y0ngha/siglens/commit/60cbea060a6e4b0cf1676add9e80e2e38122b970))
* llm provider labels 변경 ([d268c0f](https://github.com/y0ngha/siglens/commit/d268c0fb0688594155f7a76157612170084796ed))
* news/earnings repository 구현 ([f5b2e12](https://github.com/y0ngha/siglens/commit/f5b2e12ff78488a86db2c2a5f74d2972fe2d51c6))
* news/earnings_calendar/earnings_reports Drizzle 스키마 + 마이그레이션 ([3aea8e8](https://github.com/y0ngha/siglens/commit/3aea8e8ac9a1344d507c02d981f0379b9b95dcbb))
* **news:** disable thinking budget for card analysis + refresh aggregate after new articles ([bb53db4](https://github.com/y0ngha/siglens/commit/bb53db4cdc3328e693f31f74b8076c2119dfc0ac))
* overall section markdown 적용 ([7d5f984](https://github.com/y0ngha/siglens/commit/7d5f984d7bd7e7dacf7ea84b3e075e19c533af66))
* premium model gate modal + useChat gating + chatAction guard ([dfe3966](https://github.com/y0ngha/siglens/commit/dfe39660c1589886944d467e118a8f7325c10c29))
* privacy에 gpt 추가 및 내용 수정 ([dbb4d48](https://github.com/y0ngha/siglens/commit/dbb4d48ba684d72f4ea2d065d07664539bafc819))
* **privacy:** render policy body from terms table ([f3f65dd](https://github.com/y0ngha/siglens/commit/f3f65dd542ba47ea9843b0ba3f20f0f2768609b7))
* PWA 기능 구현 (오프라인 지원, iOS 설치 가이드) ([a680b2e](https://github.com/y0ngha/siglens/commit/a680b2e93a8be983fa4d844ae3a68e3bb5423b03))
* **pwa:** add detectPwaEnvironment pure function with tests ([600460d](https://github.com/y0ngha/siglens/commit/600460dbb7f91066e00b9e2a715a2c235ba2e3db))
* **pwa:** add IosInstallModal with 3-step install guide ([b1f7af7](https://github.com/y0ngha/siglens/commit/b1f7af7996460bb47b2e504b894502c7e48a4759))
* **pwa:** add manual service worker with cache strategy ([80d19ef](https://github.com/y0ngha/siglens/commit/80d19ef6a11c2f094486673eb474b54c32530873))
* **pwa:** add offline fallback page and iOS install guide SVGs ([7791a35](https://github.com/y0ngha/siglens/commit/7791a3568b595fb5c6ca0cbd3646acbeeb4ffce1))
* **pwa:** add PwaBanner slim bar component ([a181457](https://github.com/y0ngha/siglens/commit/a18145757d962bd1b3b317f4dbf4ad8f47e258cd))
* **pwa:** add usePwaInstall hook with platform detection and install state ([752fd95](https://github.com/y0ngha/siglens/commit/752fd95b1fb2a93f8f146d464f1a2e5162bc47e7))
* **pwa:** dispatch pwa-trigger on analysis complete and 30s fallback ([fff08c5](https://github.com/y0ngha/siglens/commit/fff08c576a941ab49c838b6da259265767a107b1))
* **pwa:** enhance manifest with id, display_override, screenshots, shortcuts ([90dac6c](https://github.com/y0ngha/siglens/commit/90dac6c8cb50cdd0e97a72cd28a8338cd5b7347a))
* **pwa:** insert PwaBanner into root layout above Header ([3c814a2](https://github.com/y0ngha/siglens/commit/3c814a2056943d45dcf1310ac6a66e98b998bf67))
* rewrite news enrichment pipeline with poll-then-persist and client polling support ([9f41542](https://github.com/y0ngha/siglens/commit/9f4154279797f104335a777c26a725b4900c3cb4))
* rq로 리팩토링 및 회사명 추가 ([17f8efb](https://github.com/y0ngha/siglens/commit/17f8efb5d0fdc7bf06e60b19233ccb746b537771))
* **seed:** add privacy policy v1 markdown ([c9f3d35](https://github.com/y0ngha/siglens/commit/c9f3d358d3a711b796979bc27e8691276b7fae7a))
* **seed:** add seedTerms script with markdown parsing ([8a29431](https://github.com/y0ngha/siglens/commit/8a29431664d4c3960af161de8896bac752f6c170))
* **seed:** add terms of service v1 markdown ([36455ab](https://github.com/y0ngha/siglens/commit/36455abdc4dfc17c0b7e9442bf747cc7f0a20446))
* SEO 전면 개선 (49항목 / 4 Phase / 26 Task) ([e8ff0a6](https://github.com/y0ngha/siglens/commit/e8ff0a66291a2e5ea654e402874492e92745bd4e))
* **seo:** refresh sitewide SEO copy for fear-greed axis (4축 → 5축, sentiment → 분위기, 어닝/실적 동반) ([c4973a7](https://github.com/y0ngha/siglens/commit/c4973a7f68208beb607539b133ac1fb6f664ecdd))
* sign up은 force dynamic 처리 ([55a5da6](https://github.com/y0ngha/siglens/commit/55a5da6747b7f0ac346beacdc631ac1e8213b18a))
* Skills 카탈로그 fundamental/news 6종 추가 ([81456fc](https://github.com/y0ngha/siglens/commit/81456fc8b13e08fc1ca9fc6791cb67216dd460f7))
* **terms:** render terms body from terms table; drop unused effective date constant ([97a3675](https://github.com/y0ngha/siglens/commit/97a367589e3ddf4b61483b4c33a4c9d4fdbeb9c4))
* useEmailVerificationForms hook 추가 ([a89e76f](https://github.com/y0ngha/siglens/commit/a89e76fd0df77677bb1cc813844b326048d32c32))
* worker AI provider 고도화 — Claude/ChatGPT 추가 및 Gemini 파라미터화 ([3a40138](https://github.com/y0ngha/siglens/commit/3a40138868260b15f415a3f83f7e1dd8be67c0e1))

## [0.10.2](https://github.com/y0ngha/siglens/compare/v0.10.1...v0.10.2) (2026-04-28)

## [0.10.1](https://github.com/y0ngha/siglens/compare/v0.10.0...v0.10.1) (2026-04-28)


### Bug Fixes

* 모바일에서 헤더 티커검색 클릭이 안됨(검색 안되는 이슈 처리) ([db9e949](https://github.com/y0ngha/siglens/commit/db9e949be07b6dc0843b5fd9276b293feadb24f1))
* 심볼 분석 페이지 [SYMBOL]로 나는 이슈 처리 ([0f7e3e8](https://github.com/y0ngha/siglens/commit/0f7e3e89d398837a9bb074d33ccc49af96fc4d3e))

# [0.10.0](https://github.com/y0ngha/siglens/compare/v0.8.21...v0.10.0) (2026-04-27)


### Bug Fixes

* 350 리뷰 코멘트 반영 완료 ([9ac26ac](https://github.com/y0ngha/siglens/commit/9ac26acfc8d68952808fdb85c268542172e610ad)), closes [#7](https://github.com/y0ngha/siglens/issues/7)
* 383 리뷰 코멘트 반영 완료 ([b0d7eac](https://github.com/y0ngha/siglens/commit/b0d7eac5e00f5ad7d7716fb3231ed4987b2bb5a0))
* AI briefing retryDelay 제한 추가 및 유료 키 폴백 ([2bd5396](https://github.com/y0ngha/siglens/commit/2bd53961d93480207a935693e3e527c9bb6c4c00))
* briefing 재시도 딜레이 및 유료 키 폴백 로직 정리 ([389b137](https://github.com/y0ngha/siglens/commit/389b137830c74da7e2b46f1d5f9fda85d7fa9328))
* immutable pattern 및 import 통합 ([7a11cd7](https://github.com/y0ngha/siglens/commit/7a11cd714a60773a7aac8dd98be4187098cba161))
* MISTAKES.md violations (paradigm, error handling, test coverage) ([20be818](https://github.com/y0ngha/siglens/commit/20be8183cff297faa45441c819c14fb09245c62a)), closes [#21](https://github.com/y0ngha/siglens/issues/21) [#5](https://github.com/y0ngha/siglens/issues/5) [#2](https://github.com/y0ngha/siglens/issues/2)
* nameIsDiffrent 타입 오류 수정 ([4e66d7c](https://github.com/y0ngha/siglens/commit/4e66d7c6f84c889c2f9bceac63f72a7541599da6))
* PR [#345](https://github.com/y0ngha/siglens/issues/345) 리뷰 코멘트 반영 완료 ([443047a](https://github.com/y0ngha/siglens/commit/443047a07f511b5d9dc2bb4b2ffd06f2a718bec0))
* PR [#345](https://github.com/y0ngha/siglens/issues/345) 리뷰 코멘트 반영 완료 ([46bc618](https://github.com/y0ngha/siglens/commit/46bc618d0b8885b8bc6326c248f9fba4c839a2d1))
* PR [#379](https://github.com/y0ngha/siglens/issues/379) 리뷰 코멘트 반영 완료 ([e79ff8e](https://github.com/y0ngha/siglens/commit/e79ff8eac40716d55e9bf24f359e0cc953925f7b))
* PR [#380](https://github.com/y0ngha/siglens/issues/380) 리뷰 코멘트 반영 완료 ([2c4261b](https://github.com/y0ngha/siglens/commit/2c4261bd046331f3f73eb2c4f30dc89422408daf))
* PR [#380](https://github.com/y0ngha/siglens/issues/380) 리뷰 코멘트 반영 완료 ([0eda22e](https://github.com/y0ngha/siglens/commit/0eda22ef75c1c1aef4cd1e74653d0585feaff0a9))
* PR [#380](https://github.com/y0ngha/siglens/issues/380) 리뷰 코멘트 반영 완료 ([e501c56](https://github.com/y0ngha/siglens/commit/e501c56cab7b0adeb7fac0f13fe706f23cae065d))
* Restore domain/analysis modules and fix component/hook imports ([0354464](https://github.com/y0ngha/siglens/commit/0354464308425e3e755556639e6899726305b957)), closes [#384](https://github.com/y0ngha/siglens/issues/384)
* thinkingBudget 재시도 간 보존 및 Free→Paid 키 전환 시 상태 공유 ([#350](https://github.com/y0ngha/siglens/issues/350)) ([804871b](https://github.com/y0ngha/siglens/commit/804871b63b2a68b4f9182897f9c96891daca1234))
* 리뷰 코멘트 반영 완료 ([f40142c](https://github.com/y0ngha/siglens/commit/f40142c817ccb61c3d1b33203a76fb6353d5f931))
* 마켓 페이지 섹터 시그널 등락률 오류 ([05ebec2](https://github.com/y0ngha/siglens/commit/05ebec2fb6461cc4da62162948b95a8ec55dcf53))
* 백테스트 생성 스크립트 수정 ([a71ab47](https://github.com/y0ngha/siglens/commit/a71ab47fe02fa8bc9b0da967382c9e9dad52b3cb))
* 심볼 페이지 제목이 '[SYMBOL]' 플레이스홀더를 표시하는 문제 해결 ([4e7c1d2](https://github.com/y0ngha/siglens/commit/4e7c1d27c42cb50ea47aff4df9b5823004ad56e5))
* 재시도 로직 ESLint 위반 수정 ([#380](https://github.com/y0ngha/siglens/issues/380)) ([0179ddf](https://github.com/y0ngha/siglens/commit/0179ddf0d099a5e24586a1f516a30ca412e5a210))
* 중복 import 통합 및 dead code 제거 ([a115d46](https://github.com/y0ngha/siglens/commit/a115d46aaab7d785bcf03b9cbafb4b9a55e5035e))
* 채팅 모델 선택 UI 및 로직 개선 ([dc2c525](https://github.com/y0ngha/siglens/commit/dc2c525e9e1f43f6da016bb33b7f8da6e00c8656))
* 채팅 모델 선택기 유효성 검증 및 키보드 네비게이션 개선 ([cb161de](https://github.com/y0ngha/siglens/commit/cb161de58b1fab31e4c2a6acac3b704a46c43662))
* 채팅 패널 모델 선택 타이밍 버그 및 포커스 관리 개선 ([2384bfd](https://github.com/y0ngha/siglens/commit/2384bfdf63f83315a784bc1c9adf6e603ae20684))


### Features

* chatAction — model 파라미터 추가, server_busy(503) 에러 처리 ([91b6aa1](https://github.com/y0ngha/siglens/commit/91b6aa1384c2f7a256aaebda0d598f59748de25c))
* ChatModel 타입, server_busy 에러코드 추가 ([574a8eb](https://github.com/y0ngha/siglens/commit/574a8ebb35f8b210555a44686e8c1f17db3e73a4))
* ChatPanel 모델 선택 드롭다운 UI 및 접근성 개선 ([acbd165](https://github.com/y0ngha/siglens/commit/acbd165f1e354185e04ff5e8e9c20a9cba83016a))
* Gemini 모델 ID 상수 정의 (chatModels) ([3edb986](https://github.com/y0ngha/siglens/commit/3edb9866566aba894c71f912181d59628cc80001))
* Migrate core/infrastructure modules to @y0ngha/siglens-core ([ed16346](https://github.com/y0ngha/siglens/commit/ed16346a2f5d5bfacb6772edf54aad375f8bfeb8))
* useChat — selectedModel 상태 추가, server_busy 에러 메시지 ([50844f4](https://github.com/y0ngha/siglens/commit/50844f4461980958587af43b7d902678405a8eb6))
* worker gemini retry 허용 시간 30초로 변경 ([8315997](https://github.com/y0ngha/siglens/commit/8315997ff5938037f260c7029dcbf16d6f88909e))
* worker gemini 응답 분기 수정 ([cd90b17](https://github.com/y0ngha/siglens/commit/cd90b17f32b5f5bc7fbe0a067a15f6275b8c4b35))
* 로컬 지표 상수 및 신호 함수 마이그레이션, 안정성 강화 ([58257fd](https://github.com/y0ngha/siglens/commit/58257fdd273b0e52463453da7af9d6103c1a5dd9))
* 분석 패널 및 채팅 패널 마크다운 개선 ([5d71793](https://github.com/y0ngha/siglens/commit/5d717931514dc9219a3fe9bd8ac5357033853e9e))
* 이번 주 할 일 불러올 때 markdown도 제대로 불러오도록 처리 ([e9b529c](https://github.com/y0ngha/siglens/commit/e9b529ce71599b6538f596cd00f2180cb69d6efa))

# [0.9.0](https://github.com/y0ngha/siglens/compare/v0.8.21...v0.9.0) (2026-04-27)


### Bug Fixes

* 350 리뷰 코멘트 반영 완료 ([9ac26ac](https://github.com/y0ngha/siglens/commit/9ac26acfc8d68952808fdb85c268542172e610ad)), closes [#7](https://github.com/y0ngha/siglens/issues/7)
* 383 리뷰 코멘트 반영 완료 ([b0d7eac](https://github.com/y0ngha/siglens/commit/b0d7eac5e00f5ad7d7716fb3231ed4987b2bb5a0))
* AI briefing retryDelay 제한 추가 및 유료 키 폴백 ([2bd5396](https://github.com/y0ngha/siglens/commit/2bd53961d93480207a935693e3e527c9bb6c4c00))
* briefing 재시도 딜레이 및 유료 키 폴백 로직 정리 ([389b137](https://github.com/y0ngha/siglens/commit/389b137830c74da7e2b46f1d5f9fda85d7fa9328))
* immutable pattern 및 import 통합 ([7a11cd7](https://github.com/y0ngha/siglens/commit/7a11cd714a60773a7aac8dd98be4187098cba161))
* MISTAKES.md violations (paradigm, error handling, test coverage) ([20be818](https://github.com/y0ngha/siglens/commit/20be8183cff297faa45441c819c14fb09245c62a)), closes [#21](https://github.com/y0ngha/siglens/issues/21) [#5](https://github.com/y0ngha/siglens/issues/5) [#2](https://github.com/y0ngha/siglens/issues/2)
* nameIsDiffrent 타입 오류 수정 ([4e66d7c](https://github.com/y0ngha/siglens/commit/4e66d7c6f84c889c2f9bceac63f72a7541599da6))
* PR [#345](https://github.com/y0ngha/siglens/issues/345) 리뷰 코멘트 반영 완료 ([443047a](https://github.com/y0ngha/siglens/commit/443047a07f511b5d9dc2bb4b2ffd06f2a718bec0))
* PR [#345](https://github.com/y0ngha/siglens/issues/345) 리뷰 코멘트 반영 완료 ([46bc618](https://github.com/y0ngha/siglens/commit/46bc618d0b8885b8bc6326c248f9fba4c839a2d1))
* PR [#379](https://github.com/y0ngha/siglens/issues/379) 리뷰 코멘트 반영 완료 ([e79ff8e](https://github.com/y0ngha/siglens/commit/e79ff8eac40716d55e9bf24f359e0cc953925f7b))
* PR [#380](https://github.com/y0ngha/siglens/issues/380) 리뷰 코멘트 반영 완료 ([2c4261b](https://github.com/y0ngha/siglens/commit/2c4261bd046331f3f73eb2c4f30dc89422408daf))
* PR [#380](https://github.com/y0ngha/siglens/issues/380) 리뷰 코멘트 반영 완료 ([0eda22e](https://github.com/y0ngha/siglens/commit/0eda22ef75c1c1aef4cd1e74653d0585feaff0a9))
* PR [#380](https://github.com/y0ngha/siglens/issues/380) 리뷰 코멘트 반영 완료 ([e501c56](https://github.com/y0ngha/siglens/commit/e501c56cab7b0adeb7fac0f13fe706f23cae065d))
* Restore domain/analysis modules and fix component/hook imports ([0354464](https://github.com/y0ngha/siglens/commit/0354464308425e3e755556639e6899726305b957)), closes [#384](https://github.com/y0ngha/siglens/issues/384)
* thinkingBudget 재시도 간 보존 및 Free→Paid 키 전환 시 상태 공유 ([#350](https://github.com/y0ngha/siglens/issues/350)) ([804871b](https://github.com/y0ngha/siglens/commit/804871b63b2a68b4f9182897f9c96891daca1234))
* 리뷰 코멘트 반영 완료 ([f40142c](https://github.com/y0ngha/siglens/commit/f40142c817ccb61c3d1b33203a76fb6353d5f931))
* 마켓 페이지 섹터 시그널 등락률 오류 ([05ebec2](https://github.com/y0ngha/siglens/commit/05ebec2fb6461cc4da62162948b95a8ec55dcf53))
* 백테스트 생성 스크립트 수정 ([a71ab47](https://github.com/y0ngha/siglens/commit/a71ab47fe02fa8bc9b0da967382c9e9dad52b3cb))
* 심볼 페이지 제목이 '[SYMBOL]' 플레이스홀더를 표시하는 문제 해결 ([4e7c1d2](https://github.com/y0ngha/siglens/commit/4e7c1d27c42cb50ea47aff4df9b5823004ad56e5))
* 재시도 로직 ESLint 위반 수정 ([#380](https://github.com/y0ngha/siglens/issues/380)) ([0179ddf](https://github.com/y0ngha/siglens/commit/0179ddf0d099a5e24586a1f516a30ca412e5a210))
* 중복 import 통합 및 dead code 제거 ([a115d46](https://github.com/y0ngha/siglens/commit/a115d46aaab7d785bcf03b9cbafb4b9a55e5035e))
* 채팅 모델 선택 UI 및 로직 개선 ([dc2c525](https://github.com/y0ngha/siglens/commit/dc2c525e9e1f43f6da016bb33b7f8da6e00c8656))
* 채팅 모델 선택기 유효성 검증 및 키보드 네비게이션 개선 ([cb161de](https://github.com/y0ngha/siglens/commit/cb161de58b1fab31e4c2a6acac3b704a46c43662))
* 채팅 패널 모델 선택 타이밍 버그 및 포커스 관리 개선 ([2384bfd](https://github.com/y0ngha/siglens/commit/2384bfdf63f83315a784bc1c9adf6e603ae20684))


### Features

* chatAction — model 파라미터 추가, server_busy(503) 에러 처리 ([91b6aa1](https://github.com/y0ngha/siglens/commit/91b6aa1384c2f7a256aaebda0d598f59748de25c))
* ChatModel 타입, server_busy 에러코드 추가 ([574a8eb](https://github.com/y0ngha/siglens/commit/574a8ebb35f8b210555a44686e8c1f17db3e73a4))
* ChatPanel 모델 선택 드롭다운 UI 및 접근성 개선 ([acbd165](https://github.com/y0ngha/siglens/commit/acbd165f1e354185e04ff5e8e9c20a9cba83016a))
* Gemini 모델 ID 상수 정의 (chatModels) ([3edb986](https://github.com/y0ngha/siglens/commit/3edb9866566aba894c71f912181d59628cc80001))
* Migrate core/infrastructure modules to @y0ngha/siglens-core ([ed16346](https://github.com/y0ngha/siglens/commit/ed16346a2f5d5bfacb6772edf54aad375f8bfeb8))
* useChat — selectedModel 상태 추가, server_busy 에러 메시지 ([50844f4](https://github.com/y0ngha/siglens/commit/50844f4461980958587af43b7d902678405a8eb6))
* worker gemini retry 허용 시간 30초로 변경 ([8315997](https://github.com/y0ngha/siglens/commit/8315997ff5938037f260c7029dcbf16d6f88909e))
* worker gemini 응답 분기 수정 ([cd90b17](https://github.com/y0ngha/siglens/commit/cd90b17f32b5f5bc7fbe0a067a15f6275b8c4b35))
* 로컬 지표 상수 및 신호 함수 마이그레이션, 안정성 강화 ([58257fd](https://github.com/y0ngha/siglens/commit/58257fdd273b0e52463453da7af9d6103c1a5dd9))
* 분석 패널 및 채팅 패널 마크다운 개선 ([5d71793](https://github.com/y0ngha/siglens/commit/5d717931514dc9219a3fe9bd8ac5357033853e9e))
* 이번 주 할 일 불러올 때 markdown도 제대로 불러오도록 처리 ([e9b529c](https://github.com/y0ngha/siglens/commit/e9b529ce71599b6538f596cd00f2180cb69d6efa))

## [0.8.21](https://github.com/y0ngha/siglens/compare/v0.8.20...v0.8.21) (2026-04-21)


### Bug Fixes

* 리포트 복사시 } 잘못 들어가는 것 수정 ([84d79f6](https://github.com/y0ngha/siglens/commit/84d79f6b8e5cd7065bf3ddb7ceb40a883c169d32))


### Features

* AI 분석 툴팁 문구 변경 ([e89d7e8](https://github.com/y0ngha/siglens/commit/e89d7e8752caa49f44df02a1753c38e2ecb6d7ef))

## [0.8.20](https://github.com/y0ngha/siglens/compare/v0.8.19...v0.8.20) (2026-04-21)


### Bug Fixes

* market에서 브리핑 안보이던 것 수정 ([4969868](https://github.com/y0ngha/siglens/commit/496986847d6602263ac5563e7b66d3240dafa8e4))
* 마켓 데이터 보여줄 때 등락률 제대로 안보여주던 것 수정 ([ee3cde7](https://github.com/y0ngha/siglens/commit/ee3cde73dc8841472cd2e573095436523532763c))

## [0.8.19](https://github.com/y0ngha/siglens/compare/v0.8.18...v0.8.19) (2026-04-21)


### Bug Fixes

* 브리핑 데이터 가져올 때 무한로딩 걸리는 버그 수정 ([05c6da6](https://github.com/y0ngha/siglens/commit/05c6da63c84aa6671e9ae98591be7ce62e051c28))

## [0.8.18](https://github.com/y0ngha/siglens/compare/v0.8.17...v0.8.18) (2026-04-21)


### Bug Fixes

* PR [#344](https://github.com/y0ngha/siglens/issues/344) Round 15 리뷰 코멘트 반영 (instanceof 타입 가드 적용, RiskBadge 타입 강화) ([a3f4d17](https://github.com/y0ngha/siglens/commit/a3f4d179252ac2dee60e9e67beb1458b498f78de))
* 라우팅 계층 리팩토링 Round 5 - 테스트 커버리지 및 코드 정리 ([06addb3](https://github.com/y0ngha/siglens/commit/06addb39bbf704edee10b3cb7b202529d47d9941))
* 리뷰 fix ([1e26c71](https://github.com/y0ngha/siglens/commit/1e26c71c3223e7d2d581109a65802f540b9a73cd))
* 리뷰 fix ([7f28fad](https://github.com/y0ngha/siglens/commit/7f28fad210daf7fc0f345880cda200f567df77eb))


### Features

* 백테스팅 datasetJsonLd license 추가 ([d420a35](https://github.com/y0ngha/siglens/commit/d420a359210b6a0fe03d923fa09a90d9d1bf7bcc))


### Reverts

* claude code review action ([3504cbc](https://github.com/y0ngha/siglens/commit/3504cbce173a3ac12c58e7584a0427b19f6056f5))
* claude code review action ([4e2ded0](https://github.com/y0ngha/siglens/commit/4e2ded094dfb309aac7613c4323a290adea50d3d))

## [0.8.17](https://github.com/y0ngha/siglens/compare/v0.8.16...v0.8.17) (2026-04-20)


### Bug Fixes

* address PR [#342](https://github.com/y0ngha/siglens/issues/342) review comments (round 8) ([a95091d](https://github.com/y0ngha/siglens/commit/a95091da590b3047f555213391530079528a4f13))
* ensure TP array ascending order after fallback substitution ([95602b5](https://github.com/y0ngha/siglens/commit/95602b506d341121f473fd1115722733d8f8d53d))
* getTooltipPosition 호출과 ReconciledLevelsBlockFromRecProps 인터페이스 추출 ([27bad02](https://github.com/y0ngha/siglens/commit/27bad02a288f58820cbbdb44b581ad37562ba23a))
* lint 오류 해결 ([9fb84bc](https://github.com/y0ngha/siglens/commit/9fb84bcc2600cea7c08ae085b6f3b4284f61cdb5))
* market 페이지 내 suspense boundary 오류 수정 ([db2a461](https://github.com/y0ngha/siglens/commit/db2a4614e13fb6a32e86fbcfd4824d5a37ecee90))
* PR [#342](https://github.com/y0ngha/siglens/issues/342) 리뷰 코멘트 반영 ([14fb3c2](https://github.com/y0ngha/siglens/commit/14fb3c23ca84f07e0e5235b13d72a70d3b287466))
* TP filter와 tooltip position 파라미터 정정 ([fa0dbf5](https://github.com/y0ngha/siglens/commit/fa0dbf5688be8275dfca7049991dde9078b5dd92))


### Features

* **analysis/ui:** add reconciled-levels block with tooltip in info panel ([1c8eb39](https://github.com/y0ngha/siglens/commit/1c8eb39c8f16e507ce08bbd2275600d943997363))
* **analysis:** add reconcileBullishActionRecommendation for production SL/TP safety ([7d2821e](https://github.com/y0ngha/siglens/commit/7d2821e377cf9dd73b92f62416a4d697b9ae9b9f))
* **analysis:** integrate SL/TP reconciliation into production AI pipeline ([091cdf6](https://github.com/y0ngha/siglens/commit/091cdf62cb11165db214b20d69da33233807378f))
* **backtest:** add AI SL/TP validation and ATR-based fallback resolver ([96dd49b](https://github.com/y0ngha/siglens/commit/96dd49b7a89181edb56b26ef9d6bd368ccc2b5f0))
* **backtest:** integrate SL/TP resolver into generate-backtest ([aea504d](https://github.com/y0ngha/siglens/commit/aea504dc12ffb47bb70b634e49faabfa1c65b459))
* **chart:** render reconciled SL/TP lines (dashed, "(보정)" label) ([4692113](https://github.com/y0ngha/siglens/commit/46921133ab12f6c6a731067c832895b1f0a0ef5d)), closes [#n](https://github.com/y0ngha/siglens/issues/n)
* **market:** add infoMessage prop and mixed variant to SignalSubsection ([a5428ed](https://github.com/y0ngha/siglens/commit/a5428edbcb8fad64301bd465c75cfb6d42382ac8))
* **market:** 섹터 신호 탐색 혼재 영역 추가 ([ef67a40](https://github.com/y0ngha/siglens/commit/ef67a40373710ec3ebe31022b012a9c9e848652e))
* **types:** add ReconciledActionLevels + reconciledLevels field on ActionRecommendation ([ca8b335](https://github.com/y0ngha/siglens/commit/ca8b335076eaf9f59d4226f35d70baf336364ac7))
* worker에서 retry 시간 이후 시도할 수 있다면, 시도하도록 처리 ([1eb842b](https://github.com/y0ngha/siglens/commit/1eb842b676b5c81bcf17285a84f839c22c72775c))
* worker에서 retry 허용 시간을 60초로 수정 ([3a81bf0](https://github.com/y0ngha/siglens/commit/3a81bf0103930d4e4309174c7e8bb20855c18038))

## [0.8.16](https://github.com/y0ngha/siglens/compare/v0.8.15...v0.8.16) (2026-04-20)


### Bug Fixes

* **#331:** address review round 2 blockers ([7414d0f](https://github.com/y0ngha/siglens/commit/7414d0fd0a653b9be7aa780821974adb33968221)), closes [#331](https://github.com/y0ngha/siglens/issues/331) [#7](https://github.com/y0ngha/siglens/issues/7)
* **#331:** address review round 3 blocker and suggestions ([303a38d](https://github.com/y0ngha/siglens/commit/303a38ddd60384d3ef8e7032c125f60557238959)), closes [#331](https://github.com/y0ngha/siglens/issues/331) [#5](https://github.com/y0ngha/siglens/issues/5)
* **#331:** move size-specific icons to public/ to avoid Next.js icon convention conflict ([de92280](https://github.com/y0ngha/siglens/commit/de922809085538246243658891bbfe4195ff999c)), closes [#331](https://github.com/y0ngha/siglens/issues/331)
* **#331:** preserve header logo transparency with unoptimized ([4825924](https://github.com/y0ngha/siglens/commit/4825924adcf547b7ecc3ec9241ebd207a226b311)), closes [#331](https://github.com/y0ngha/siglens/issues/331)
* **#331:** resolve header mobile overflow and lg indent misalignment ([536bfb2](https://github.com/y0ngha/siglens/commit/536bfb2f3bf0d76b680b6a6e3bd6aed1ee0f82f0))
* **#333:** apply PR review fixes — type import path, save-effect storageKey bug, expire NX, test coverage, as assertion ([f5bcef9](https://github.com/y0ngha/siglens/commit/f5bcef9d4407b5683fd477f09801fa58afc74424))
* address PR [#339](https://github.com/y0ngha/siglens/issues/339) review comments ([4689510](https://github.com/y0ngha/siglens/commit/4689510a72a3c4dd02cffea221a93ab48eb49ac0))
* address PR [#339](https://github.com/y0ngha/siglens/issues/339) review comments (round 3) ([fb945bd](https://github.com/y0ngha/siglens/commit/fb945bda42278bba70320eeba0aed82b36c0fc12))
* address PR [#339](https://github.com/y0ngha/siglens/issues/339) review comments (round 4) ([62cd300](https://github.com/y0ngha/siglens/commit/62cd300d868fc5d06ba6aefc824f3ecc7ffb4b4d))
* address PR [#339](https://github.com/y0ngha/siglens/issues/339) review comments (round 5) ([33aa32b](https://github.com/y0ngha/siglens/commit/33aa32bb71721aeffcad183189f4cb47754fcbb8))
* ai backtests thinking budget 수정 ([178dec2](https://github.com/y0ngha/siglens/commit/178dec2e5f79b4642126f1d9625893152f6598c8))
* AI 분석 시 인덱스 심볼 fmpSymbol 전달 누락 수정 ([2b0a861](https://github.com/y0ngha/siglens/commit/2b0a861dae9b5c090403a2c11f5bde000c58b2dc))
* **backtest:** FMP /stable returns flat array not {historical} ([47fc506](https://github.com/y0ngha/siglens/commit/47fc506b2844daf34f461beb8020631576df4983))
* **backtest:** retry on Gemini 503 with exponential backoff ([83be2b4](https://github.com/y0ngha/siglens/commit/83be2b40a9fa929301a105dcc31814801de87994))
* **backtest:** switch to paid Gemini API (GEMINI_CHAT_API_KEY) ([6d5cd92](https://github.com/y0ngha/siglens/commit/6d5cd92d2b0796f4e17e5c5a5cd4c7615ccb6eb9))
* **backtest:** truncate AI summary at sentence boundary (250 chars) ([6a44c51](https://github.com/y0ngha/siglens/commit/6a44c51da2a9220842bef430d868e680ee7fee3b))
* barsApi 날짜 형식을 RFC3339으로 표준화 ([96a3cb2](https://github.com/y0ngha/siglens/commit/96a3cb236f4c67c1c6e0706521ab61ce3229a234))
* cap stored chat messages at 40; fix vaul aria-hidden hydration mismatch ([28ee730](https://github.com/y0ngha/siglens/commit/28ee730625f89e42e1caf6c0e8190622292e3747))
* **chat:** export token constants, remove console.error, deduplicate test setup ([bab5515](https://github.com/y0ngha/siglens/commit/bab5515b274555698b1dc1d3c6d7b64f2af3a14e))
* **chat:** move ChatPromptPayload to domain/types, fix test placement, add branch coverage ([1baa314](https://github.com/y0ngha/siglens/commit/1baa314f9151019ab31c7afcdd2afd63fedfb46a))
* **chat:** remove dead mock, add response.text null branch test ([ae15769](https://github.com/y0ngha/siglens/commit/ae15769e78e00ef96dad01dab58f0c45a7fb05f8))
* **chat:** remove unused LOADING_MESSAGES constant from useChat ([5861649](https://github.com/y0ngha/siglens/commit/586164998688a9489b851935b7dceb381cf77e6f))
* **chat:** reorder key check, extract fallback helper, add 429 fallback test ([1a45cda](https://github.com/y0ngha/siglens/commit/1a45cdaf745b6ed931721054e4c8692270d7d72a))
* drawerEl 스타일 리셋으로 인한 바텀시트 숨김 버그 수정 ([d7789c3](https://github.com/y0ngha/siglens/commit/d7789c3978f998421b3194b53800239266ba1698))
* lint & hydration error 수정 ([b31974c](https://github.com/y0ngha/siglens/commit/b31974c409f60e87ea7f06c61ea73e252726d9ea))
* PR [#326](https://github.com/y0ngha/siglens/issues/326) 리뷰 코멘트 반영 — translateAndCache fmpSymbol 누락 수정 및 코드 개선 ([c316872](https://github.com/y0ngha/siglens/commit/c316872d2dc7f59e3089053889591cc8724e04ad))
* PR [#326](https://github.com/y0ngha/siglens/issues/326) 리뷰 코멘트 반영 — useTimeframeChange hook 선언 순서 수정 ([4704a82](https://github.com/y0ngha/siglens/commit/4704a82299a85203b0384803d590e013ec0fdf19))
* restore CHAT_MODEL_DISPLAY_NAME constant value in ChatPanel ([aacd7d2](https://github.com/y0ngha/siglens/commit/aacd7d2b60fc12e2800b900b1a8476b4bc7fa2ed))
* review comments round 3 — eslint-disable removal, type assertions, and test coverage ([f9cae2b](https://github.com/y0ngha/siglens/commit/f9cae2b92be9e60f2ac5f856a1c1799f4ded0ec2))
* **signals:** reuse buildBarsWithCloses helper and add phase assertion ([e24d348](https://github.com/y0ngha/siglens/commit/e24d348dd9e748a2bed13ec6195f59196621c7e9))
* smc 스킬 잘못된 구조로 반환되던 문제 수정 ([02513d5](https://github.com/y0ngha/siglens/commit/02513d5269dab96d1c5c24e39c66d6adeecdf1dd))
* symbol 페이지 이탈 시 스크롤 복원 및 가격 달러 표시 추가 ([642224b](https://github.com/y0ngha/siglens/commit/642224bc3f0c70950b3df926e118213f1ecd69a6))
* update popular tickers scripts toSorted > sort ([9bee4a3](https://github.com/y0ngha/siglens/commit/9bee4a30ce3bddef689ecc4fed141ec13f31f774))
* update SignalBadge labels and validate schema for multi-signal backtest ([ccbe6b7](https://github.com/y0ngha/siglens/commit/ccbe6b78a08e0dc90f9b9e19aa6c10140cb55b26))
* 마켓 요약 패널 리뷰 피드백 반영 ([0868f7c](https://github.com/y0ngha/siglens/commit/0868f7c3e711c706f2b45b9b0cd5d92f48182924))
* 모바일 분석 sheet 높이 유지로 숨김 버그 해결 ([c53d30e](https://github.com/y0ngha/siglens/commit/c53d30eb6a135bca2242e54e815dad7e3cd7852d))
* 시장 브리핑 성능 최적화 및 타입 안정성 개선 ([353f3f3](https://github.com/y0ngha/siglens/commit/353f3f31ca50a6e97587c5afdca065fcc7087f9e))
* 차트 컨테이너 제거 시 autoSize ResizeObserver RAF 에러 수정 ([d456770](https://github.com/y0ngha/siglens/commit/d4567709f11fe4119fbfad266f59fc6e21f8fde4))
* 캐시된 마켓 브리핑 데이터 정규화 처리 ([2a7497f](https://github.com/y0ngha/siglens/commit/2a7497fd081a3016a6f3dc4f8dd15ab132263dbe))


### Features

* /backtesting 페이지 — AI 기술적 분석 백테스팅 결과 공개 ([b3b254f](https://github.com/y0ngha/siglens/commit/b3b254fb0c46b5e8b153cb11fe4138224498431f))
* **#329:** add /market OG image ([cf760be](https://github.com/y0ngha/siglens/commit/cf760be333a7c85bc9a7feea7a011b17b2aaf68b)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add /market RSC page with HydrationBoundary ([ac2ea55](https://github.com/y0ngha/siglens/commit/ac2ea55c77a3b4fb76e61ee747c19a95efa1613b)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add /market to sitemap and home link ([f0fcb61](https://github.com/y0ngha/siglens/commit/f0fcb61bfe21d374b349b879a7d64aa3ff0dd012)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add anticipation signal helpers (pivot/%B/slope/percentile) ([fce3838](https://github.com/y0ngha/siglens/commit/fce3838a9fd1a2b434149e3ea2b39d81cf2efa15)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add Bollinger bounce/breakout signal detectors ([83f4149](https://github.com/y0ngha/siglens/commit/83f414969d2aae7131612d8aa1cd2dde81965f81)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add Bollinger squeeze detectors (3-condition AND) ([879a7a1](https://github.com/y0ngha/siglens/commit/879a7a1cdb8ad1f4acd726284fea00cd7d65e339)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add classifyTrend for signal trend gate ([b9531b4](https://github.com/y0ngha/siglens/commit/b9531b4b02dd889b78cb9d6e8b9c335c2375152e)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add detectSignals aggregator and skip type re-export ([1e65937](https://github.com/y0ngha/siglens/commit/1e659374261b4464ee480ea309b07f4c6a201b2c)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add global header with search and navigation ([805b916](https://github.com/y0ngha/siglens/commit/805b91625fd50b9ddd70cc98141c9b63400619b2)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add Golden/Death cross signal detectors ([963692d](https://github.com/y0ngha/siglens/commit/963692d9134ca935d33cad6947239357d1c08c4a)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add MACD cross signal detectors ([d0cf622](https://github.com/y0ngha/siglens/commit/d0cf62220813f1c4a0c02bb9b2ca17bb0cafadf1)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add MACD histogram convergence detectors ([c9bc2d3](https://github.com/y0ngha/siglens/commit/c9bc2d389e65bea25f3ee3d81cf1141a2f24d78a)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add reduced-motion utility and sector-panel-bg ([54de6a6](https://github.com/y0ngha/siglens/commit/54de6a6ee0f2b888047a41c7a23001b665508d87)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add RSI over/oversold signal detectors ([bccaf54](https://github.com/y0ngha/siglens/commit/bccaf54ebdb24722f1add36c5ee241866a25fb66)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add RSI regular divergence detectors ([7ef26d5](https://github.com/y0ngha/siglens/commit/7ef26d54e3b9139b9111df8129065fe9612e1b43)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SECTOR_STOCKS constant (68 stocks, 11 sectors) ([107c500](https://github.com/y0ngha/siglens/commit/107c500557b9c7b87357e49cb2a1fa5042e7b288)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SectorSignalPanel main client logic ([5e0d292](https://github.com/y0ngha/siglens/commit/5e0d292b4b41b050c3568c2fe11720c2ec3f6ebd)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SectorSignalPanelContainer RSC ([baea5db](https://github.com/y0ngha/siglens/commit/baea5db1446982c0122042bde43f6df3d189e7ca)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SectorSignalPanelSkeleton ([8950215](https://github.com/y0ngha/siglens/commit/8950215444c29874091f355058ae72d0e619585e)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add sectorSignalsApi infrastructure layer ([696b658](https://github.com/y0ngha/siglens/commit/696b6584081ec1bfdac6d4f1d13e5721b69abb3f)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SectorTabs component ([484c41e](https://github.com/y0ngha/siglens/commit/484c41eb11610c90f640ae10fa4530f5026f9306)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add signal detection constants ([1073d12](https://github.com/y0ngha/siglens/commit/1073d123a257ed4a150dcdbed11b02dece834af9)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add signal domain types ([b95a7e5](https://github.com/y0ngha/siglens/commit/b95a7e5a745ed1bdea8467cfc87f6308613fcfbd)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SignalBadge component ([e651317](https://github.com/y0ngha/siglens/commit/e65131726a9f6113548531ff04e46e8bd89dbf3e)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SignalStockCard component ([a6b4aea](https://github.com/y0ngha/siglens/commit/a6b4aea96f38d337e53caf5a8fe1a84c203f0d48)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SignalSubsection component ([4169d1a](https://github.com/y0ngha/siglens/commit/4169d1a4e7b0f8b9ac24b13b3509f3552ea57c6b)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add SignalTypeGuide for SEO thin-content ([c31dce2](https://github.com/y0ngha/siglens/commit/c31dce2543bd9d35b67b13935089d85a27bf73ab)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add StrictModeToggle component ([4ec21ca](https://github.com/y0ngha/siglens/commit/4ec21ca70c8518a8ef38b1b6948e27131136c87d)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add support/resistance proximity detectors ([cc3bf23](https://github.com/y0ngha/siglens/commit/cc3bf23cf2ec425ed47c1825d87039b97eeb6f96)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#329:** add timeframes, quantum sector, and review fixes ([b345aa8](https://github.com/y0ngha/siglens/commit/b345aa872537d7a1947b0a30d0cf978e61f61081)), closes [#329](https://github.com/y0ngha/siglens/issues/329) [#331](https://github.com/y0ngha/siglens/issues/331)
* **#329:** add useStrictModeToggle hook ([f6702ce](https://github.com/y0ngha/siglens/commit/f6702cec2d639740eb219557c4714693b44264b9)), closes [#329](https://github.com/y0ngha/siglens/issues/329)
* **#332:** add ChatPanel component ([cbeeb98](https://github.com/y0ngha/siglens/commit/cbeeb982271293956c600db42f90f31cd40809dd)), closes [#332](https://github.com/y0ngha/siglens/issues/332)
* **#332:** fix ChatPanel hook order, inline styles, inputRef ([b1a5a5c](https://github.com/y0ngha/siglens/commit/b1a5a5c59608106cc61f9565e8b5e74457ad35c5))
* **#332:** implement useChat hook with chatStorage utils ([717d525](https://github.com/y0ngha/siglens/commit/717d5255069b0107a0018fd5b5b1fbf8835112c2)), closes [#332](https://github.com/y0ngha/siglens/issues/332)
* **#332:** integrate ChatPanel desktop/mobile and update privacy policy ([03aaf8a](https://github.com/y0ngha/siglens/commit/03aaf8a0ad87755731768c5f9a86f26df69b10bc)), closes [#332](https://github.com/y0ngha/siglens/issues/332)
* **#332:** replace inline chat panel with floating chatbot widget on desktop ([e8e8e9e](https://github.com/y0ngha/siglens/commit/e8e8e9e21d6ae4aa3f2cebcae38e6ed4128c04d8)), closes [#332](https://github.com/y0ngha/siglens/issues/332)
* **#332:** show analysis-updated banner only when analysis is newer than last chat; show remaining tokens on mount ([180aeae](https://github.com/y0ngha/siglens/commit/180aeae4e9188451fe2358c2188482f7d4b4e024)), closes [#332](https://github.com/y0ngha/siglens/issues/332)
* **#332:** show remaining daily question count in chat input label ([74de4c8](https://github.com/y0ngha/siglens/commit/74de4c868b0f86c4178f57485cca685584f0965f)), closes [#332](https://github.com/y0ngha/siglens/issues/332)
* add /backtesting page with components and SEO metadata ([8d4a55a](https://github.com/y0ngha/siglens/commit/8d4a55a2d428a307af0c850d16d6b6923201a2a7))
* add /backtesting to sitemap with priority 0.9 ([da28603](https://github.com/y0ngha/siglens/commit/da2860308b023fccd8a3a419558cb581595d2e46))
* add BacktestCase, BacktestData types to domain/types ([47a0e24](https://github.com/y0ngha/siglens/commit/47a0e2416778607bde5e854e829b1c303dc62fee))
* add BacktestCaseCard component ([e6cc1bf](https://github.com/y0ngha/siglens/commit/e6cc1bf9cf360efaea87252986ab066b37d5292b))
* add BacktestCaseList component with monthly grouping ([2425ad6](https://github.com/y0ngha/siglens/commit/2425ad624d89ac528df13f6ab9f94fbe0a15e938))
* add BacktestHero component ([a891693](https://github.com/y0ngha/siglens/commit/a8916932ee1371128f44ad5c6b246108bd8d3eaf))
* add backtesting CTA banner to homepage ([a0d9a1f](https://github.com/y0ngha/siglens/commit/a0d9a1f98454e6b9d6651ec9160f061ba52f2c06))
* add backtesting SEO constants ([535406a](https://github.com/y0ngha/siglens/commit/535406ad632b5c0e2e91b7973f6644fa234e7b04))
* add BacktestTabs client component with a11y and URL state ([b7a24fb](https://github.com/y0ngha/siglens/commit/b7a24fba0a10b422cd4eb76b25e924c86a4366a9))
* add callGeminiScript with MAX_TOKENS handling and generate-backtest script ([c4c5fbb](https://github.com/y0ngha/siglens/commit/c4c5fbb7cbd497e182516d0d723121fa95d666c8))
* add markdown rendering for AI chat assistant messages ([3c85308](https://github.com/y0ngha/siglens/commit/3c853088ea39189632633d51b1455d467aaaba01))
* add validateBacktestData with tests ([4c78d94](https://github.com/y0ngha/siglens/commit/4c78d942b287d5fa66a71cb80f42255a0da0ae26))
* AI 대화·시장 현황 기능 반영 SEO 최적화 ([de9fe16](https://github.com/y0ngha/siglens/commit/de9fe16981b3f8da48a4f09022d4e3b58b5c0cd1))
* AI 브리핑 생성 시각 표시 추가 ([3608f66](https://github.com/y0ngha/siglens/commit/3608f66354e98f205f690561a9f8cdf6bc12b148))
* AssetInfo.fmpSymbol로 지수 심볼 bars 조회 구현 ([9f264f8](https://github.com/y0ngha/siglens/commit/9f264f8e6b0c4a161e91ce6d53ee2fa78fd786e4))
* **backtest:** add disclaimer "실제 데이터 기반 회귀 테스트" ([5f694b3](https://github.com/y0ngha/siglens/commit/5f694b31e7ff9608dafbf98143ded7ca571e7be9))
* **backtest:** add signalTypeToTagLabel with bullish-only map ([d14e9bf](https://github.com/y0ngha/siglens/commit/d14e9bfb9feb674102c861160602cac0f1f8a7b4))
* **backtest:** add simulateExit pure function with SL/TP/time ([32749a3](https://github.com/y0ngha/siglens/commit/32749a3ec5e01059a758c2717a9277854fa2579e))
* **backtest:** extend BacktestAiAnalysis with AI price predictions for UI trust viz ([2c3988d](https://github.com/y0ngha/siglens/commit/2c3988d93a7709eb1785c60d64eed320f0389788))
* **backtest:** extend period to 2 years (2024.04 – 2026.04) ([5b5d58a](https://github.com/y0ngha/siglens/commit/5b5d58a3e852656150e7e5da7882f626fdae25bd))
* **backtest:** replace CRWD with LLY (partial re-run to preserve other tickers) ([0dcbd10](https://github.com/y0ngha/siglens/commit/0dcbd10d334137cc5f5faa8bab1b4e359c1ffb07))
* **backtest:** replace MSFT with WMT (partial re-run) ([643295c](https://github.com/y0ngha/siglens/commit/643295c5239714d0490040d71a40a79ed2a4ef6d))
* **backtest:** replace MSTR with AVGO (more stable market leader) ([0cf5121](https://github.com/y0ngha/siglens/commit/0cf5121e235dd2c412a07c79512f9fe431e15c29))
* **backtest:** reword hero copy to emphasize trust (same AI, real data) ([df0320b](https://github.com/y0ngha/siglens/commit/df0320b3d609c552e03d745e29fe80f842d0207d))
* **backtest:** rewrite generate-backtest with multi-signal confluence + AI SL/TP exit sim ([50a864f](https://github.com/y0ngha/siglens/commit/50a864f31e0b244e8d752c071c40ce18d645fc8e))
* **backtest:** tighten entry filters and boost AI decisiveness (Option D) ([03b80f2](https://github.com/y0ngha/siglens/commit/03b80f2905c8db9e9466ee2ab9dacfa764d90353))
* **backtest:** visualize AI price predictions in BacktestCaseCard ([8c9c0f5](https://github.com/y0ngha/siglens/commit/8c9c0f5d1e577cec52abea2bf62f5c896573ce5d))
* **chat:** add buildChatPrompt pure function with tests ([0f7b0eb](https://github.com/y0ngha/siglens/commit/0f7b0eb4ec9930321cc657f6e25f73203371b83a))
* **chat:** add chatAction Server Action with free/유료 키 fallback ([06a48ef](https://github.com/y0ngha/siglens/commit/06a48ef46480beb19ff17c6c959cbcd9b47f6a08))
* **chat:** add chatAction Server Action with free/유료 키 fallback ([5f03dd1](https://github.com/y0ngha/siglens/commit/5f03dd1a74f82f1bd5e28ecf3c5c8e5c339002ad))
* **chat:** add domain types for AI chat feature ([7d0151d](https://github.com/y0ngha/siglens/commit/7d0151d73ef17b4e35bd3062312e638dde0852b5))
* **chat:** add Redis token store with IP hashing ([5629eee](https://github.com/y0ngha/siglens/commit/5629eeef33ee85f0fee1897882907b2f4b98fa16))
* **chat:** add useChat hook with localStorage persistence and loading phases ([69401cb](https://github.com/y0ngha/siglens/commit/69401cb7b3ae7d9dd1026c27a70a6f75847a1734))
* extend BacktestCase with aiResult=neutral and exit reason enum ([f9b9899](https://github.com/y0ngha/siglens/commit/f9b9899d1cfccce66b8e638ae62cfb2a02ab55b2))
* image icon 해상도 upscaling ([fbddc80](https://github.com/y0ngha/siglens/commit/fbddc80d3dc770a758217d682468d989ec2faf26))
* market opengraph-image.tsx 삭제 후 실제 이미지 삽입 ([7b03434](https://github.com/y0ngha/siglens/commit/7b03434fd008148906042a0d573ba6530cffbe53))
* opengraph-image.tsx 삭제 후 실제 이미지 삽입 ([f604daa](https://github.com/y0ngha/siglens/commit/f604daab1ce32cd9ba748b17ac038e68337ba2e8))
* privacy opengraph 이미지 삽입 ([e9e9bd7](https://github.com/y0ngha/siglens/commit/e9e9bd7763b6973138c66ed9ef7762691223612e))
* **signals:** add detectCciBullishCross detector ([1da2fef](https://github.com/y0ngha/siglens/commit/1da2fef0e848d1e79187afcbf3df487c22a64f34))
* **signals:** add detectCmfBullishFlip detector ([2e015d0](https://github.com/y0ngha/siglens/commit/2e015d0cac69a84b741fc496eb8c995ae39b705e))
* **signals:** add detectDmiBullishCross detector ([c07ccc0](https://github.com/y0ngha/siglens/commit/c07ccc08b6d3e0aee41c64e592da973631afa7f5))
* **signals:** add detectIchimokuCloudBreakout detector ([3072e0b](https://github.com/y0ngha/siglens/commit/3072e0b9f3f0d62f5914b8eedb0ee96575b74d84))
* **signals:** add detectKeltnerUpperBreakout detector ([18d1c38](https://github.com/y0ngha/siglens/commit/18d1c381b2fc8e75ab2f81d79bdf10ee6a7e0a73))
* **signals:** add detectMfiOversoldBounce detector ([892dda9](https://github.com/y0ngha/siglens/commit/892dda91aebadfc3dc0b104764325bd4ef662a33))
* **signals:** add detectParabolicSarFlip detector ([15aa3fa](https://github.com/y0ngha/siglens/commit/15aa3fafafda466470a6888954f19eeb15078b34))
* **signals:** add detectSqueezeMomentumBullish detector ([9927544](https://github.com/y0ngha/siglens/commit/99275441460f8bcb154a800812803a78ac0ee1c3))
* **signals:** add detectSupertrendBullishFlip detector ([fb68168](https://github.com/y0ngha/siglens/commit/fb68168d9069961e68087441509ca033eb38f359))
* **signals:** add thresholds for new bullish detectors ([dc9ade3](https://github.com/y0ngha/siglens/commit/dc9ade36b1622314e6c8b7d82a7ab1bcf7f336f7))
* **signals:** register 9 new bullish detectors in DETECTORS ([d63c567](https://github.com/y0ngha/siglens/commit/d63c567df59b159d544756bd9fd2c35556ca0a79))
* terms opengraph 이미지 삽입 ([f7af773](https://github.com/y0ngha/siglens/commit/f7af773a333eb36c608d3a6a24ff43006486ab2c))
* 메인 페이지에 시장 현황 패널 추가 ([#328](https://github.com/y0ngha/siglens/issues/328)) ([33daa06](https://github.com/y0ngha/siglens/commit/33daa0648412b3c8a0611d149fc9312a595cb8e4))
* 메인화면 H1·SEO 메타 서비스 확장 범위 반영하여 수정 ([#336](https://github.com/y0ngha/siglens/issues/336)) ([fa52aa1](https://github.com/y0ngha/siglens/commit/fa52aa1239e3ec7ad0185d269506c52cf41f2e66))
* 메인화면 SubTitle 서비스 확장 범위 반영하여 수정 ([#334](https://github.com/y0ngha/siglens/issues/334)) ([1599364](https://github.com/y0ngha/siglens/commit/1599364df5873af0fcf4c509959137a94bc9f5a4))
* 봉 > 타임프레임으로 변경 ([9453e3a](https://github.com/y0ngha/siglens/commit/9453e3ae14f384e361040251cd561d7ffe8164b0))
* 상단 네비게이션 '시장 개요' > '시장 분석' 으로 변경 ([0854cab](https://github.com/y0ngha/siglens/commit/0854cab64841ffe8730536893c78ec9885316e33))
* 상단 네비게이션 '시장' > '시장 개요'로 명칭 변경 ([3026bfe](https://github.com/y0ngha/siglens/commit/3026bfedbb809a450bb218dde1ed33b97144b71d))
* 시장 브리핑 JSON 정규화 및 구조화 UI 표시 ([d90d9d5](https://github.com/y0ngha/siglens/commit/d90d9d57675088f80b2d77d5bf567305467de675))
* 시장 브리핑 데이터 정규화 및 AI 인프라 리팩토링 ([bb915d7](https://github.com/y0ngha/siglens/commit/bb915d77141c24e17887791530da155ea6fc7cf6))
* 차트 안내 메시지 추가 ([6a90daa](https://github.com/y0ngha/siglens/commit/6a90daaacb2b6cba238441d8ae5ac345d305c656))
* 플로팅 버튼에 툴팁 추가 ([02fa842](https://github.com/y0ngha/siglens/commit/02fa8420c7040bc19dab6166c6ecee3042cd2c4a))


### Reverts

* restore accidentally deleted opengraph-image.tsx files ([471f33d](https://github.com/y0ngha/siglens/commit/471f33dba3e5deb778063d65e7b93d41c15a47c6))

## [0.8.15](https://github.com/y0ngha/siglens/compare/v0.8.14...v0.8.15) (2026-04-17)


### Bug Fixes

* SSR hydration mismatch - MobileAnalysisSheet 렌더링 타이밍 수정 ([23da1ec](https://github.com/y0ngha/siglens/commit/23da1ecd3ea831b2390aaa9039e7c378989c5a78))
* 모바일 Bottom Sheet 컴포넌트 사라지는 문제 해결 ([7c358bf](https://github.com/y0ngha/siglens/commit/7c358bf179bd8c577a44310cc93e3d93325de961))
* 모바일 바텀시트 사라짐 문제 근본 해결 ([338c898](https://github.com/y0ngha/siglens/commit/338c898bfed5014c6c2136edbc8463d8f6f5698a))

## [0.8.14](https://github.com/y0ngha/siglens/compare/v0.8.13...v0.8.14) (2026-04-16)


### Bug Fixes

* 메인화면 스크롤 안되던 문제 해결 ([6c5e66c](https://github.com/y0ngha/siglens/commit/6c5e66c925ef6cdba34290b358bc9198cf8d8a55))

## [0.8.13](https://github.com/y0ngha/siglens/compare/v0.8.12...v0.8.13) (2026-04-16)


### Bug Fixes

* AdBanner 최적화 - 불필요한 상태 제거 ([7d98268](https://github.com/y0ngha/siglens/commit/7d982688e2d011b2bcb4807d6afa13af37ee1376))
* body height 제약으로 AdSense 광고 요소의 문서 스크롤 방지 ([4b1177c](https://github.com/y0ngha/siglens/commit/4b1177c23a5dfcbd6b722be443062f1173b0fa97))
* **design:** adsense scripts가 css를 파괴하지 못하도록 설정 ([5505cd4](https://github.com/y0ngha/siglens/commit/5505cd495408015e95deb771bdeac39742d39bd2))
* PriceScenario 필드의 null 처리 추가 ([9961e6d](https://github.com/y0ngha/siglens/commit/9961e6d7321c9229e5018c8315550bc727be4701))
* **refactor:** layout이 다 그려진 후 adsbygoogle을 넣도록 처리 ([33f6ce1](https://github.com/y0ngha/siglens/commit/33f6ce1c56ba622ec32e7653484fbf37a346483a))
* 메인 페이지 스크롤 복원 ([2887629](https://github.com/y0ngha/siglens/commit/2887629b18628aae22ee6dd4e64242371c9c327c))
* 애드센스 배너 광고 버그 수정 ([34d5b18](https://github.com/y0ngha/siglens/commit/34d5b18d6b14e4082cb4299c0a5f276f587080e9))
* 애드센스 배너 성능 및 배치 최적화 ([75073f5](https://github.com/y0ngha/siglens/commit/75073f51f302fddb64a51b7c14e8be2838bd5847))


### Features

* adsense scripts 추가 ([a4189a8](https://github.com/y0ngha/siglens/commit/a4189a8c5a0a5788c3e6bad9bc8c2fdd51d64e3b))
* Google AdSense 배너 광고 구현 ([357da01](https://github.com/y0ngha/siglens/commit/357da016f2aec35700c48055939dd783fee4c6dd))

## [0.8.12](https://github.com/y0ngha/siglens/compare/v0.8.11...v0.8.12) (2026-04-14)


### Bug Fixes

* PR [#313](https://github.com/y0ngha/siglens/issues/313) 리뷰 코멘트 반영 (fetch 타임아웃, 카운트다운 단순화, 함수형 스타일) ([e49aca2](https://github.com/y0ngha/siglens/commit/e49aca209cf9ba34005d730c0de64c2ea4fd8293))


### Features

* AbortController로 AI 호출 중간 취소 지원 (단일 인스턴스) ([b64f414](https://github.com/y0ngha/siglens/commit/b64f414d947f904815023a678422bb33dfc76669))
* 타임프레임 변경 시 진행 중인 분석 작업 취소 ([6cc2ab4](https://github.com/y0ngha/siglens/commit/6cc2ab4365c331454e3df1bc4fd349f77d6eed46))

## [0.8.11](https://github.com/y0ngha/siglens/compare/v0.8.10...v0.8.11) (2026-04-14)


### Bug Fixes

* FMP daily bar 날짜 오류 및 당일 실시간 quote 추가 ([687548a](https://github.com/y0ngha/siglens/commit/687548afa3fc6b2c9773af7bca3b7c436536a4ab))
* FMP intraday 타임스탬프 ET→UTC 변환 (DST 자동 처리) ([6df3032](https://github.com/y0ngha/siglens/commit/6df3032c6352e32d00fa99d3f1b5dcbffb4a19cf))
* **lint:** style lint 오류 수정 ([4929a91](https://github.com/y0ngha/siglens/commit/4929a91fbaec1b56e095b703e3f5c53c26d4b73f))
* PR [#308](https://github.com/y0ngha/siglens/issues/308) 리뷰 코멘트 반영 (상수 추출, 패턴 통일, 주석 보강) ([3184ebf](https://github.com/y0ngha/siglens/commit/3184ebf96c38e01f792f470efdadb8a7ac1e7b31))
* PR [#309](https://github.com/y0ngha/siglens/issues/309) 리뷰 코멘트 반영 (테스트 1Min→5Min 통일, 타임프레임 포맷 개선) ([d9048bb](https://github.com/y0ngha/siglens/commit/d9048bb5eec709a7f3e8adbee1e44ec0c8d95fe8))
* 리포트 생성시 } 생기는 문제 해결 ([c57fe08](https://github.com/y0ngha/siglens/commit/c57fe08be0c22a25e36efa05a69a04bb08ee419d))


### Features

* max_token 오류 걸리면 점차 줄여나가며 시도 ([7714b7a](https://github.com/y0ngha/siglens/commit/7714b7a5bcde4a2956e7701739e1b58af5bc545a))
* 차트 영역에 15분 데이터 지연 안내 문구 추가 ([ea7fbef](https://github.com/y0ngha/siglens/commit/ea7fbef4d3e2086882bb93bbd7d8bd76c33fbdbf))
* 타임프레임 확장 (5분, 15분, 30분, 1시간, 4시간, 일봉) ([9ef4bc6](https://github.com/y0ngha/siglens/commit/9ef4bc6e396f2e23fe6683a10dac406d77819e3a))

## [0.8.10](https://github.com/y0ngha/siglens/compare/v0.8.9...v0.8.10) (2026-04-14)


### Bug Fixes

* gemini thinkingBudget 문제 해결 ([a3e2880](https://github.com/y0ngha/siglens/commit/a3e2880c05132b037c18c8369cf8df34e7c4a447))
* 심볼 페이지에서 assetInfo 못불러왔을 때 notfound() 메타데이터 리턴되던 문제 해결 ([7062ebb](https://github.com/y0ngha/siglens/commit/7062ebb07adf909665fbbe48e23926b69d019a23))


### Features

* 리포트 복사시 정확한 정보를 그대로 복사할 수 있도록 처리 ([edcff44](https://github.com/y0ngha/siglens/commit/edcff4469492776a47bda63d3c9c1a494be495a2))

## [0.8.9](https://github.com/y0ngha/siglens/compare/v0.8.8...v0.8.9) (2026-04-14)


### Bug Fixes

* 재분석시 step 6부터 진행하던 버그 수정 및 버그 개선을 위한 로그 추가 ([2f1a225](https://github.com/y0ngha/siglens/commit/2f1a22518faca2cbaf3686665e327e5fa4a54688))

## [0.8.8](https://github.com/y0ngha/siglens/compare/v0.8.7...v0.8.8) (2026-04-14)


### Features

* 리포트 복사 기능 추가 ([7fbe576](https://github.com/y0ngha/siglens/commit/7fbe5765675fe6912b06735b30324b6629c0425e))
* 리포트 복사기능에 출처 명시 ([6e2ddba](https://github.com/y0ngha/siglens/commit/6e2ddba79eeda2ae40557a678170cbff2426107d))

## [0.8.7](https://github.com/y0ngha/siglens/compare/v0.8.6...v0.8.7) (2026-04-14)


### Bug Fixes

* keyLevels 방어로직 추가 및 prompt 개선 ([3287d18](https://github.com/y0ngha/siglens/commit/3287d184a72260bf3f31090c6abfd49ea00e0ce6))
* MobileAnalysisSheet null guard ordering and DOM cleanup ([aca561a](https://github.com/y0ngha/siglens/commit/aca561a8dc4099d5fbdc51ff43776ba08fc3aa7c))
* **mobile:** 바텀시트 핸들 사라짐 버그 수정 및 네이티브 스와이프 UX 개선 ([4ef3bd8](https://github.com/y0ngha/siglens/commit/4ef3bd8291b5104caa952cdeab0e0b691fc43712)), closes [#299](https://github.com/y0ngha/siglens/issues/299)
* Signal 강도 누락 시 보조지표 UI 정렬 깨짐 ([fe1fd50](https://github.com/y0ngha/siglens/commit/fe1fd50b615f445ed2910878fe55543d0565f226))
* Signal.strength 선택사항화 및 유효성 검증 개선 ([e2bd70b](https://github.com/y0ngha/siglens/commit/e2bd70b0a8d9c22cb38ce8b8c5b767633ca4c6d5))
* SignalItem 배지 영역 고정 너비 적용으로 정렬 통일 ([065543c](https://github.com/y0ngha/siglens/commit/065543c98a4cd2b7e686ecdf081c1dd99a281801))
* Trend 데이터 누락 시 보조지표 화면 깨짐 ([3653907](https://github.com/y0ngha/siglens/commit/3653907492e742bb936c968133b6f4a8dc697835))
* Trend 디스플레이 데이터 단일 객체로 통합 ([72452f3](https://github.com/y0ngha/siglens/commit/72452f35e19dc60e95a41345ea49af3ce85ba713)), closes [#1](https://github.com/y0ngha/siglens/issues/1)
* 매매전략 단계별 문서 일관성 및 AI 프롬프트 수정 ([31cf01a](https://github.com/y0ngha/siglens/commit/31cf01a428ec9abcd84878bd0bad375fb2ae2c6e))
* 캐시 만료 시간 재계산 및 테스트 안정화 ([d68a60f](https://github.com/y0ngha/siglens/commit/d68a60f9643f29cbdfa3e72504349e70955b36ff))


### Features

* 매매 전략에서 롱(매수) 포지션만 표시 ([c9083e6](https://github.com/y0ngha/siglens/commit/c9083e6fa47560a554736a4c1e11afacdb0b035b))
* 캐시 만료 시간(KST 17:00) 기반 자동 초기화 ([6f71531](https://github.com/y0ngha/siglens/commit/6f7153169d975318b7e85bee69014593ca50b9ad))

## [0.8.6](https://github.com/y0ngha/siglens/compare/v0.8.5...v0.8.6) (2026-04-13)


### Features

* 비용 최적화를 위해 gemini를 사용할 때 무료버전 > 유료버전 순으로 사용하도록 처리 ([a84f04b](https://github.com/y0ngha/siglens/commit/a84f04ba4a0c788ec38a7b3dda8d788488797ac3))

## [0.8.5](https://github.com/y0ngha/siglens/compare/v0.8.4...v0.8.5) (2026-04-13)


### Features

* 지수백오프 적용 및 gemini ai 모델 fallback model 추가 ([795858d](https://github.com/y0ngha/siglens/commit/795858d57e7215116a66398ea4eef275dde8ba60))

## [0.8.4](https://github.com/y0ngha/siglens/compare/v0.8.3...v0.8.4) (2026-04-13)


### Bug Fixes

* 매직넘버 100을 PRICE_DECIMAL_FACTOR 상수로 추출 및 배열 접근 시 non-null assertion 추가 ([1c18416](https://github.com/y0ngha/siglens/commit/1c184160aa712076da35057a2259e043b9d3af81))
* 서포트 레벨 내림차순 정렬 (현재가 가까운 순서대로 표시) ([00618b1](https://github.com/y0ngha/siglens/commit/00618b15a703bd9d3be94835fe93d96131dfbb28))
* 툴팁 위치 계산 및 접근성 개선 (viewport 경계 체크, aria-describedby 추가, 초기 깜빡임 제거, React key에 index 추가) ([4c7fde9](https://github.com/y0ngha/siglens/commit/4c7fde9bb4bddbec97c2550da014293cea5f9e8c))


### Features

* 서포트/레지스턴스 키레벨 밀집도 기반 클러스터링 ([eb17ee7](https://github.com/y0ngha/siglens/commit/eb17ee77162bb373d95629d33b26152f3b2eaad6))
* 프로그레스 돌아갈 때 분석버튼 못누르도록 수정 ([a01d10c](https://github.com/y0ngha/siglens/commit/a01d10c050bf954fb2bae134baa541fab75b71d6))

## [0.8.3](https://github.com/y0ngha/siglens/compare/v0.8.2...v0.8.3) (2026-04-13)


### Features

* 모바일 사용성 개선 ([9ff8af4](https://github.com/y0ngha/siglens/commit/9ff8af4744e06968bf75a52982367814160d5e5e))

## [0.8.2](https://github.com/y0ngha/siglens/compare/v0.8.1...v0.8.2) (2026-04-12)

## [0.8.1](https://github.com/y0ngha/siglens/compare/v0.8.0...v0.8.1) (2026-04-12)


### Bug Fixes

* AnalysisProgress 상태를 ChartContent로 lift-up하여 모바일 remount 초기화 수정 ([a4d5a36](https://github.com/y0ngha/siglens/commit/a4d5a360f8fb1d8b99f5de91767a8bd7376b9468))
* Upstash 직렬화 문제 해결 및 쿨다운 로직 수정 ([3ab7336](https://github.com/y0ngha/siglens/commit/3ab7336826f095266624bc3049449a6fa06ebe86))


### Features

* Add trend direction badge to indicator signals and clarify strength labels ([0d4ae9b](https://github.com/y0ngha/siglens/commit/0d4ae9be97de212c80ad9601ec60d9fc6505b7c7))
* AI API 재시도 로직 및 에러 처리 개선 ([06b76f1](https://github.com/y0ngha/siglens/commit/06b76f12374dcc421596832955ab74629a88dfc1))
* Cloud Run worker 배포환경 조성 ([534c8f3](https://github.com/y0ngha/siglens/commit/534c8f36e4af210b558a10a21ca12979252dcbf2))
* tip 내용 수정 ([6812ae3](https://github.com/y0ngha/siglens/commit/6812ae34c933fb3f7a9df3e658dde1d2178e835c))

# [0.8.0](https://github.com/y0ngha/siglens/compare/v0.7.0...v0.8.0) (2026-04-12)


### Bug Fixes

* pollAnalysisAction parseJsonResponse try-catch 추가 및 테스트 케이스 추가 ([cf1e64c](https://github.com/y0ngha/siglens/commit/cf1e64cfae370dd06a9fc8d36588d08b05554778))
* PR 코멘트 반영 - import/first 위반 해결 및 as-cast 주석 추가 ([eae0ae8](https://github.com/y0ngha/siglens/commit/eae0ae88215e92c596c8430d4205b1d6aa75fd39))
* PR 코멘트 반영 - Promise.all race condition, JSON 파싱, hook 순서, useAnalysis 로직 ([ab38aba](https://github.com/y0ngha/siglens/commit/ab38abaf5e573979a7bfbce99a7849b4218ccd3a))
* PR 코멘트 반영 - skillsDegraded 위치 이동, 환경변수 검증 위치 조정, HTTP 상수화, 테스트 정리 ([332c226](https://github.com/y0ngha/siglens/commit/332c2261b688df7a1f95680fa6cbc60d9803dcc6))
* 아키텍처 위반 - SubmitAnalysisResult/PollAnalysisResult 도메인 타입으로 이동 ([a25e4b2](https://github.com/y0ngha/siglens/commit/a25e4b2124881b19b9afa15af2c85de8558cdd50))


### Features

* Gemini 분석을 Cloud Run 워커로 분리 - 외부 작업 큐 및 Redis 폴링 도입 ([a236e58](https://github.com/y0ngha/siglens/commit/a236e589accf6ca438f9d96668944a50fac32968)), closes [#291](https://github.com/y0ngha/siglens/issues/291)
* Worker /analyze 엔드포인트 및 submitAnalysisAction에 X-Worker-Secret 인증 추가 ([6f8e49c](https://github.com/y0ngha/siglens/commit/6f8e49c654a238b36b6a79b8f8b68dea4bbb6fc2))
* worker에서 Claude/Gemini AI provider 지원 ([cc4b667](https://github.com/y0ngha/siglens/commit/cc4b667b1974c52cd0417ad1d7d2848c40efbe0d))
* 분석 진행 UI 개선 - 팁 자동순환, 애니메이션, 15분 대기시간 확대 ([61d2cc8](https://github.com/y0ngha/siglens/commit/61d2cc8cd54c6e8dcbfc61aa49daccff54c33181))

# [0.7.0](https://github.com/y0ngha/siglens/compare/v0.6.1...v0.7.0) (2026-04-12)


### Bug Fixes

* buySellVolume 필드 추가, 차트 성능 최적화 ([f0c3437](https://github.com/y0ngha/siglens/commit/f0c34378765baea5f4b9fe4371ea2208cf2d492a))
* ChartSkeleton 위치 지정 오류 수정 (VolumeChart relative 추가) ([8b2ff19](https://github.com/y0ngha/siglens/commit/8b2ff198001c27d5299ebc2456468ef92ee9d584))
* classifyPriceZone zone boundary logic 설명 추가 및 테스트 커버리지 강화 ([2d81e68](https://github.com/y0ngha/siglens/commit/2d81e68917ec879ea1be43201e6cec6c95669c6e))
* ESLint violations and missing exports in SMC implementation ([d143ae6](https://github.com/y0ngha/siglens/commit/d143ae679a8d0d09453f07d0f4a739c7307a85f7))
* **home:** apply Gemini review — touch-manipulation, asymmetric padding, remove redundant borders ([1a583ce](https://github.com/y0ngha/siglens/commit/1a583cec5e2501fc1099d87ead182590d709c835))
* HowTo JSON-LD 동기 렌더링으로 SEO 개선 ([f51e6dc](https://github.com/y0ngha/siglens/commit/f51e6dcf63fb9f09f759faf6a94666b6d181abc8))
* **mobile:** 초기 스냅 SNAP_HALF 변경, 분석 중 시트 자동 올림 제거, 거래량 차트 padding 추가 ([6fa0a42](https://github.com/y0ngha/siglens/commit/6fa0a4234666c1c86775bc97733196e090ca63cf))
* overlayLabelUtils 테스트 mock에 신규 지표 필드 추가 ([e6fd6c7](https://github.com/y0ngha/siglens/commit/e6fd6c76d78a80af270543dc598b31f9a03b2d48))
* PR [#272](https://github.com/y0ngha/siglens/issues/272) 리뷰 반영 — countMdFiles 재귀화, 카운트 로직 통일, 테스트 추가 ([0ef4a58](https://github.com/y0ngha/siglens/commit/0ef4a588f65d7dc85d193df61a76a1bc02238159))
* PR [#274](https://github.com/y0ngha/siglens/issues/274) 리뷰 반영 — lastOf 헬퍼 재사용, 명시적 priceScaleId 선언 ([dee5608](https://github.com/y0ngha/siglens/commit/dee560827b759616219f0aaf0a3af0983103a63c))
* PR [#280](https://github.com/y0ngha/siglens/issues/280) 리뷰 반영 — toSorted 적용, max_tokens 양수 검증 복원, 오타 수정 ([9f58f17](https://github.com/y0ngha/siglens/commit/9f58f1787680b5a20dd8ef28758d3e9b5a78feaa))
* PR 코멘트 반영 - JSON 파싱 주석, 순수 함수 패턴, 로직 개선 ([7f4a26a](https://github.com/y0ngha/siglens/commit/7f4a26a65985ca0757e8dded0b38900b8d80090b))
* PR 코멘트 반영 - SMC 도메인 불변성 및 타입 정의 준수 ([de66b47](https://github.com/y0ngha/siglens/commit/de66b47e562f2d44fefebad313af413fcf2e3175))
* PR 코멘트 반영 - 스크립트 안정성 및 규칙 준수 ([e6472ff](https://github.com/y0ngha/siglens/commit/e6472ff492f353e2502ad24085e907a22e753429)), closes [#5](https://github.com/y0ngha/siglens/issues/5)
* **refactor:** useOnClickOutside 통합 및 버그 수정 ([55b2ebb](https://github.com/y0ngha/siglens/commit/55b2ebb4a4801ab8489de9974333fdb3cfdfbfc1))
* Remove blocking awaits from Home() and wrap async operations in Suspense ([4cb3a07](https://github.com/y0ngha/siglens/commit/4cb3a071f6e91117f18ab99dd62446b07f9e9608))
* SEO audit — meta/schema/structure improvements (closes [#282](https://github.com/y0ngha/siglens/issues/282)) ([20ea8f3](https://github.com/y0ngha/siglens/commit/20ea8f3af60ea4c5d57228a3bddb2f7892ed6e13))
* SEO 및 접근성 개선 사항 반영 ([649a119](https://github.com/y0ngha/siglens/commit/649a1190d5ff61f726c37d27f3269095ba2ddb65))
* useFocusTrap 의존성 배열 린트 위반 수정 ([9cdb59f](https://github.com/y0ngha/siglens/commit/9cdb59fea4029ab6821938c5f9a35dd86d114080))
* WAI-ARIA roving tabindex와 컬러 토큰 통합 ([dddd1e0](https://github.com/y0ngha/siglens/commit/dddd1e09fa69a4c076d9a5c5956e984531e85205))
* 개인정보처리방침 및 이용약관 페이지 접근성 및 구조 개선 ([29f370f](https://github.com/y0ngha/siglens/commit/29f370f349e8e67e9ab36d99fd0cabbed828abb0))
* 리뷰 코멘트 반영 — PSARNextStateResult 인터페이스 추출, non-null 단언 교체, 가독성 개선, 테스트 케이스 보강 ([f2b1e81](https://github.com/y0ngha/siglens/commit/f2b1e81d42c775c3fa4fedeffcbe863f7c249578))
* 모바일 바텀시트 차트 렌더링 및 시트 자동 확장 버그 수정 ([863a902](https://github.com/y0ngha/siglens/commit/863a90208cafb1f85e37e597e36b4bc3183b8149))
* 바텀시트 강제 닫기 제거 ([03d030e](https://github.com/y0ngha/siglens/commit/03d030e38cd4eb7e0c8e9a11f3eb964a23265fa4))
* 불필요한 훅 제거 및 바텀시트 높이 CSS 변수 적용 ([e63ef94](https://github.com/y0ngha/siglens/commit/e63ef94724341f8f50f356d8c3a40b85dd75117a))
* 온도/상위P 범위 검증 추가 및 테스트 통합 ([8334b81](https://github.com/y0ngha/siglens/commit/8334b812fbf653128b4b6ed6477af11fc24dc826))
* 전략 스킬 리뷰 코멘트 반영 (mean-reversion, multi-timeframe, wyckoff) ([ab0807d](https://github.com/y0ngha/siglens/commit/ab0807d4334b98cfe0752263c98f40d682c7768d))
* 접근성 개선 - aria-label 제거, aria-hidden 추가, 색상 대비율 수정 ([cec98ce](https://github.com/y0ngha/siglens/commit/cec98cea956ba89ef0ba4f4e238620628c4eab1e))
* 접근성 및 UI/UX 가이드라인 위반 사항 개선 ([106dab8](https://github.com/y0ngha/siglens/commit/106dab8560e4939f24ffbcec62ddac85777c0160))
* 접근성 위반 사항 수정 ([f8b0fd4](https://github.com/y0ngha/siglens/commit/f8b0fd40bbd4ca4a2f2408be36e380fe82c17b63))
* 접근성 위반 사항 수정 (포커스 트랩, 훅 선언 순서) ([861d743](https://github.com/y0ngha/siglens/commit/861d743519ef66e0656d896d4660c93b2ad554df))
* 차트 패턴 스킬 카테고리 및 keyPrices 수정 ([e5c91e7](https://github.com/y0ngha/siglens/commit/e5c91e790d0a62a0fbed48d89b32c5f537592edf))


### Features

* 9종 보조지표 domain 계산 로직 구현 ([a9d31bf](https://github.com/y0ngha/siglens/commit/a9d31bf8c4cf05052363b6722304efbabb6ddea1))
* buy/sell volume chart에 buy/sell labels 추가 ([b2ac419](https://github.com/y0ngha/siglens/commit/b2ac419aed1a36decd1267191ed6ffcdab397e39))
* Buy/Sell Volume 인디케이터 구현 ([26e76a4](https://github.com/y0ngha/siglens/commit/26e76a4198c636d64ba747f80d22167370293cd9))
* Buy/Sell Volume을 기존 Volume 오버레이로 적용 ([8db2197](https://github.com/y0ngha/siglens/commit/8db2197147096671cd944eab8ed7b16ab07b8c2f))
* Candlestick Patterns 스킬 신규 카테고리 추가 ([56dfdf9](https://github.com/y0ngha/siglens/commit/56dfdf94e0d773915c015b407fa05344a811d296))
* EntryRecommendation 진입 추천 여부 추가 ([eed55a6](https://github.com/y0ngha/siglens/commit/eed55a6fc1bc785f30367d3bb7020beec756eec5))
* **home:** Suspense 기반 로딩 및 스켈레톤 추가 ([be6e89b](https://github.com/y0ngha/siglens/commit/be6e89ba4d5125240cc021816e6b8eee1971c7ca))
* HowItWorks 설명 업데이트 ([791bd8f](https://github.com/y0ngha/siglens/commit/791bd8f5381520919fa87d66b326d59e5f1a2ff1))
* Indicators 보조지표 스킬 추가 (ATR, OBV, Parabolic SAR, Williams %R, Supertrend, MFI, Keltner Channel, CMF, Donchian Channel) ([fe53616](https://github.com/y0ngha/siglens/commit/fe53616f18c3af7f48c4f34821dd259968d38b8a))
* JSON-LD HowTo 스키마 추가 ([cba00b9](https://github.com/y0ngha/siglens/commit/cba00b9e4bd1ff0e6e536fcc2e3b8050950baf9a))
* Naver SEO 메타태그 및 설명 개선 ([f595e2e](https://github.com/y0ngha/siglens/commit/f595e2ed2d5f02ea9f9032f9f58d88028786d6ba)), closes [#248](https://github.com/y0ngha/siglens/issues/248) [#249](https://github.com/y0ngha/siglens/issues/249)
* Patterns 차트 패턴 스킬 추가 ([4bd348b](https://github.com/y0ngha/siglens/commit/4bd348bdcecb23f1f858e13998af1171d1fa1e43))
* Privacy Policy / Terms 페이지 추가 (YMYL/E-E-A-T SEO) ([2d9097f](https://github.com/y0ngha/siglens/commit/2d9097f21275c7cc79d8892738bf6266df2114bc))
* **prompt:** SMC 섹션 및 스퀵 모멘텀 강화 추가 ([c2b58ae](https://github.com/y0ngha/siglens/commit/c2b58ae0c22fa9840274d4c48e37ee366d6e7caf))
* section sr-only에 aria-hidden 추가 ([3cb44e7](https://github.com/y0ngha/siglens/commit/3cb44e7608180af5875dd73a8f28a403cff8a22d))
* SEO 개선 - iOS 홈화면 아이콘, HSTS 헤더 설정 ([a5f35b6](https://github.com/y0ngha/siglens/commit/a5f35b6132eea51535a6804907f11c067364c979))
* SMC(Smart Money Concepts) 보조지표 및 Skills 파일 추가 ([2fddd24](https://github.com/y0ngha/siglens/commit/2fddd244504bee9df8a086e74f2b9814535ed908))
* Squeeze Momentum 인디케이터 추가 ([22499c2](https://github.com/y0ngha/siglens/commit/22499c27dbfc97cbae2e0ec6fc7cee03e6bdcc6b))
* Strategies 전략 스킬 추가 (Wyckoff, Divergence, Fibonacci, Breakout, Mean Reversion, Multi-Timeframe) ([aa8e397](https://github.com/y0ngha/siglens/commit/aa8e3971586da746144187ce36209c0cb885f804))
* Support/Resistance 지지/저항 도구 스킬 신규 카테고리 추가 ([698af5e](https://github.com/y0ngha/siglens/commit/698af5ef100c4a85374d90f37e083db4414f2960))
* 공통으로 사용할 useOnClickOutside 작성 ([425472c](https://github.com/y0ngha/siglens/commit/425472c202dd02bca87bc97c8e08551e41dc15d8))
* 마켓 상수 및 타임프레임 검증 추가 ([9896048](https://github.com/y0ngha/siglens/commit/9896048f2c544b450c2c2d285334129256cffbef))
* 모바일 AI 분석 패널 바텀시트 UX 개편 ([ed55533](https://github.com/y0ngha/siglens/commit/ed55533156ad710c207d6eaa5f385b5634a83e67))
* 바텀시트 snap_half 55%로 변경 ([d9a73d0](https://github.com/y0ngha/siglens/commit/d9a73d018a793c48e0354b9de49cccadedef1b43))
* 사이트맵 커버리지 확장 (20개 → 100개+) ([10e3501](https://github.com/y0ngha/siglens/commit/10e350151bba203dc2d1bc52e37c4b7a2d0adcc9))
* 심볼별 OG 이미지 생성 및 크롤러 텍스트 추가 ([46ada9a](https://github.com/y0ngha/siglens/commit/46ada9a8d91cad9ffd7e551014cd280fe1c9e4c5))
* 인기 종목 자동 업데이트 스크립트 추가 ([9f86bcf](https://github.com/y0ngha/siglens/commit/9f86bcf657e44198a3a17180961a3e8303d6c920))
* 카테고리 > 섹터로 명칭 변경 ([3bba12a](https://github.com/y0ngha/siglens/commit/3bba12a8929fe1911ca3373a1adb545b65fc3be5))
* 카테고리별 종목 섹션 추가 ([77c90cf](https://github.com/y0ngha/siglens/commit/77c90cf21eca85e68f1d8e1015aa38100479a8e6))
* 타임프레임 URL 파라미터 검증 및 서버-클라이언트 동기화 ([2725fc2](https://github.com/y0ngha/siglens/commit/2725fc2ea716b5da93dfacbff1db2f34f4f11a3b))


### Performance Improvements

* 차트 라이브러리 dynamic import로 모바일 TTI 개선 ([8987839](https://github.com/y0ngha/siglens/commit/89878390d2ad781432c82fc5690fc4d67ed60a41))

## [0.6.1](https://github.com/y0ngha/siglens/compare/v0.6.0...v0.6.1) (2026-04-10)


### Features

* add contact/error-report dialog to footer and not-found page ([212e8da](https://github.com/y0ngha/siglens/commit/212e8da0f01339d91e1c33aea262354b1bd835a2))
* add notFound routing for invalid/unknown tickers ([7e060fb](https://github.com/y0ngha/siglens/commit/7e060fbe08fd6a73f48efd391c6c4d5a260297c6))
* Assets 저장시 한국어가 있을 경우 365일 저장, 없을 경우 12시간 저장으로 변경 ([9a118a3](https://github.com/y0ngha/siglens/commit/9a118a3390e77f9b749fb565d8d7b4cef4b47868))
* invalid ticker format validation and safe FMP caching ([a09de3c](https://github.com/y0ngha/siglens/commit/a09de3c3e9048118f1478b3e14fcaa0bd8ddf2e3))

# [0.6.0](https://github.com/y0ngha/siglens/compare/v0.5.0...v0.6.0) (2026-04-10)


### Bug Fixes

* Correct action recommendation colors per DESIGN.md ([3d7c9c8](https://github.com/y0ngha/siglens/commit/3d7c9c88010deaf083ec425234752639b8e2e6b3)), closes [#f87171](https://github.com/y0ngha/siglens/issues/f87171) [#ef5350](https://github.com/y0ngha/siglens/issues/ef5350) [#4ade80](https://github.com/y0ngha/siglens/issues/4ade80) [#26a69a](https://github.com/y0ngha/siglens/issues/26a69a)
* SEO 개선 사항 적용 (상수 통일, 스키마 수정, PWA 아이콘) ([960e1f3](https://github.com/y0ngha/siglens/commit/960e1f373b1517ab68f5ae41a125012dc989043a))


### Features

* ActionRecommendation 차트 가격선 오버레이 추가 ([d67c333](https://github.com/y0ngha/siglens/commit/d67c333883c96da65634e0afc7345dfba92469d0))
* Replace fire-and-forget patterns with waitUntil ([0f0b008](https://github.com/y0ngha/siglens/commit/0f0b0089184ba046056f5af8bc6ac34f443688bd))
* SEO 종합 개선 ([5ef8a85](https://github.com/y0ngha/siglens/commit/5ef8a85536137cae26f899584ea0f531e1badefd))
* Set actionPricesVisible default to true, improve styling ([f9c1d51](https://github.com/y0ngha/siglens/commit/f9c1d513a2ef7e16fdc69680ad78b952ba60ea35))

# [0.5.0](https://github.com/y0ngha/siglens/compare/v0.4.0...v0.5.0) (2026-04-09)


### Bug Fixes

* PR [#220](https://github.com/y0ngha/siglens/issues/220) 리뷰 반영 — 프롬프트 필드 목록 동기화, DOMAIN.md 문서 업데이트, 타입 명명화 ([e3c6334](https://github.com/y0ngha/siglens/commit/e3c63345b3b0e9e1df14556beaa4f64dbb892044))
* PR [#222](https://github.com/y0ngha/siglens/issues/222) 리뷰 반영 — dead code 뮤테이션 제거, hasCompanyName 단순화, AssetInfo 타입 배치 개선 ([1d1c9f0](https://github.com/y0ngha/siglens/commit/1d1c9f0167debfd18279891f3efe0a22f6632588))
* PR [#222](https://github.com/y0ngha/siglens/issues/222) 리뷰 반영 — 회사명 표시 버그 수정 및 API 캐시 갱신 ([c226134](https://github.com/y0ngha/siglens/commit/c2261344d21107b4bfe23c24f7d26a2283594476))
* summary 스키마 상세 지시 복원 및 가이드라인 ALL 키워드 유지 ([511c416](https://github.com/y0ngha/siglens/commit/511c4160129c9b07189b760c26941c7aa41797b2))
* TICKER_SEARCH_CACHE_TTL 24h로 복원, assetInfo 옵셔널 체이닝 적용 ([a7e4464](https://github.com/y0ngha/siglens/commit/a7e446442283efa214424f1b2e792a3675161a18))
* 뒤로가기 시 Object is disposed 에러 수정 — chart.remove() 전 구독 해제 ([a5447dd](https://github.com/y0ngha/siglens/commit/a5447dd16d9b32a4ed82dd51f0fe494d9c180c98))
* 심볼 페이지 쿼리 데이터 주입 최적화 및 코드 중복 제거 ([6a538cf](https://github.com/y0ngha/siglens/commit/6a538cfb3e0002044007b95b96f6d2ed0a0c322f))
* 심볼 페이지 회사명 중복 표시 방지 ([6b9f8b8](https://github.com/y0ngha/siglens/commit/6b9f8b866f161735b6d6e87927f1065900fdfe92))
* 프롬프트 지시 중복 제거 및 PR [#220](https://github.com/y0ngha/siglens/issues/220) 리뷰 반영 ([16225e2](https://github.com/y0ngha/siglens/commit/16225e2a0fae48d35b6087f617cacb6fbf72a479))


### Features

* AI 분석 Summary 접근성 개선 및 매매 전략(actionRecommendation) 필드 추가 ([#219](https://github.com/y0ngha/siglens/issues/219)) ([e910652](https://github.com/y0ngha/siglens/commit/e91065224151a6a2d6085942b6ec860f6400798e))
* 심볼 페이지 티커에 회사명 표시 ([d433b52](https://github.com/y0ngha/siglens/commit/d433b52517f4164558f0e94f74ebce6ba12704ae))

# [0.4.0](https://github.com/y0ngha/siglens/compare/v0.3.0...v0.4.0) (2026-04-09)


### Bug Fixes

* cache.get() 에러 처리 및 Korean translator 리팩토링 ([4cd311a](https://github.com/y0ngha/siglens/commit/4cd311a425414da4bfa4f89d849e9fea39d4d849))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 3차 반영 ([b2efec0](https://github.com/y0ngha/siglens/commit/b2efec046a17020cbb272089fde43851aab4cf66))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([ae74389](https://github.com/y0ngha/siglens/commit/ae743895e0536a0b16077b7dddb68f1a1f2b622d))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([2aa516c](https://github.com/y0ngha/siglens/commit/2aa516cd1da219a8493580cbfe848afe55ecf693))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([f80d269](https://github.com/y0ngha/siglens/commit/f80d2691e528d07695fbea6abdc1944e17ef3844))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([aa6a4f3](https://github.com/y0ngha/siglens/commit/aa6a4f34dc79aef2aed29f4baec39d2b7e93a28f))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([1f8e99a](https://github.com/y0ngha/siglens/commit/1f8e99aef20e1be393b05fd6b2a24ed5f908d8bf))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([98fab19](https://github.com/y0ngha/siglens/commit/98fab19602229fadf374133ea71dd7eacb04e655))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([4b0e197](https://github.com/y0ngha/siglens/commit/4b0e1970b8870298b04c6ce316b3b207bbd702d3))
* PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 - fetchFmpEndpoint 헬퍼 추출 및 테스트 추가 ([464c8c2](https://github.com/y0ngha/siglens/commit/464c8c24fb894eee7a78584a87455a85f771e34c))
* **search:** PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 2차 반영 ([d4a4aba](https://github.com/y0ngha/siglens/commit/d4a4abae4226fc82f34fed22536f07a900aaf9a3))
* **search:** PR [#216](https://github.com/y0ngha/siglens/issues/216) 리뷰 반영 ([b90de27](https://github.com/y0ngha/siglens/commit/b90de277bf539caadd30e74b33ec7fdf23604fc8))
* useMemo로 inputClass와 buttonClass 감싸기 ([f1b9ce2](https://github.com/y0ngha/siglens/commit/f1b9ce2513255fc95eb4aec10e40e46c0f664558))
* 재분석 버튼 활성화 및 상태 관리 개선 ([5aef6ee](https://github.com/y0ngha/siglens/commit/5aef6eecf0b61fec6e79439fbc6d0a53da7fabbf))


### Features

* ticker 페이지 로딩 성능 개선 ([e1ae8d1](https://github.com/y0ngha/siglens/commit/e1ae8d1cc100a63b8463f3fe6dc98db445f07067))
* 재분석 버튼 활성화 ([c9b02b9](https://github.com/y0ngha/siglens/commit/c9b02b9edad1377c77c9a325f7f42cf182483a1d))
* 티커 검색 도메인 타입 및 유틸리티 ([1a4f49d](https://github.com/y0ngha/siglens/commit/1a4f49df9edc5d523d8bcd76505f7478f6846b02))
* 티커 검색 인프라 레이어 구현 ([48fd0ce](https://github.com/y0ngha/siglens/commit/48fd0ce364975724456d408eba963aef26d76ae5))
* 티커 검색 캐시 및 쿼리 설정 ([4fcc56c](https://github.com/y0ngha/siglens/commit/4fcc56cf774b24a3dde0e09464bd02a94462dfd6))
* 티커 자동완성 UI 컴포넌트 ([0c77945](https://github.com/y0ngha/siglens/commit/0c77945905669191282f5de2f09a1c8124aa251a))
* 한국어 티커 데이터 동기화 스크립트 ([de6a450](https://github.com/y0ngha/siglens/commit/de6a4508ad6a14d54623a1b6eb7157a661973350))

# [0.3.0](https://github.com/y0ngha/siglens/compare/v0.2.5...v0.3.0) (2026-04-07)


### Features

* 최근 검색한 티커 저장 기능 추가 ([97e2b1c](https://github.com/y0ngha/siglens/commit/97e2b1c2076afcb73635c025f773bd790c941628))

## [0.2.5](https://github.com/y0ngha/siglens/compare/v0.2.4...v0.2.5) (2026-04-07)


### Bug Fixes

* 보조지표 pane 제거 실패 및 label 위치 미갱신 문제 해결 ([512a5fb](https://github.com/y0ngha/siglens/commit/512a5fbdd965b0970d5cbe976052d12ec212a3c9)), closes [#201](https://github.com/y0ngha/siglens/issues/201) [#212](https://github.com/y0ngha/siglens/issues/212)

## [0.2.4](https://github.com/y0ngha/siglens/compare/v0.2.3...v0.2.4) (2026-04-07)


### Bug Fixes

* **deploy:** Vercel ignoreCommand에서 git describe 제거 ([74fc36d](https://github.com/y0ngha/siglens/commit/74fc36dd3965a1cc81edb2f3b846acc6e6a028bd))

## [0.2.3](https://github.com/y0ngha/siglens/compare/v0.2.2...v0.2.3) (2026-04-07)

## [0.2.2](https://github.com/y0ngha/siglens/compare/v0.2.1...v0.2.2) (2026-04-07)


### Bug Fixes

* ai panel 기본 width는 640px로 고정 ([c6d2e59](https://github.com/y0ngha/siglens/commit/c6d2e599c1f5164b674da24c22d3b2d418a69cfd))
* seo site_url 잘못 되어있는 것 수정 ([c4db441](https://github.com/y0ngha/siglens/commit/c4db44149d5dc4478a12f5a268779267de55a7c8))
* 재분석 쿨다운 로직 수정 및 분석시 사용자 안내 추가 ([574d1cf](https://github.com/y0ngha/siglens/commit/574d1cf79b66243b9078bc6d7e30a857cd6e5f4b))

## [0.2.1](https://github.com/y0ngha/siglens/compare/v0.2.0...v0.2.1) (2026-04-07)

# 0.2.0 (2026-04-07)


### Bug Fixes

* address PR review findings on symbol-page hooks and client ([e28928d](https://github.com/y0ngha/siglens/commit/e28928dd80c8331e01a1a38404e08650a8288e10))
* AI 분석 패널 너비 드래그 조절 이슈 수정 ([bfc3a1a](https://github.com/y0ngha/siglens/commit/bfc3a1a3e0d41ad3a56c5a2cc7fab0d1f9d626de))
* AI 분석 패널 너비 조절 안정화 ([70591bf](https://github.com/y0ngha/siglens/commit/70591bf56737f3db1fe704dbadd2c923e52a618a))
* AI 분석 패널 독립 스크롤 영역 분리 - 차트 영역 높이 고정 ([982011f](https://github.com/y0ngha/siglens/commit/982011f02354c201cfc8638f43d767c373a39d5e))
* AI 분석 패널 드래그 기능 안정화 ([b9ef5cc](https://github.com/y0ngha/siglens/commit/b9ef5cc2615ec983379d7ffdc0a69087d626741b))
* AI 분석 패널 확장 시 차트 영역이 같이 움직이는 문제 수정 ([e0308d7](https://github.com/y0ngha/siglens/commit/e0308d7ca30befe82f8b250fcddd3d25718c3928))
* Alpaca getBars API 최신 데이터 반환 로직 수정 ([cea79ae](https://github.com/y0ngha/siglens/commit/cea79aeea09851ebfe2e1abf830ca26408c6a581))
* Alpaca getBars API 최신 데이터 반환 오류 수정 ([f7638aa](https://github.com/y0ngha/siglens/commit/f7638aa32155079d17cba68b3a153d3aa8f7c753))
* Alpaca getBars 최신 데이터 반환 로직 개선 ([bfd1d6c](https://github.com/y0ngha/siglens/commit/bfd1d6cdd297b47508ebc497cd842516b56a0bcb))
* Alpaca getBars 최신 데이터 반환 로직 개선 ([90b4713](https://github.com/y0ngha/siglens/commit/90b471321384696037c2099e165003dcba182e7b))
* Alpaca getBars 최신 데이터 반환 로직 수정 ([6e51102](https://github.com/y0ngha/siglens/commit/6e5110278c3a8e4153d4debeec73197921d12d05))
* Alpaca getBars 최신 데이터 반환하도록 수정 ([ca83405](https://github.com/y0ngha/siglens/commit/ca83405f8cdbec6706bfda446efb1a52aabb839a))
* Alpaca 마켓 데이터 조회 시 null 방어 처리 ([0f50c39](https://github.com/y0ngha/siglens/commit/0f50c3990c711f382ed276194e08c971d7ee9442))
* Alpaca/FMP provider에 start(from) 파라미터 추가로 bars null 반환 문제 해결 ([6336aa0](https://github.com/y0ngha/siglens/commit/6336aa00aed9b53aa39075bd08fff79c5cf37a11))
* AnalysisPanel EyeIcon 복원 및 신뢰도 설정 통합, 캐시 테스트 보강 ([057230e](https://github.com/y0ngha/siglens/commit/057230e049c509ef9078095e0beb32764c4a4e0b))
* AnalysisResponse 타입을 domain으로 이동, 레이어 위반 해소 ([e236d2a](https://github.com/y0ngha/siglens/commit/e236d2a48e8df65aab99758a19670f714d903455))
* any 타입 제거 및 tsconfig baseUrl 추가로 모듈 경로 오류 해결 ([a8a8bd5](https://github.com/y0ngha/siglens/commit/a8a8bd5933b83ac623eed920d0ff2959f984edc7))
* candle-labels 캔들 패턴 라벨 생성 로직 개선 ([19a434f](https://github.com/y0ngha/siglens/commit/19a434fc0e41b6774eaf7ad1786435ce41fe77cd))
* candle-labels 캔들 패턴 라벨 생성 로직 개선 ([294fcaf](https://github.com/y0ngha/siglens/commit/294fcafc6e71d1bd40a53bec130737487baf51c5))
* CCI 계산 로직 및 유틸 함수 수정 ([1577a8c](https://github.com/y0ngha/siglens/commit/1577a8cbd197daaf232f2e53dc0c30b41ad777ba))
* CCI 계산 로직 수정 및 fix-log 정리 ([dc36c27](https://github.com/y0ngha/siglens/commit/dc36c27c79bb1bd5f0197d197fc48f1ffb0dc033))
* CCI 인디케이터 계산 로직 수정 ([c3017f0](https://github.com/y0ngha/siglens/commit/c3017f046510a1bbe81c13407733e6223cb1d87d))
* Claude JSON 마크다운 코드블록 파싱 버그 수정 ([ce104b9](https://github.com/y0ngha/siglens/commit/ce104b9bed48996c2d79ef3b5d0c868ef007a4b1))
* Claude 응답 JSON 파싱 버그 - 마크다운 코드블록 처리 추가 ([f36455e](https://github.com/y0ngha/siglens/commit/f36455ebe5ba5b04104666e623e580f6cd8cfbcd))
* DEFAULT_TIMEFRAME과 DEFAULT_BARS_LIMIT을 domain/constants/market.ts로 이동 ([b6eb080](https://github.com/y0ngha/siglens/commit/b6eb0802b1ae50e8a8cb1093c812871b54f3bc5f))
* DOMAIN.md 삭제된 함수 참조 제거 및 skills EOF 개행 추가 ([35d3aa9](https://github.com/y0ngha/siglens/commit/35d3aa9cfaef7053d084d45520ee60db6fd7de5c))
* DOMAIN.md 잔존 PatternResult/patterns 참조 제거 및 CONVENTIONS.md EOF 규칙 추가 ([c61fffc](https://github.com/y0ngha/siglens/commit/c61fffc583dc99dae5c22d71ed46152c99021990))
* ElliottWave 스킬 및 분석 패널 로직 수정 ([dc507d5](https://github.com/y0ngha/siglens/commit/dc507d54123d8f87ebd41c5201ba760e6d9aed17))
* EMA 기간 선택 시 버튼 크기 자동 증가 문제 수정 ([71dc526](https://github.com/y0ngha/siglens/commit/71dc5269d66501e06947a230b0f01ce489cd5ef5))
* ESLint 오류 및 SymbolSearch Design 위반 수정 ([ee1d82c](https://github.com/y0ngha/siglens/commit/ee1d82c1d7c36d3048a86fa45501ba70fa2c3405))
* FMP provider URL 스펙 준수 및 Daily 타임프레임 분리 ([574bec1](https://github.com/y0ngha/siglens/commit/574bec16ac1e5844351547fbbe4d657ec7cef37b))
* FMP provider 마켓 데이터 API 에러 처리 개선 ([1b51750](https://github.com/y0ngha/siglens/commit/1b517507c2ad60aaef4ca4506eb7f4926dc50612))
* getBars API 최신 데이터 반환 오류 수정 ([60ce65c](https://github.com/y0ngha/siglens/commit/60ce65c29326e53d21d971560bc2135a8be149b4))
* Ichimoku Cloud 타입 오류 및 미사용 코드 정리 ([191f218](https://github.com/y0ngha/siglens/commit/191f218745fbed980e88afce8759205364eb9c81))
* Ichimoku 오버레이 로직 개선 ([5e0591d](https://github.com/y0ngha/siglens/commit/5e0591d2ba1ce9252688a448f0dc2b5895c70b66))
* import/first 규칙 위반 수정 및 CONVENTIONS.md ESLint 섹션 추가 ([d8beca1](https://github.com/y0ngha/siglens/commit/d8beca107a82475ac3c84a37a3af61f8dd138c7d))
* JSON.parse 에러 처리 및 process.env 복원 로직 수정 ([be8f45e](https://github.com/y0ngha/siglens/commit/be8f45e6babcdb4962cdafe7fc9ab30ac9c55a54))
* limit 검증 로직 회귀 ([9d8f46b](https://github.com/y0ngha/siglens/commit/9d8f46b0581f70bc2db1efdf0acd98a8e766b7b6))
* limit 음수 미검증 버그 수정 및 DOMAIN.md 타입 정의 추가 ([6147251](https://github.com/y0ngha/siglens/commit/61472517c6360b4690be9ed835179fbb40ca765e))
* MA/EMA 토글 버튼 크기 통일 및 초기 비활성 처리 ([a2b4989](https://github.com/y0ngha/siglens/commit/a2b49896b46b61431dc0fc1a5e4ea9a19a8fce91))
* MACD firstMacdIdx 일반화 및 calculateEMA 중복 가드 제거 ([3f14819](https://github.com/y0ngha/siglens/commit/3f148194737475ac3cd7ee927dbdc107010db5c4))
* MACD 대순환 분석 Skill 메타데이터 및 피드백 반영 ([fafaed7](https://github.com/y0ngha/siglens/commit/fafaed78a0dccbb3b0e42252af191c0e249f40cb))
* MACD 대순환 분석 스킬 수정 ([bbbda5f](https://github.com/y0ngha/siglens/commit/bbbda5f90e15861f3285563d508c4e7c88c1979d))
* MACD 대순환 분석 스킬 수정 ([33ebe95](https://github.com/y0ngha/siglens/commit/33ebe95728786ee8d57f225e5a1eb7bbdb6d8278))
* overlay legend hook 로직 수정 및 문서 업데이트 ([499173b](https://github.com/y0ngha/siglens/commit/499173b61f4d6865e96e0ec277bb6f266a7bdb86))
* overlay legend 타입 및 유틸 함수 정제 ([9f78509](https://github.com/y0ngha/siglens/commit/9f78509740905e0e868f84e639234dd88d501bc4))
* OverlayLegend 컴포넌트 레이아웃 및 로직 개선 ([19d20bd](https://github.com/y0ngha/siglens/commit/19d20bd332b43a8a6204f16fe8e7709d16cebf58))
* OverlayLegend 컴포넌트 상태 관리 및 테스트 개선 ([e089e18](https://github.com/y0ngha/siglens/commit/e089e187c10fd2ee90b6ff12c198f76ca9af32ce))
* Pane indicator 동적 index 계산 로직 개선 ([02b85c1](https://github.com/y0ngha/siglens/commit/02b85c100c1130d79c2eeaaa251f87b554ef0279))
* Pane Indicator에서 Label이 제대로 표시되지 않음 ([f613ee6](https://github.com/y0ngha/siglens/commit/f613ee68fe156f5a46e5d18cf127c52eb3a90836))
* Pane Indicator에서 Label이 제대로 표시되지 않음 ([f92c877](https://github.com/y0ngha/siglens/commit/f92c877628cc50eeae9073d594f7743fa2b7d197))
* PatternResult 신뢰도 변환 로직 개선 및 패턴 전달 ([4a23d2c](https://github.com/y0ngha/siglens/commit/4a23d2c9f2d88bf76e9ebc42a86d2fc5cc65ae46))
* period <= 0일 때 RangeError 방지 가드 추가 ([19d3dff](https://github.com/y0ngha/siglens/commit/19d3dff414ed328d76f58d19e0927967a3d66062))
* PR [#35](https://github.com/y0ngha/siglens/issues/35) 리뷰 반영 — IndicatorResult 정리 및 테스트 보완 ([d066dce](https://github.com/y0ngha/siglens/commit/d066dce371f331856bcb092ad36df5a82a6b4c3d)), closes [#9](https://github.com/y0ngha/siglens/issues/9)
* PR [#36](https://github.com/y0ngha/siglens/issues/36) 리뷰 반영 — IndicatorResult rsi/vwap 추가 및 테스트 보완 ([6d80042](https://github.com/y0ngha/siglens/commit/6d80042a281a6b7477c168ed695e255fdad2b73b))
* PR [#42](https://github.com/y0ngha/siglens/issues/42) 리뷰 반영 — window 예약어 변수명 수정 및 CONVENTIONS.md 규칙 추가 ([175f2d6](https://github.com/y0ngha/siglens/commit/175f2d6120d296b8be91a243f947e92804ca8374))
* PR [#42](https://github.com/y0ngha/siglens/issues/42) 리뷰 반영 — 불필요한 가드 제거 및 테스트 매직 넘버/누락 케이스 수정 ([cbdba36](https://github.com/y0ngha/siglens/commit/cbdba361ed0e32ef104864ef4726488e7ed4c9df))
* PR [#51](https://github.com/y0ngha/siglens/issues/51) 2차 리뷰 코멘트 처리 ([cfbd94a](https://github.com/y0ngha/siglens/commit/cfbd94a36b8910d1655272580f9e92fc70ec4a7b))
* PR [#51](https://github.com/y0ngha/siglens/issues/51) 3차 리뷰 코멘트 처리 ([cbfc6ff](https://github.com/y0ngha/siglens/commit/cbfc6ff6caf7a2758cab37902c618cda130a498c))
* PR [#51](https://github.com/y0ngha/siglens/issues/51) 4차 리뷰 코멘트 처리 ([4392497](https://github.com/y0ngha/siglens/commit/4392497958101d0e2ab7600b4c76cd9d7245af3c))
* PR [#51](https://github.com/y0ngha/siglens/issues/51) 리뷰 코멘트 처리 ([8803fbb](https://github.com/y0ngha/siglens/commit/8803fbb359757302cd3f935165793a08a031abbb))
* PR [#52](https://github.com/y0ngha/siglens/issues/52) 리뷰 코멘트 처리 ([8dcd098](https://github.com/y0ngha/siglens/commit/8dcd0984572425b222f03b80e5db5cb222dbc844))
* PR [#54](https://github.com/y0ngha/siglens/issues/54) 리뷰 코멘트 처리 ([2444b19](https://github.com/y0ngha/siglens/commit/2444b1950d1c22be58962bf5b37f392a180bfb77))
* PR [#55](https://github.com/y0ngha/siglens/issues/55) 리뷰 코멘트 처리 및 자체 리뷰 반영 ([c936c5c](https://github.com/y0ngha/siglens/commit/c936c5c7e174738b21d9b3018c32f1ffb27e9677))
* PR [#56](https://github.com/y0ngha/siglens/issues/56) 리뷰 코멘트 처리 ([3b1dd98](https://github.com/y0ngha/siglens/commit/3b1dd986a793693c3b63439b05933806ba1b0edb))
* PR [#60](https://github.com/y0ngha/siglens/issues/60) 리뷰 코멘트 반영 ([5972b1f](https://github.com/y0ngha/siglens/commit/5972b1fbb0c2fff6092e65764bd9ce65472dafda))
* PR [#60](https://github.com/y0ngha/siglens/issues/60) 리뷰 코멘트 반영 ([425710a](https://github.com/y0ngha/siglens/commit/425710aa87f8166e6edeed471720504f970b62db))
* PR [#62](https://github.com/y0ngha/siglens/issues/62) 리뷰 코멘트 반영 ([af2358b](https://github.com/y0ngha/siglens/commit/af2358b8c295d54b6d2373ef80e617f2c430a970))
* PR [#62](https://github.com/y0ngha/siglens/issues/62) 리뷰 코멘트 반영 ([bca1bec](https://github.com/y0ngha/siglens/commit/bca1becae9b50e4805f774eb67fe11f43247af90))
* PR [#62](https://github.com/y0ngha/siglens/issues/62) 리뷰 코멘트 반영 ([df10d8f](https://github.com/y0ngha/siglens/commit/df10d8f181c364207d68ca7fa73b41d7bd771cc3))
* pre-push에서 필요없는 명령 삭제 ([c9490c7](https://github.com/y0ngha/siglens/commit/c9490c7e1a0e3fa7d4b426adca11141359cf6008))
* prompt.test.ts 테스트 케이스 수정 ([f04f107](https://github.com/y0ngha/siglens/commit/f04f107e4791dd223d1f7b6dfd58acf8e23b0950))
* React key 속성 중복 오류 해결 ([d792d91](https://github.com/y0ngha/siglens/commit/d792d91454020260cf7265fb8f4c5070f8d3f6d5))
* React key 중복 오류 수정 ([e9ce76d](https://github.com/y0ngha/siglens/commit/e9ce76d0abe3bef8474fa3a68f31ee7ffaaa04e8))
* React key 중복 오류 수정 ([1cf454c](https://github.com/y0ngha/siglens/commit/1cf454c431410fa0a7613d4631f28d26bc2f2367))
* React key 중복 오류 수정 및 confidence 타입 개선 ([86ae991](https://github.com/y0ngha/siglens/commit/86ae99191034666459f53179809f7a1d3f1137ab))
* Redis 캐시 설정 및 분석 데이터 반환 로직 개선 ([688b21e](https://github.com/y0ngha/siglens/commit/688b21e847630bc96a3197b1daca6c9c1ec1d84d))
* RSI 리뷰 반영 — 매직 넘버 상수 추출 및 테스트 보강 ([1233bf7](https://github.com/y0ngha/siglens/commit/1233bf712d783e45b3f678313412d4c2832e51b2))
* RSI_PANE_INDEX 2로 변경 ([195c01c](https://github.com/y0ngha/siglens/commit/195c01c55dd726c86218fa8fc80ca84281e87e7a))
* rsi.ts, rsi.test.ts 파일 끝 개행 추가 ([6f9cfec](https://github.com/y0ngha/siglens/commit/6f9cfecd9854b78d16e6c792602d48bf80205f09))
* Signal.type 구체화, KeyLevels interface 분리, 테스트 구조 개선 ([59cafc7](https://github.com/y0ngha/siglens/commit/59cafc7f2cf41e7abf5f54e62c292d1334fc22d3))
* Skill.type 리터럴 타입 좁히기 및 테스트 상수명 명확화 ([eefb7c6](https://github.com/y0ngha/siglens/commit/eefb7c68c64f5a483e72fcce7743d7e201b7b4be))
* snake_case → camelCase, RSI(14) 매직 넘버 제거 ([6a42b25](https://github.com/y0ngha/siglens/commit/6a42b25b8dc2d407d2106e200ba044db10e040a8))
* standalone chart에 맞게 pane을 0으로 설정 ([7363f74](https://github.com/y0ngha/siglens/commit/7363f745d57d8a5592403a5edeaa4c1c56166b13))
* Stochastic 오실레이터 오버플로우 및 성능 개선 ([b63a031](https://github.com/y0ngha/siglens/commit/b63a03140e5a1733278baff3ffac76abd4b56904))
* symbol 페이지 초기 로딩 성능 개선 ([48bc7ce](https://github.com/y0ngha/siglens/commit/48bc7cec7f0fc153a190f62c8d7d651496a6ca77))
* union type alias 분리 및 CONVENTIONS 리터럴 규칙 명확화 ([bd14f18](https://github.com/y0ngha/siglens/commit/bd14f18970ec15ad8ede22a54801d0d8ca4d631b))
* useAnalysis 초기 마운트 시 분석 결과 초기화 로직 수정 ([9099cd4](https://github.com/y0ngha/siglens/commit/9099cd46a129e7da19c8b84d1fcf919994911340))
* useAnalysis 파라미터 주석 추가 및 pr-fix-agent 문서 업데이트 ([a3a79b4](https://github.com/y0ngha/siglens/commit/a3a79b43fdc32e644bc0b4d764010c3a757e213e))
* usePanelResize에 SSR 시 window 접근 가드 추가 ([bf48b1e](https://github.com/y0ngha/siglens/commit/bf48b1e9a966b4e3bea9e72361131b139fe0a9ea))
* Volume Profile 인디케이터 계산 로직 수정 ([c53f6f6](https://github.com/y0ngha/siglens/commit/c53f6f6f22bab18d35949e15e70d630804c1b5a4))
* Volume Profile 인디케이터 계산 로직 수정 ([7565f0b](https://github.com/y0ngha/siglens/commit/7565f0b71d4afe4fc2d36bd704d5b8a089dd54d3))
* Volume Profile 인디케이터 계산 로직 수정 ([7a952ad](https://github.com/y0ngha/siglens/commit/7a952adb6e11648a07f43123653fd6c4838ffaa3))
* Volume Profile 인디케이터 리뷰 코멘트 반영 ([0d6dc5a](https://github.com/y0ngha/siglens/commit/0d6dc5a54d173a66533ccc529f83d2f15a5252ea))
* Volume Profile 인디케이터 오버레이 로직 개선 ([62d39be](https://github.com/y0ngha/siglens/commit/62d39becbfda27c5bfeff03414d802a8d8abb76c))
* Volume Profile 인디케이터 재귀 함수 구조 개선 ([f1f7a55](https://github.com/y0ngha/siglens/commit/f1f7a55368b38bc19841d3cfccdda7313b52b2d5))
* Volume Profile 인디케이터 테스트 커버리지 및 코드 품질 개선 ([35bc200](https://github.com/y0ngha/siglens/commit/35bc2005f85224e12a23b8ebc98010a601c7a238))
* volume-profile 인디케이터 및 테스트 수정 ([8defe64](https://github.com/y0ngha/siglens/commit/8defe640c7b59faf3ec8af4f4b3bc3d90157051c))
* VolumeChart 데이터 클리어 및 SymbolPageClient 렌더링 패턴 개선 ([9dea90d](https://github.com/y0ngha/siglens/commit/9dea90d330f3cf6412ee93ac1e8473c7b38448b9))
* 기본 확장 false, 버튼 크기 유동적으로 변경 ([80f2d8b](https://github.com/y0ngha/siglens/commit/80f2d8bf2782b297063e8bf53070abe1a6268c0a))
* 동부 시간대 DST 변환 로직 수정 ([383cd44](https://github.com/y0ngha/siglens/commit/383cd44bb34bcafe812b78f8ac3de31f17abca64))
* 드래그 제스처 인식 안정화 및 패널 리사이징 로직 개선 ([a4ec980](https://github.com/y0ngha/siglens/commit/a4ec980bd72a588088b797c32299581466cd1496))
* 리뷰 반영 — constants.ts EOF 개행, Wilder 검증 강화, describe 레이블 수정 ([bed8a65](https://github.com/y0ngha/siglens/commit/bed8a65842cdda80039117664c661cedb310e94c))
* 리뷰 반영 — WilderState 외부 이동, Wilder smoothing 테스트 강화, 컨벤션 추가 ([1746cec](https://github.com/y0ngha/siglens/commit/1746cec348524b434aabe67b121ad446684bc3d3))
* 리뷰 코멘트 반영 - 도메인 경계값 추출 및 테스트 구조 정리 ([c8bb39e](https://github.com/y0ngha/siglens/commit/c8bb39eab82aae8ee9fbb9611ef683af38d45f62))
* 리뷰 코멘트 반영 - 타입 안정성 및 환경변수 일관성 개선 ([b6b32ec](https://github.com/y0ngha/siglens/commit/b6b32ec18144aec1ec79e82e1f3fc0118992b328))
* 리뷰 코멘트 반영 완료 ([a92d80f](https://github.com/y0ngha/siglens/commit/a92d80f4f4f50adca5ced7c9e28900f39cf374fe))
* 리뷰 피드백 반영 — 상수 응집도 개선 및 에러 상태 노출 ([b7ab6df](https://github.com/y0ngha/siglens/commit/b7ab6df333e008e49c514f379340db7d54c326bd))
* 매직 넘버를 상수로 교체 및 테스트 describe 이름 수정 ([8176968](https://github.com/y0ngha/siglens/commit/8176968849863858df65ae8e9b03956e5f259dbf))
* 메인 페이지 차트 empty state와 훅 선언 순서 정리 ([6e972b1](https://github.com/y0ngha/siglens/commit/6e972b16e7b72ddb7b7289405f0aefd14c893071))
* 모바일 UI 캐시 메시지 버그 수정 ([be45440](https://github.com/y0ngha/siglens/commit/be454406d3407f21f5de2931885213f8709d7939)), closes [#2](https://github.com/y0ngha/siglens/issues/2) [#3](https://github.com/y0ngha/siglens/issues/3)
* 모바일 UI, 캐시, 메시지 버그 4건 수정 ([34ddfb2](https://github.com/y0ngha/siglens/commit/34ddfb2f45480da386a1e7bd90fddb69f3143224))
* 미감지 스킬 숨기기 로직 개선 ([29bb5cf](https://github.com/y0ngha/siglens/commit/29bb5cfb6195e0d7ac9635b2565f774b1b174024))
* 배포 전 부족한 부분이나, 오류때문에 당장 힘든 부분 임시 비활성처리 ([cc5f6ce](https://github.com/y0ngha/siglens/commit/cc5f6ce81055147b25643f28d3865b26b68fd6f4))
* 보조지표 Pane 첫 번째 토글 시 제거되지 않는 버그 수정 ([c8dbae9](https://github.com/y0ngha/siglens/commit/c8dbae91d9349617b9ee4384c657820a179cf2f3))
* 보조지표 드롭다운 오버플로우 잘림 현상 해결 ([f3957c0](https://github.com/y0ngha/siglens/commit/f3957c05281216d5b1bd6623888c21bb91beff54))
* 보조지표 드롭다운 잘림 버그 수정 ([265fb17](https://github.com/y0ngha/siglens/commit/265fb17ab3ad6c29ad2bfbb7d4b842df6343e84a))
* 보조지표 레이블 렌더링 안정화 ([e8f3a1a](https://github.com/y0ngha/siglens/commit/e8f3a1a5d8052c1427f2107692fe4a634f254bff))
* 보조지표 레이블 렌더링 안정화 ([92d3413](https://github.com/y0ngha/siglens/commit/92d3413416c37739f2a5541a01af15abd9d33d68))
* 보조지표 레이블 렌더링 안정화 ([57aed78](https://github.com/y0ngha/siglens/commit/57aed78acb296621d34a11a1e17f970bb2fbceaa))
* 볼륨 프로필 인디케이터 테스트 및 오버레이 로직 개선 ([4f532ec](https://github.com/y0ngha/siglens/commit/4f532ec766433ad85558753238d77537e4768eb9))
* 분봉 차트 시간 표시 오류 및 ET 룩백 수정 ([77e2c03](https://github.com/y0ngha/siglens/commit/77e2c03330225929907ec801bd38b339874aee85))
* 분봉 차트 시간축 포맷 및 ET lookback 수정 ([4105b9c](https://github.com/y0ngha/siglens/commit/4105b9cf1428c55fea5afde56cae1797ce0afe39))
* 분봉 차트 시간축 포맷 및 ET lookback 수정 ([f258803](https://github.com/y0ngha/siglens/commit/f258803ad9b48481c708a2e4fd6e83d92b4c143a))
* 분봉 차트 시간축 포맷 및 ET lookback 수정 ([479a9ba](https://github.com/y0ngha/siglens/commit/479a9badcdcb6625fdca021a7f22547bb313cf2f))
* 분봉 차트 시간축 포맷 및 ET lookback 수정 ([114c0a0](https://github.com/y0ngha/siglens/commit/114c0a09b31c760073ed78053c4ebdeb26d5d299))
* 분석 패널 마운트 버그 수정 ([7b9c641](https://github.com/y0ngha/siglens/commit/7b9c641fb0bee8eff363d5c418a75d3a79f95e24))
* 빌드 및 린트 오류 수정 ([36c4969](https://github.com/y0ngha/siglens/commit/36c49690de2858681be54c398d1597d68dcf7a4d))
* 상승/하락 추세선 차트 표시 개선 ([a08a35b](https://github.com/y0ngha/siglens/commit/a08a35bc1efd1280d89ac6ecb463db006304794b))
* 서버 컴포넌트에서 new Date() 사용으로 인한 하이드레이션 경고 해결 ([38a8034](https://github.com/y0ngha/siglens/commit/38a80349f8f39e6ebc6d3143b26bf5600cefa1c3))
* 시간대 포맷 및 Alpaca lookback 계산 개선 ([fb72827](https://github.com/y0ngha/siglens/commit/fb728278931bc5df801772657be2d8e950ae6e14))
* 심볼 페이지 초기 로딩 성능 개선 ([3c720f9](https://github.com/y0ngha/siglens/commit/3c720f9d09d442dfb585210b92aaa42fed703353))
* 엘리어트 파동 스킬 신뢰도 필터링 적용 ([99530a7](https://github.com/y0ngha/siglens/commit/99530a7ae6b1778d69ebef4a1b04748aa82bcbc4))
* 이동평균선 대순환 분석 skill 수정 ([8ac0cf2](https://github.com/y0ngha/siglens/commit/8ac0cf2bdefadd72aa3cc491e89a6abca92bfbac))
* 이치모쿠 클라우드 오버레이 코드 품질 개선 ([eab1619](https://github.com/y0ngha/siglens/commit/eab1619fc845cb20772efec9c8904d2e94b7e271))
* 일목균형표 선행스팬 투영 및 구름 렌더링 수정 ([0647dc0](https://github.com/y0ngha/siglens/commit/0647dc03e9e987249873894b5d54d94885991eec))
* 종목 분석 페이지 안정성 및 에러 처리 개선 ([70bb90e](https://github.com/y0ngha/siglens/commit/70bb90e4a42c4a68038360198c7646b6761d1566))
* 중복 신뢰도 테스트 수정 및 Skill.pattern 미사용 필드 제거 ([4760e9f](https://github.com/y0ngha/siglens/commit/4760e9f63efacfadc053bb218100a83d7f62d5ee))
* 차트 패턴 감지되어도 차트에 표시되지 않는 문제 수정 ([45a0682](https://github.com/y0ngha/siglens/commit/45a0682c83dee75076138186a82dc6c1fd6a9a3c))
* 차트 패턴 오버레이 렌더링 오류 수정 ([fbf2b03](https://github.com/y0ngha/siglens/commit/fbf2b033d4d996912a78c4a36f20c7da9630ec8f))
* 차트 패턴 오버레이 매직 리터럴 및 구조적 문제 해결 ([6df9dc4](https://github.com/y0ngha/siglens/commit/6df9dc42fe70ccaf81cb0bfa40bf3ba3770389e0))
* 차트 패턴 오버레이 버그 수정 ([06330f1](https://github.com/y0ngha/siglens/commit/06330f1feec5689e1a68bc028727ab5d15dcca77))
* 차트 패턴 오버레이 신뢰도 필터링 및 계산 로직 수정 ([55e48ae](https://github.com/y0ngha/siglens/commit/55e48ae7c545a4c16ddf17a22f096f57941ab9e2))
* 차트 패턴 오버레이 표시 버그 수정 ([61635a8](https://github.com/y0ngha/siglens/commit/61635a8ef80bdca53a2135c7fde0914022490e7e))
* 차트 패턴 오버레이 표시 버그 수정 ([838985c](https://github.com/y0ngha/siglens/commit/838985c21091f794e782b2f8759b23bd29dfbe36))
* 차트 패턴 오버레이 표시 버그 수정 ([7d2dc1f](https://github.com/y0ngha/siglens/commit/7d2dc1f260a848442c3f825eb8e603646e5a61ec))
* 차트 패턴 오버레이 표시 버그 수정 ([1829a05](https://github.com/y0ngha/siglens/commit/1829a058d9f05df879e8af43449e36199c8ab8ae))
* 차트 패턴 오버레이 표시 버그 수정 ([5ff9aa7](https://github.com/y0ngha/siglens/commit/5ff9aa7eafdffcf34975641aa3634fddcab408b1))
* 차트 패턴 오버레이 표시 버그 수정 ([98ac851](https://github.com/y0ngha/siglens/commit/98ac8518c77f72c209b9c763993b4d1f8b63b1da))
* 차트 패턴 오버레이 표시 버그 수정 ([738bbad](https://github.com/y0ngha/siglens/commit/738bbadaacf5318245c9f62486338810f023c768))
* 차트 패턴 오버레이 표시 버그 수정 ([14477aa](https://github.com/y0ngha/siglens/commit/14477aa788e5ea9d3078d46400c9e4f7ff941e62))
* 차트 패턴 주요 가격대 텍스트 위치 및 표시 조정 ([88b04d1](https://github.com/y0ngha/siglens/commit/88b04d199be3157ea682f34614af2618fc5fd86f))
* 초기 마운트 시 API 중복 호출 방지 ([e4924df](https://github.com/y0ngha/siglens/commit/e4924dfc3ddbfbe8c83c7b0f6ce10056b499b7c8))
* 초기 페이지 로딩 시 AI 분석 실패하면 자동 재분석 실행 ([9241d3d](https://github.com/y0ngha/siglens/commit/9241d3d7c09bd632e572f2714c5f2ade6b71b937))
* 추세선 오버레이 후킹 로직 단순화 및 색상 문서화 ([5d6ed10](https://github.com/y0ngha/siglens/commit/5d6ed10ea6edae01065788c9606e84d6587ce3f7))
* 추세선 차트 렌더링 및 분석 오류 개선 ([690c7bd](https://github.com/y0ngha/siglens/commit/690c7bd6de3ed749b414fe0a87966ece2e1a8b9d))
* 캔들 트렌드 분석 및 프롬프트 테스트 수정 ([374a525](https://github.com/y0ngha/siglens/commit/374a525babb163702333d6349593834ac30e56d6))
* 캔들 패턴 감지 범위를 최근 15봉으로 제한 ([630c65a](https://github.com/y0ngha/siglens/commit/630c65aa1ee5e8e84cb41d7b6d29bc9fdfc98aeb))
* 캔들 패턴 감지 범위를 최근 15봉으로 제한 ([2d026f1](https://github.com/y0ngha/siglens/commit/2d026f121e2adc2b9ee78ffbacb657aa1137927e))
* 캔들 패턴 감지 범위를 최근 15봉으로 제한 ([8ba820e](https://github.com/y0ngha/siglens/commit/8ba820e8ee588dd4653487f1be2ab602527fbe7e))
* 캔들 패턴 감지 범위를 최근 15봉으로 제한 ([82ee8ed](https://github.com/y0ngha/siglens/commit/82ee8ede1a00bd5540148d40c2b154420dedbb1c))
* 캔들 패턴 감지 오류 및 프롬프트 구조 개선 ([8b837c0](https://github.com/y0ngha/siglens/commit/8b837c0d0556aa9d0c3be04fd9c3c5efb90b0ed9))
* 캔들 패턴 검출 로직 최적화 및 정확도 개선 ([f81954c](https://github.com/y0ngha/siglens/commit/f81954ce1423c7a63ee17a848396bca8e86b480a))
* 캔들 패턴 마커 표시 로직 개선 및 정확도 향상 ([e724492](https://github.com/y0ngha/siglens/commit/e7244923c708d7faf6e1c96e2ed5f73123487a24))
* 캔들 패턴 차트 시각화 개선 ([bb48aec](https://github.com/y0ngha/siglens/commit/bb48aece63162db0bf6536a7b06add93548cbe7d))
* 캔들 패턴 차트 표시 로직 개선 ([d885adb](https://github.com/y0ngha/siglens/commit/d885adb152eb22affa1113538383e8cbd43c150a))
* 타임프레임 변경 시 AI 분석 자동 업데이트 - 리뷰 피드백 반영 ([0edb89e](https://github.com/y0ngha/siglens/commit/0edb89e4746985b762048b3de7bd1cb2a8b46c82))
* 타임프레임 변경 시 AI 분석이 자동으로 업데이트되지 않는 버그 수정 ([fc0d227](https://github.com/y0ngha/siglens/commit/fc0d227d6034e96b0e6b108365cd1578036252cb))
* 타임프레임 변경 시 Suspense 경계 내 bars 로드 완료 후 분석 실행 ([6e6ddc3](https://github.com/y0ngha/siglens/commit/6e6ddc374b5a505eda515de76e56fd2f1075ad22))
* 테스트 내 매직 넘버 제거 및 CONVENTIONS.md 패턴 보완 ([e45cfbc](https://github.com/y0ngha/siglens/commit/e45cfbc8352edb88dd72d23d1ad210f8a7ca53bc))
* 테스트 파일 매직 넘버 14 → RSI_DEFAULT_PERIOD 교체 ([17b04a0](https://github.com/y0ngha/siglens/commit/17b04a0c3255bab5604a43fa5f40b326eaa56dc1))
* 패턴 오버레이 데이터 동기화 이펙트 불필요한 가드 제거 ([abc19ee](https://github.com/y0ngha/siglens/commit/abc19eeda5429ba0e53e4911b0f2a2ad7e5db2c9))
* 패턴 오버레이 의존성 정리 및 테스트 리팩토링 ([67d35bf](https://github.com/y0ngha/siglens/commit/67d35bf90d2688f2e991cc5c27c625bfaa4eccd9))
* 패턴 오버레이 주요 가격대 텍스트 렌더링 개선 ([a673f95](https://github.com/y0ngha/siglens/commit/a673f9514c4ddf78371aa07bd855623428dd4454))
* 프로덕션 console.log 제거 및 캐시 체크 로직 통합 ([a327156](https://github.com/y0ngha/siglens/commit/a32715664ffef301964249f9b29eeaaa79054097))
* 프롬프트 스키마 누락 필드 추가 및 에러 로깅 개선 ([d346575](https://github.com/y0ngha/siglens/commit/d346575170bcfa9a4eb264575d6bdac63bfcd4af))
* 프롬프트 스키마 누락 필드 추가 및 에러 로깅 개선 ([2de3576](https://github.com/y0ngha/siglens/commit/2de3576ffd0c233d49b77a9d8e4ca8e11d6623c2))
* 핵심 레벨 오버레이 로직 최적화 ([77c589f](https://github.com/y0ngha/siglens/commit/77c589fbed1252d137ea3f06141fcd8b55421f18))
* 핵심 레벨 차트 렌더링 및 패널 레이아웃 개선 ([4ae6f3e](https://github.com/y0ngha/siglens/commit/4ae6f3e1f5fc51d32012466adeceba5ea0807385))
* 핵심 레벨 차트 오버레이 렌더링 최적화 ([8a36e55](https://github.com/y0ngha/siglens/commit/8a36e55f3d3a15d2ec293595175ec273cf9fd23b))


### Features

* /api/bars Route Handler 구현 및 SIGLENS_API.md 추가 ([ea40805](https://github.com/y0ngha/siglens/commit/ea40805dc806333c7341ca9479c9932b61e77d72))
* 6개 패턴 Skills 파일에 category 및 display 필드 추가 ([a42e3bf](https://github.com/y0ngha/siglens/commit/a42e3bfe6136a11c950013afe13f06fa80336343))
* AI 분석 패널 기본 크기를 화면 너비의 1/3으로 확대 ([398d2ec](https://github.com/y0ngha/siglens/commit/398d2ecfdba2f79b49e30553685ddcf94670ba05))
* AI 분석 패널 너비 드래그 조절 ([9c4403c](https://github.com/y0ngha/siglens/commit/9c4403c335733f49a5d8957a13a52a39f250a779))
* AI 분석 패널 컴포넌트 구현 ([2b45e84](https://github.com/y0ngha/siglens/commit/2b45e84e5d89a61201346f1efaa7a2eeb1686242))
* AI 분석 패널에서 미감지 캔들 패턴 숨기기 ([15bfd0f](https://github.com/y0ngha/siglens/commit/15bfd0fa023f6fc88e160cfd1cf5fd09b31a111d))
* AI 분석 프롬프트에 Stochastic RSI 포함 ([5bf3b56](https://github.com/y0ngha/siglens/commit/5bf3b56e5fa5a20366ff7a5f0a104f59042988bc))
* AI 분석 프롬프트에 Stochastic 포함 ([c21abbf](https://github.com/y0ngha/siglens/commit/c21abbf0be2eee4469b0b32f20405a12bd653afd))
* AI 프롬프트 구성 로직 구현 ([#18](https://github.com/y0ngha/siglens/issues/18)) ([975b06a](https://github.com/y0ngha/siglens/commit/975b06a33a2756ecc522969728464e19017e0186))
* AIProvider 인터페이스 및 AnalysisResponse 타입 정의 ([b493e5b](https://github.com/y0ngha/siglens/commit/b493e5bf7726451a71853b12b7758753e96c0787))
* AlpacaProvider 구현 (data.alpaca.markets) ([0136cf9](https://github.com/y0ngha/siglens/commit/0136cf951cc911d0ed3cfa4e1277e608c9f4a929))
* AnalysisPanel 아코디언 토글 UI 구현 ([f998abb](https://github.com/y0ngha/siglens/commit/f998abb4d8b91f49367c57d806115c0ec43a80d1))
* AnalysisPanel에 근거 포함 지지/저항, 가격 목표 섹션 추가 ([7446e28](https://github.com/y0ngha/siglens/commit/7446e2870bb81475519389bdb156576f975db1af))
* AnalysisPanel에 신뢰도 배지 표시 ([769b3fd](https://github.com/y0ngha/siglens/commit/769b3fdcbbe9f340f445c63f76d17b4b0410fe9e))
* AnalysisResponse에 candlePatterns 필드 추가 및 UI 렌더링 ([ad32673](https://github.com/y0ngha/siglens/commit/ad326738ce5b80832d572aa6c9ba35cfbdf16485))
* analyzeAction에 Redis 캐싱 적용 ([f167f63](https://github.com/y0ngha/siglens/commit/f167f6388c3ae38be41fa113a553af0918a87c1b))
* CCI (Commodity Channel Index) 인디케이터 구현 ([bcdbaf9](https://github.com/y0ngha/siglens/commit/bcdbaf9003f9901b3548eac67beb53c79b566a51))
* CCI 색상 상수 추가 ([0b5d6b6](https://github.com/y0ngha/siglens/commit/0b5d6b6ab3fad0188eb5dfcd4da2990ca14e6e96))
* CCI 인디케이터 타입 및 상수 추가 ([4dd9b38](https://github.com/y0ngha/siglens/commit/4dd9b381ab8ab93777ef8124106f81d26919c4de))
* CCI 인디케이터를 AI 분석 프롬프트에 포함 ([7aac250](https://github.com/y0ngha/siglens/commit/7aac2501659a1e66a4e2a297ef4e3d1c25135e3f))
* CCI 인디케이터를 차트 UI에 통합 ([3032505](https://github.com/y0ngha/siglens/commit/3032505a1569e79fb61adce4b581ec98223eb14c))
* CCI 차트 훅 구현 ([782137f](https://github.com/y0ngha/siglens/commit/782137f2f124c6313a599e98581f2e10dcc73329))
* ClaudeProvider 구현 ([47a3348](https://github.com/y0ngha/siglens/commit/47a33480ad9793a2d1598dbbdf1c3fcce928fc9d))
* createMarketDataProvider 팩토리 함수 구현 ([ea79255](https://github.com/y0ngha/siglens/commit/ea79255e74a4326006b91b3f7375b9f247329a09))
* DMI 인디케이터 구현 ([#14](https://github.com/y0ngha/siglens/issues/14)) ([b57acf6](https://github.com/y0ngha/siglens/commit/b57acf6ad0e33bfb858f2b33e9239909411579b6))
* DMI 차트 훅 구현 ([aa936fc](https://github.com/y0ngha/siglens/commit/aa936fc9b1ed0350d6e71f8a126edaa418242edf))
* EMA 인디케이터 구현 ([38e753c](https://github.com/y0ngha/siglens/commit/38e753c9fdae4671a6f7eaeec40a255a6c75ce98))
* FmpProvider 클래스 구현 ([14a3bca](https://github.com/y0ngha/siglens/commit/14a3bcae002275a00aa3cf5213771d9f97c15335))
* Gemini AI 프로바이더 지원 추가 ([232dde7](https://github.com/y0ngha/siglens/commit/232dde7602689f09f7b80fbf2823246b61abd389))
* Ichimoku Cloud UI 및 분석 통합 ([e091134](https://github.com/y0ngha/siglens/commit/e09113473b7e802cd1723d7a495acc608cfb46ae))
* Ichimoku Cloud 인디케이터 구현 ([7bb9a01](https://github.com/y0ngha/siglens/commit/7bb9a011e50432cf21bfb794db2e940294ed97e2))
* JSON-LD XSS 방지를 위해 특수문자 이스케이프 처리 ([57a55bb](https://github.com/y0ngha/siglens/commit/57a55bb37ea0a12a616bee28fd023ca8d13933b9))
* KeyLevels/PriceTargets 타입 확장 및 AI 프롬프트 분석 가이드라인 추가 ([860391e](https://github.com/y0ngha/siglens/commit/860391ead84c19b7a3768ebb8bde1427246f89bc))
* layout.tsx에 ReactQueryProvider 추가 ([2900183](https://github.com/y0ngha/siglens/commit/290018317fa28c0d18b2248faf40c9d611ac0d4b))
* lineWidth를 훅 파라미터로 분리 ([bf7995a](https://github.com/y0ngha/siglens/commit/bf7995a96605e2ba7e2f16e0c95d91021c633add))
* MA 이동평균선 기간 추가 (5, 60, 120, 200일) 및 프롬프트 지표값 누락 수정 ([c8198bc](https://github.com/y0ngha/siglens/commit/c8198bcd27187e657a80b80af8072b3a911f1a5a)), closes [#145](https://github.com/y0ngha/siglens/issues/145) [#149](https://github.com/y0ngha/siglens/issues/149)
* MA 인디케이터 구현 ([20d46b5](https://github.com/y0ngha/siglens/commit/20d46b5a8e32e4215e634b36a0f8f709056bf887))
* MACD 대순환 분석 Skill 작성 ([40b078c](https://github.com/y0ngha/siglens/commit/40b078c2ba6c8ab2388e7737e19c831ba28b09a9))
* MACD 인디케이터 구현 ([fc825b3](https://github.com/y0ngha/siglens/commit/fc825b3ab2dff2b9e4215b98430dde8e54339341))
* MACD 차트 훅 구현 ([#28](https://github.com/y0ngha/siglens/issues/28)) ([3b4fa5b](https://github.com/y0ngha/siglens/commit/3b4fa5bbdaf9f57e978fa7a467963cf60601df47))
* MarketDataProvider 인터페이스 추가 ([34d8a8e](https://github.com/y0ngha/siglens/commit/34d8a8eaa5f4bf51a5fee52335544fc5529bde10))
* PatternResult 변환 및 patterns prop 전달 ([02fe904](https://github.com/y0ngha/siglens/commit/02fe9049ce004adf69ac899724728205a6f74c7c))
* PatternResult 변환 및 patterns prop 전달 ([a23c0a3](https://github.com/y0ngha/siglens/commit/a23c0a3ae21c579d3d292a7b3c97b412b5756cac))
* patternSummaries에 Skills 전용 지시 추가 ([0644fec](https://github.com/y0ngha/siglens/commit/0644fec86ceaddf3a51617f75a4abf7fdfd54db3))
* React Query API 레이어 구현 (barsApi, analysisApi, queryKeys) ([c97e931](https://github.com/y0ngha/siglens/commit/c97e9312a863ab976af4cdf03013c09910dd20cb))
* Redis 기반 AI 분석 결과 캐싱 인프라 구현 ([6138c31](https://github.com/y0ngha/siglens/commit/6138c3199ea5ab49b230a3724057fd16b48f5818))
* RSI 인디케이터 구현 ([a50c315](https://github.com/y0ngha/siglens/commit/a50c31587fd5743586f1b9029b4aca346db468a0))
* RSI 차트 훅 구현 ([91ade04](https://github.com/y0ngha/siglens/commit/91ade045f76363c9c60cc4b154de5c3f940fd97b))
* SEO 최적화 ([4b583b9](https://github.com/y0ngha/siglens/commit/4b583b9274ed303143ca7a9c45157daca8463c23))
* Skill 도메인 타입 확장 (SkillCategory, keyPrices, timeRange) ([3605589](https://github.com/y0ngha/siglens/commit/360558994abfd15c2ed2def481a3c3deeb3ba5f1))
* Skills 통합 기능 테스트 및 도메인 명세 추가 ([bbd172d](https://github.com/y0ngha/siglens/commit/bbd172d7c94c4d8cd63c7bd205c45e230b2f3144))
* Stochastic RSI 인디케이터 구현 ([6afaea2](https://github.com/y0ngha/siglens/commit/6afaea23e0b1f5786397f81ca7504319d7f11a9a))
* Stochastic RSI 지표 상수 및 내보내기 추가 ([105cd2c](https://github.com/y0ngha/siglens/commit/105cd2ce81c69b0f327f08a28b5d53a565505b85))
* Stochastic RSI 차트 UI 및 훅 구현 ([27cfea0](https://github.com/y0ngha/siglens/commit/27cfea0b68a22444eba4c9da3a1334fdda2867a2))
* Stochastic RSI 타입 및 색상 추가 ([4dc3627](https://github.com/y0ngha/siglens/commit/4dc3627ce793234b45d4bfed5ceba44775633d7e))
* Stochastic 오실레이터 구현 ([da299cd](https://github.com/y0ngha/siglens/commit/da299cdb79852868bcd98df0b5092187cc55ca07))
* Stochastic 차트 UI 및 훅 구현 ([f102b1f](https://github.com/y0ngha/siglens/commit/f102b1ff718943ddda781f9dcd3892002a52b2e2))
* StockChart 컴포넌트 구현 ([#23](https://github.com/y0ngha/siglens/issues/23)) ([6b4fd37](https://github.com/y0ngha/siglens/commit/6b4fd3732cf1bbe7c7ead6ee81289c67b55e9100))
* TIMEFRAME_LOOKBACK_DAYS 상수 추가 ([32f05a0](https://github.com/y0ngha/siglens/commit/32f05a08ea1ee615ac9ff28403d4e6536c783a0b))
* useAnalysis 훅 캐시 지원 추가 ([6ca777d](https://github.com/y0ngha/siglens/commit/6ca777da9b681ae9cc3587c8192fa0ea9cacda49))
* useBollingerOverlay 커스텀 훅 구현 ([#26](https://github.com/y0ngha/siglens/issues/26)) ([473fa45](https://github.com/y0ngha/siglens/commit/473fa45fe3a068c59b05b9418852997b229ee13a))
* useBollingerOverlay 훅 사용 추가 ([df7f350](https://github.com/y0ngha/siglens/commit/df7f3504e002662bdc7ba63126f6658aa4190bcd))
* useMAOverlay / useEMAOverlay 커스텀 훅 구현 ([#25](https://github.com/y0ngha/siglens/issues/25)) ([0410aba](https://github.com/y0ngha/siglens/commit/0410abafad25d6571f36eaaf4c24237d9f47c7f6))
* Volume Profile (VP) 인디케이터 구현 ([f85b80d](https://github.com/y0ngha/siglens/commit/f85b80d8d554169bacdf0bfbdbdbd83d1d77c656))
* VolumeChart 컴포넌트 구현 ([#24](https://github.com/y0ngha/siglens/issues/24)) ([ddaaf50](https://github.com/y0ngha/siglens/commit/ddaaf50190a31a3eb2c7ecea89721156b6e3dc4e)), closes [#26a69a80](https://github.com/y0ngha/siglens/issues/26a69a80) [#ef535080](https://github.com/y0ngha/siglens/issues/ef535080)
* VP 오버레이 및 차트 컴포넌트 통합 ([b0ebf8c](https://github.com/y0ngha/siglens/commit/b0ebf8c0295461fba85070ab2f1bfeb9eb76e91f))
* VP 인디케이터 타입 및 상수 추가 ([f17f445](https://github.com/y0ngha/siglens/commit/f17f445d9395a5a91ead9f67252207af537acddb))
* VWAP 인디케이터 구현 ([#15](https://github.com/y0ngha/siglens/issues/15)) ([7ff6b3f](https://github.com/y0ngha/siglens/commit/7ff6b3f9505cfa942eb76aab62d263744d93df93))
* 개발환경에서는 캐시 사용 안하도록 처리 ([9bbaae9](https://github.com/y0ngha/siglens/commit/9bbaae9dbe6c4471ecc91c9fc6daaac7eb2fa1e1))
* 도메인 공통 타입 정의 ([#5](https://github.com/y0ngha/siglens/issues/5)) ([0cc8a4b](https://github.com/y0ngha/siglens/commit/0cc8a4b2944843e194db4e7027828db52310a498))
* 메인 페이지 구현 ([b1a4f2d](https://github.com/y0ngha/siglens/commit/b1a4f2d6dc05cbee4ae6424cc8b27cb645325bd0))
* 메인 페이지 구현 ([7896415](https://github.com/y0ngha/siglens/commit/789641527751478654f3127973d3030417ba1e9e))
* 메인 페이지 구현 ([2d954a5](https://github.com/y0ngha/siglens/commit/2d954a5bfe28f0a8c3958cd65e1c78df2aae7f94))
* 메인 페이지 리디자인 및 AI 브랜딩 변경 ([2489f01](https://github.com/y0ngha/siglens/commit/2489f01197293e2999b2926eb5e8472139e8f897))
* 미감지된 스킬(패턴) AI 분석 패널에서 숨기기 ([d33fd25](https://github.com/y0ngha/siglens/commit/d33fd257c3756f3ad4089f324fb5378d7ad7eb71))
* 보조지표 13종 시그널 해석 skills 파일 추가 ([db6567c](https://github.com/y0ngha/siglens/commit/db6567cfc5c9a7f2dbe87a05f45db105d2280c26))
* 보조지표 indicator skills 시스템 구현 ([94102a8](https://github.com/y0ngha/siglens/commit/94102a87c44633c3bda5ef6981a0ac7dec3e2dcb))
* 보조지표 show/hide 토글 UI 개선 및 훅 분리 ([3b8f717](https://github.com/y0ngha/siglens/commit/3b8f7178a6163118a7ddc0de57ecdd1aa0c7e15b))
* 보조지표 Show/Hide 토글 UI 구현 ([fdb96a2](https://github.com/y0ngha/siglens/commit/fdb96a2ebc5ae1332de7ab9165142f1974a2612c))
* 보조지표 레이블 표시 ([3d4eb96](https://github.com/y0ngha/siglens/commit/3d4eb965c4e408cd0aa223439886ba59b0d9688e))
* 보조지표 툴바 접기/펼치기 기능 구현 ([b863b83](https://github.com/y0ngha/siglens/commit/b863b8310af9c6b662833ce1cafc13e780382d12))
* 볼린저 밴드 인디케이터 구현 ([#13](https://github.com/y0ngha/siglens/issues/13)) ([2a19c06](https://github.com/y0ngha/siglens/commit/2a19c060a9d9e7d9158d879b73172003fd47abd0))
* 분석 prompt 진행시 이유와 가격 정렬해서 내보내도록 수정 ([3eee749](https://github.com/y0ngha/siglens/commit/3eee749a13cb04eb4dd0d7fa15f9ed430b167d82))
* 분석 응답에 신뢰도 가중치 추가 및 한국어 패턴명 적용 ([fae6cd5](https://github.com/y0ngha/siglens/commit/fae6cd5551a0fd4b654ebac55effd9d7c7b405f1))
* 분석 프롬프트에 keyPrices, timeRange 스키마 추가 ([c17da11](https://github.com/y0ngha/siglens/commit/c17da1165e7db7b7712ea3da6c2b12357b87197b))
* 신규 지표 및 Skills AI 프롬프트 통합 ([195895f](https://github.com/y0ngha/siglens/commit/195895fe5599391cb606d0e35cdfd8318cbcea6f))
* 신뢰도 배지 및 한국어 패턴명 표시 기능 구현 ([e5978e2](https://github.com/y0ngha/siglens/commit/e5978e22b066f975f60515917545cea1a5cb50af))
* 에러 상태 노출 및 훅 마운트 최적화 ([8814952](https://github.com/y0ngha/siglens/commit/8814952cd9065944663e25267ad8b3ca44b8daac))
* 엘리어트 파동이론 Skill 구현 ([8fd28a9](https://github.com/y0ngha/siglens/commit/8fd28a99475e22c5e187c8a330ad2905173e871f))
* 이동평균선 대순환 분석 Skill 작성 ([ceebeab](https://github.com/y0ngha/siglens/commit/ceebeab61d5da0b715c8f39e26da9798fe7a7db4))
* 인디케이터 통합 calculateIndicators 함수 구현 ([d10b765](https://github.com/y0ngha/siglens/commit/d10b76559bd5d27d22f270f7f72d9224a3c92b5b))
* 종목 검색 컴포넌트 구현 ([2909f5d](https://github.com/y0ngha/siglens/commit/2909f5de8ea233f9f54b6c5aaeb91cc11ef6aafe))
* 중첩 YAML 파싱 및 display 필드 지원 (FileSkillsLoader) ([b25adb0](https://github.com/y0ngha/siglens/commit/b25adb01cf7de1b0e3a7264da76ff7c85aac4476))
* 차트 시간축 포맷팅 및 ET 타임존 지원 추가 ([b389437](https://github.com/y0ngha/siglens/commit/b389437f8c25c4b912b25f95bd83a0e864187d8c))
* 차트 오버레이 범례 컴포넌트 및 유틸 구현 ([53790c3](https://github.com/y0ngha/siglens/commit/53790c3d006cb5c0c83c89335361c8e213460a06))
* 차트 컬러 상수 및 기간별 컬러 반환 함수 정의 ([95f1980](https://github.com/y0ngha/siglens/commit/95f1980213a03529ae0c428366537413068409ee)), closes [#8](https://github.com/y0ngha/siglens/issues/8)
* 차트 패턴 감지 시 주요 가격대 텍스트 표시 ([ad65f2c](https://github.com/y0ngha/siglens/commit/ad65f2cdeb54861097d63c7d5e8f1fbd175a2ca8))
* 차트에 핵심 레벨 오버레이 표시 기능 추가 ([2646373](https://github.com/y0ngha/siglens/commit/2646373c25773440cd625367022e78aac07e527d))
* 추세선 분석 도메인 로직 구현 ([61b0705](https://github.com/y0ngha/siglens/commit/61b07054d1ad4a9e0cddb9ff61aaff17d6978276))
* 추세선 차트 오버레이 및 UI 컴포넌트 구현 ([aff0a1b](https://github.com/y0ngha/siglens/commit/aff0a1b71d7e32d2f6e2a69cdd27756539d8dce2))
* 캔들 패턴 감지 및 AI 프롬프트 강화 ([2463db8](https://github.com/y0ngha/siglens/commit/2463db8b1c8a4abe8a1dce4aba5d4b73b2f52fb7))
* 캔들 패턴 감지 시 차트에 시각적 표시 추가 ([48391b1](https://github.com/y0ngha/siglens/commit/48391b1b5dfa2fbc59d9e340af4a44e2116e24af))
* 캔들 패턴 차트 시각적 표시 기능 구현 ([2279daa](https://github.com/y0ngha/siglens/commit/2279daacc40653e3b4e50865aff5714b9f2af8a5))
* 타임프레임 셀렉터 컴포넌트 구현 ([c901a1e](https://github.com/y0ngha/siglens/commit/c901a1e649032ad2061a17a82a7dbc11d37f7786))
* 패턴 감지 스텁 및 skills 파일 추가 ([#17](https://github.com/y0ngha/siglens/issues/17)) ([e87242a](https://github.com/y0ngha/siglens/commit/e87242aed53c77b324805d8cbf5de791c2ae5182))
* 패턴 감지 전문 구현 — 거래량·캔들스틱 분석 통합 ([fa1012a](https://github.com/y0ngha/siglens/commit/fa1012abf2491889f86a3b2665eac1380dc69a4d))
* 패턴 및 기술 분석 렌더링 설정 타입 추가 ([9b3947d](https://github.com/y0ngha/siglens/commit/9b3947d73ebf8fb3c17b85558261829e254bcd1f))
* 패턴 오버레이 렌더링 (usePatternOverlay 훅) ([d9f982e](https://github.com/y0ngha/siglens/commit/d9f982eae188da24527390f9cfb8e41a431c3981))
* 핵심 레벨 검증 로직 구현 ([3853b96](https://github.com/y0ngha/siglens/commit/3853b964bbca3201c5635892bf0710573cf3a771))


### Performance Improvements

* reduce 누산기에서 allStates 전체 배열 누적 제거 ([b946597](https://github.com/y0ngha/siglens/commit/b946597830e25feaf654d3d3275c0fb087efe11b))


### Reverts

* Revert "chore: fix-log.md 정리" ([9f46b2e](https://github.com/y0ngha/siglens/commit/9f46b2ea250e235ada82bb76ff0773af1868c656))
* Revert "chore: fix-log.md 정리" ([208f929](https://github.com/y0ngha/siglens/commit/208f9296ba000ff8b0ab0bab10049f1f7d04d5bd))
* prompt.test.ts 롤백 (사람 관여해서 잘못됨) ([b2d382c](https://github.com/y0ngha/siglens/commit/b2d382cab20fb2fc85bbf852fac4b74b51475afe))
