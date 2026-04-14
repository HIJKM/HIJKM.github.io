# Paperclip Completion / Approval / State Research

기준일: 2026-04-11

## 1) 확인 목적
- Paperclip에서 작업 완료를 어떻게 처리하는지 확인
- 현재 아키텍처(사용자 승인 중심)에 그대로 적용 가능한지 검토
- 상태/로그를 State Plane에 어떻게 반영할지 기준 정리

## 2) 확인된 내용 (요약)

### 2.1 이슈 상태
- 이슈 생애주기는 `backlog -> todo -> in_progress -> in_review -> done` 흐름을 지원
- `done`, `cancelled`는 종료 상태로 취급
- `in_progress` 진입 시 checkout(단일 담당) 전제가 있음

### 2.2 승인 상태
- 승인 객체는 별도 상태를 가짐: `pending -> approved / rejected / revision_requested`
- revision 요청 후 `resubmitted`로 다시 검토 사이클 가능
- 승인 흐름은 사용자 개입 지점(Inbox 운영)에 적합

### 2.3 활동 로그
- Activity API로 이슈 관련 활동 이력 조회 가능
- 즉, Paperclip 상태/활동을 외부 State Plane으로 동기 반영 가능

## 3) 아키텍처 반영 결론
- Paperclip 기본 흐름은 사용 가능
- 단, "작업 완료는 사용자 승인 후" 정책을 강제하려면 아래 규칙을 추가:
1. Harness는 기본적으로 `in_review`까지만 전이
2. 사용자 승인 완료 시에만 `done` 전이 허용

## 4) State Plane 반영 기준
- Paperclip에서 동기 수집:
  - issue 상태 변경
  - approval 생성/결정/재요청
  - activity 이벤트
- 로컬 시스템에서 별도 기록:
  - preview 생성/종료/만료
  - 시스템 스위치 on/off
  - observability 헬스 이벤트
- 공통 규칙:
  - append-only 이벤트 저장
  - 외부 ID(paperclip issue/approval/activity id) 매핑 유지
  - 중복 반영 방지용 멱등 키 사용

## 5) 참고 링크
- https://docs.paperclip.ing/api/issues
- https://docs.paperclip.ing/api/approvals
- https://docs.paperclip.ing/api/activity
- https://docs.paperclip.ing/api/dashboard
