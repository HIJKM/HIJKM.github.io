# 50-command-taxonomy

## 명령 분류

- `request`: 새 작업/질의 접수
- `approval`: `approve/reject` 계열
- `recovery`: `cancel/replan` 계열
- `operations`: `status(st)/safe-mode(sm)/restart(rs <plane>)/kill-switch(!!!!!!!)/respawn(???????)` 계열
- `query`: job/session/history 조회

## 운영 우선순위

- 긴급 상황에서는 `!!!!!!!`(kill-switch)로 전체 중단을 최우선 수행한다.
- `sm`, `rs <plane>`, `replan`은 운영 최적화/복구 편의를 위한 보조 명령으로 운용한다.

## 처리 책임

- request: `Comm -> State(draft) -> Harness(in_view 분류)`
- approval:
  - Discord: `Comm -> State(approval event) -> Harness`
  - Paperclip: `Harness Adapter -> State(approval event) -> Harness`
- recovery: `Comm -> Harness -> State`
- operations: `Comm -> Ops -> State(command_audit)`
- query: `Comm -> State/Observability(read) -> Comm`

## 경로 원칙

- 시스템 운영 명령은 Discord 단일 경로
- 승인 명령은 Discord + Paperclip 병행 가능

## 명령 스코프 매트릭스 (C)

- 기본 스코프는 `global/company/job` 3단계를 사용한다.
- `capability` 스코프는 예외 케이스(고위험 capability 제한, 운영 강제 제한)에서만 활성화한다.
- 기본 원칙은 단순성 우선이며, 분리 필요가 명확할 때만 `capability`를 추가한다.

## 긴급 단축 명령 규칙

- `!!!!!!!`, `???????`는 메시지 본문이 정확히 일치할 때만 명령으로 해석한다.
- 긴급 단축 명령은 권한 사용자 + 명령 채널에서만 허용한다.
- 긴급 단축 명령 호출은 모두 감사 로그에 기록한다.
