# plan

이 문서는 전체 아키텍처/운영 원칙을 짧게 고정하는 상위 요약이다.
상세 스펙은 numbered 문서 세트를 따른다.

## 1) 범위

- 새 시스템 아키텍처 원칙/요구사항 정의
- 입력/제어 기본 채널: Discord
- 승인/리뷰 보조 채널: Paperclip Dashboard
- 관측 채널: 내부 운영 대시보드(read-only)

## 2) 핵심 원칙

- 4대 원칙(동등 중요): 유연성, 견고성, 가시성, 접근성
- 원칙 정의/충돌 판단은 `05-core-principles.md`를 기준으로 한다.
- 사용자 의사/안전, 데이터 무결성, 서비스 지속성은 운영 판단의 최소 조건이다.
- plane 분리와 append-only 이벤트 추적은 구현 방식의 기본 제약이다.

## 3) Plane

- Communication: 입력/응답 전담, 실행 금지
- Harness: 분류/상태전이/승인게이트/디스패치
- State: 단일 기록원, 멱등성 보장
- Execution: 실행 워커, 판단 최소화
- Observability: 읽기 중심 관측

## 4) 운영 원칙

- 시스템 운영 명령은 Discord 단일 경로
- 위험 작업은 승인(`grant`) 없이는 실행 금지
- 하네스 재시작 후 자동 재개 금지
- 킬스위치는 AI 우회 즉시 실행
- 설계 단계(`notes/architecture`)는 로컬 문서 작업만 수행(push/restart 제외)

## 5) 상세 문서 참조

- 원칙: `05-core-principles.md`
- 용어: `10-glossary.md`
- 상태모델: `20-state-model.md`
- 승인/권한: `30-approval-and-grant.md`
- 라우팅/분류: `40-routing-and-classification.md`
- 명령 분류: `50-command-taxonomy.md`
- preview/관측: `60-preview-observability.md`
- Paperclip: `70-paperclip-integration.md`
- 장애/복구: `80-failure-recovery.md`
- 확정/미결: `90-decisions.md`, `99-open-questions.md`
