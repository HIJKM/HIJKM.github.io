# code-implementation-spec

이 문서는 코드 레벨 구현 진입점이다.

## 1) 코드 베이스 목표 경계

- `src/comm`: Discord 입력/명령 파싱/응답
- `src/harness`: 분류/승인게이트/상태전이/디스패치
- `src/execution`: sandbox/preview 실행
- `src/state`: jobs/events/approvals/previews/switches 저장소
- `src/ops`: 시스템 커맨드 라우팅
- `src/observability`: 읽기 API/헬스/타임라인
- `src/integrations/paperclip`: approval/activity 동기 어댑터

## 2) 핵심 인터페이스 요약

- 4대 원칙 제약은 `05-core-principles.md`를 따른다.
- Job 상태는 `20-state-model.md`를 따른다.
- 승인 토큰(`grant`) 검증은 `30-approval-and-grant.md`를 따른다.
- 라우팅 분류는 `40-routing-and-classification.md`를 따른다.
- 명령 분류와 처리 경로는 `50-command-taxonomy.md`를 따른다.
- preview/관측 연동은 `60-preview-observability.md`를 따른다.

## 3) 구현 순서

1. State 스키마/이벤트/멱등성 고정
2. Ops 라우터 분리(시스템 경로 분리)
3. Comm enqueue-only 전환
4. Harness 상태전이/승인게이트 고정
5. Execution 워커 + preview 관리
6. Observability 읽기 API 구축
7. Paperclip 동기화 잡 추가

## 4) 검증 포인트

- `waiting_approval` 실행 차단
- `grant` 부재/만료 차단
- `in_view` 실행 진입 금지
- preview 장애의 관측 장애 전파 방지
- Discord/Paperclip 승인 정책 일치
