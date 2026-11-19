# Fairhaul 물류 에이전트

*Claude가 번역했으며 원어민 검토가 남아 있습니다. 영어 [README](README.md)가 기준입니다.*

운임과 배송 비용을 위한 작은 MCP 에이전트 30개입니다. 각 에이전트는 운임 청구서 감사, 월말 운임 미지급 계상, 운송사 지급 정산, 수입 신고 확인처럼 **한 가지 일**만 맡으며 그 밖에서는 움직일 수 없습니다. TMS, ERP, WMS, 운송사 포털, EDI 사업자에서 이미 내보내는 파일을 읽고, 고객의 컴퓨터에 보고서를 쓰며, 돈을 움직이거나 메시지를 보내거나 운영 시스템을 바꾸는 일 앞에서는 지정된 담당자를 기다립니다.

MIT 라이선스 · Node 20 이상 · 로컬 파일만 · 자격 증명 불필요 · 의존성 없음

## 사용해 보기

```bash
npx -y fairhaul-freight-bill-audit demo        # 가상 데이터로 운임 청구 감사
npx -y fairhaul-freight-accruals demo     # 가상 데이터로 운임 미지급 계상
```

각 에이전트에는 가상 파일로 실행하는 `demo`, 자체 테스트 케이스로 확인하는 `eval`, Claude Desktop, Claude Code, Cursor 등 MCP 호스트용 MCP 서버(`npx -y <agent> mcp --root <폴더>`)가 있습니다. 현재 열 이름과 보고서는 영어입니다.

## 에이전트

**운송사 청구:** `fairhaul-freight-bill-audit`(FTL·LTL 청구서와 계약 대조), `fairhaul-parcel-refunds`(택배), `fairhaul-detention-and-lumper`(대기 요금), `fairhaul-fuel-surcharges`(유류할증료), `fairhaul-accessorial-charges`(부대 비용의 원인), `fairhaul-ltl-reweighs`(재계량과 등급 변경), `fairhaul-duplicate-payments`(이중 지급), `fairhaul-ocean-freight-audit`(해상), `fairhaul-air-freight-audit`(항공), `fairhaul-proof-of-delivery`(배송 증빙), `fairhaul-container-demurrage`(컨테이너 프리타임과 체선료), `fairhaul-customs-entries`(수입 신고와 상업 송장 대조, 품목 분류 자문 없음).

**계획, 구매, 운영:** `fairhaul-rfp-bid-scoring`(입찰), `fairhaul-contract-rerating`(계약별 과거 실적 재계산), `fairhaul-spot-quotes`(스팟 견적), `fairhaul-lane-spend`(노선별 지출과 합적), `fairhaul-carrier-scorecards`(운송사 성과표), `fairhaul-carrier-vetting`(사기 경고 신호), `fairhaul-load-tracking`(지연 화물), `fairhaul-dock-scheduling`(도크 예약), `fairhaul-carton-sizing`(상자 크기), `fairhaul-edi-files`(X12 파일 읽기와 대사).

**결산과 원가:** `fairhaul-freight-accruals`(운임 미지급 계상), `fairhaul-freight-allocation`(주문·코스트센터별 운임 배부), `fairhaul-standard-freight-cost`(품목 원가의 운임 표준), `fairhaul-freight-margins`(고객별 청구 운임과 실제 운임), `fairhaul-broker-settlements`(브로커용 운송사 지급), `fairhaul-freight-claims`(화물 사고 청구), `fairhaul-returns-tracking`(반품부터 환불까지), `fairhaul-freight-emissions`(고객이 고른 계수로 배출량 추정).

## 안전 장치

- **에이전트별 허용 목록.** 각 에이전트는 자신의 도구만 호출할 수 있습니다.
- **모델이 보기 전에 마스킹.** 소포·반품 수령인, 인수 서명자, 담당자, 운전자의 이름은 가명(`CU-3f2a9c1d`, `ST-8cea1a2d`)으로, 전화·이메일·주소는 자리표시자로 바뀝니다. 운송사와 고객의 회사명, 화물·송장 번호, 날짜, 금액은 그대로 전송됩니다(`--pii strict`는 회사명도 숨깁니다). PC에 기록되는 파일에는 실제 값이 남습니다.
- **거부하는 도구.** 지급, 이메일 발송, TMS 변경, 총계정원장 전기, 세관 신고는 이름을 지정해 차단합니다.
- **지정된 담당자의 클릭 한 번.** 지급, 발송, 운영 변경, 전표 승인은 Auto 모드에서도 지정된 담당자를 기다리며, 검토한 초안의 sha256에 묶입니다.
- **감사 로그**는 `.fairhaul/`에 해시 체인으로 기록되며, Ed25519 키를 설정하면 서명됩니다.
- **긴급 정지:** `<agent> kill`은 `<agent> unkill` 전까지 모든 도구를 멈춥니다.

## 테스트 방법

각 에이전트에는 자체 규칙에 대한 전용 테스트, 모든 에이전트에 공통인 계약 테스트(인수, `--root` 밖의 파일, 검토 모드, 비상 정지, 초안 승인, 반복 가능한 결과), 가상 파일로 만든 14~22개의 평가 사례가 있습니다. 표를 읽는 사례는 모두 독일, 프랑스, 스페인, 브라질, 이탈리아, 일본, 중국, 한국 내보내기 형식으로 다시 실행하며, 각 에이전트의 파일에는 악의적인 데이터도 심어 둡니다. 모두 합쳐 테스트 953개와 평가 사례 551개가 Windows의 Node 24에서 통과합니다(2026-11-19 최종 점검, Node 20과 22는 CI에서 확인). 버전 2의 변경 사항과 발견된 버그는 [REVIEW-ver3.md](REVIEW-ver3.md)(영어)에 있습니다.

## 한계

- 각 에이전트는 제공된 파일로만 작동하며 운송사, TMS, ERP, 은행, 정부 시스템에 로그인하지 않습니다.
- 법률·세무·통관·회계 자문이 아닙니다. 결정과 실행은 사람이 합니다.
