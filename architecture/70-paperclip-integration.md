# 70-paperclip-integration

## 역할

- Paperclip Dashboard는 승인/리뷰/활동 모니터링 채널이다.
- 내부 통합 대시보드를 대체하지 않는다.

## 완료 처리

- 기본 흐름은 `in_review`까지 자동 전이 가능.
- `done` 전이는 사용자 승인 후에만 허용.

## 동기화 대상

- issues 상태
- approvals 상태
- activity 로그

## 동기화 규칙

- 외부 ID 매핑 유지(issue/approval/activity)
- append-only 이벤트 저장
- 멱등 키로 중복 반영 차단

## 세분화 승인 가능 범위

- comm plane은 `company + agent + issue(task)` 단위 승인/거부 운영이 가능하다.
- 근거 축:
  - approvals 엔터티(`companyId`, `requestedByAgentId`)
  - issue 연결(`issue_approvals`)
  - issue execution policy participant(현재 단계 승인자/리뷰어)
