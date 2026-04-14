# 20-state-model

## 표준 상태 흐름

`draft -> in_view -> waiting_approval -> approved -> running -> in_review -> done|failed|cancelled`

## 규칙

- `in_view`는 분류/판단 단계이며 실행 상태가 아니다.
- `waiting_approval`에서는 실행 진입이 시스템적으로 금지된다.
- `in_review`에서 `done` 전이는 사용자 완료 승인 후에만 허용된다.
- 단순 질문(`intent_type=question`)은 `in_view -> done` 단축 흐름을 허용한다.

## 전이 권한 모델 (B+)

- 하네스는 상태 저장소를 직접 갱신하지 않고 `state_event`만 발행한다(무상태 원칙).
- 상태 전이 확정 권한은 State plane만 가진다(FSM 검증 단일화).
- `state_event`는 최소 `command_id`, `expected_prev_state`, `actor`, `risk_level`, `reason`, `ts`를 포함한다.
- State plane 전이 처리는 `command_id` 기준 idempotent로 수행한다(중복 이벤트 무해화).
- State plane 이상 시 `L2/L3` 실행 경로는 fail-closed로 차단한다.

## 재시작/복구

- 하네스 재시작 직후 자동 재개 금지(`복구-대기`).
- `rs <plane>`(재기동) 시 연관 `running` 작업은 자동 중단 후 `waiting_approval`로 전환한다.
- 사용자 선택 명령: `cancel <id>`, `replan <id>`.
