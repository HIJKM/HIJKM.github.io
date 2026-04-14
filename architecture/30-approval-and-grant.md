# 30-approval-and-grant

## 기본 정책

- 비단순 실행 요청은 사용자 승인 없이는 실행할 수 없다.
- 위험 작업(`L2`, `L3`)은 `grant` 검증 없이는 실행할 수 없다.
- 승인/거절 권한은 사용자에게만 있다.

## 단일 운영자 모델 (B-Solo)

- 운영자는 단일 고정 사용자(`owner_user_id`)로 제한한다.
- 다중 승인(dual control)은 기본 비활성으로 두고, 단일 승인 + 증적 검증으로 운영한다.
- 승인 검증 최소 필드는 `approval_id`, `plan_hash`, `risk_signature`, `grant_ttl`로 고정한다.
- 감사 필드(`actor`, `channel`, `ts`)는 단일 운영자 환경에서도 항상 기록한다.
- `grant_ttl` 만료 또는 위험 변경 `replan` 발생 시 기존 승인/권한은 즉시 무효화한다.

## 승인 채널

- 기본 채널: Discord
- 보조 채널: Paperclip Dashboard(위험 작업 승인/리뷰 병행)

## 강제 포인트

- `waiting_approval` 또는 `in_review` 상태에서 `grant` 검증 실패 시 실행 함수 호출 금지
- `replan` 결과가 위험 변경(범위 확대, `L1 -> L2/L3`, 외부 부작용 capability 추가)을 포함하면 사용자 승인 이벤트 없이는 실행 재진입 금지
- 승인 이벤트는 State에 append-only로 기록
- 완료 전이(`done`)도 승인 이벤트와 함께 기록

## 감사 항목

- `approval_id`, `job_id`, `actor`, `channel`, `ts`, `decision`, `capability`
- `plan_hash`, `risk_signature`
