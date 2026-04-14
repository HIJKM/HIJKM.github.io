# 40-routing-and-classification

## 분류 축

1. `destination_company` (1차 기준)
2. `intent_type` (`question`/`execution`)
3. `risk_level` (`L1`/`L2`/`L3`)

## 라우팅 원칙

- 라우팅의 핵심 결정은 `destination_company`다.
- `work/research` 같은 일반 라벨은 보조 의미로만 사용한다.
- `intent_type=question`은 Harness 직접 응답 가능.
- `intent_type=execution`은 승인 게이트를 거쳐 Execution으로 디스패치한다.

## company 분리 기준

- 권한/공개범위/승인자/실패영향이 다르면 company 분리
- 아니면 같은 company 내 프로젝트 분리
