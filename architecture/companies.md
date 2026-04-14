# Company Structure (Recommended)

권장 구조는 아래 3개 company입니다.

1. `Ops company`
- 나노클로 본체 운영
- 사용자 소통
- 작업 실행 상태 관리

2. `Knowledge company`
- 자료조사
- 내부 LLM Wiki 관리

3. `Blog company`
- 외부 공개 블로그 발행 및 운영

## Why This Split

- 블로그(외부 공개)와 지식베이스(내부)는 보안 경계가 다르므로 분리
- 운영/소통 역할은 별도 company로 두어 장애 영향 분리
- 자료조사는 먼저 `Knowledge company` 안에서 시작하고, 필요 시 추후 독립

## Split Rule

`권한/공개범위/승인자/실패영향이 다르면 company 분리, 아니면 같은 company 내 project 분리.`
