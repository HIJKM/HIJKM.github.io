# 80-failure-recovery

## 장애 대응 원칙

- Discord 장애: 입력 일시 중단, 진행 작업 유지, 복구 후 누락 알림 재전송
- Comm 장애: 자동 재기동, Harness/Execution 독립 진행
- Harness 장애: 자동 재기동 후 `복구-대기`
- State 장애: 쓰기 축소/중단, 무결성 우선 복구
- Execution 장애: 작업 단위 격리 실패 처리
- Observability 장애: 실행 유지, 관측만 복구

## 장애 판정 트리거

- `no_response` 3분 이상이면 장애로 판정한다.
- 장애 판정 시 해당 plane은 즉시 복구-대기 또는 격리 처리하고, 사용자에게 상태를 통지한다.

## 재시도/타임아웃 기본안 (B)

- 정책 범위는 일반 명령(`request/approval/recovery/operations/query`)이며, preview 재시도는 `60-preview-observability.md` 규칙을 따른다.
- 재시도 대상은 `transient`/일시 장애로 제한하고, `policy`/`validation` 오류는 즉시 실패 처리한다.
- 모든 재시도는 `command_id` 기반 idempotent 전제를 유지한다.

### 명령별 권장값

- `request`: timeout `10~20s`, retry `2회`(`2s`, `5s` + jitter)
- `approval`: timeout `5~10s`, retry `3회`(`1s`, `3s`, `7s` + jitter)
- `recovery`: timeout `15~30s`, retry `2회`(`3s`, `8s`)
- `operations`: ack timeout `3~8s`, 효과 확인 timeout `30~60s`, ack retry `3회`(`1s`, `2s`, `4s`)
- `query`: timeout `3~10s`, retry `1~2회`(`1s`, `2s`)

### 승격 규칙

- 동일 plane의 `transient` 실패가 1분 지속되면 `warning`.
- 3분 이상 회복되지 않으면 `incident`로 승격하고 복구 절차로 전환.

## 사용자 이벤트 전달 신뢰성

- 기본 이벤트 경로는 `B`로 운영한다.
- 내부용/유실 허용 이벤트는 `B`만으로 처리한다.
- 사용자 대상 필수 이벤트(알림/이메일/결제/승인 결과)는 `C(outbox+relay)`를 적용한다.
- 적용 순서는 전체 `B` 운영을 유지하면서 중요 사용자 이벤트부터 `C`를 단계 적용한다.

## 안전 모드

- `safe-mode(sm)`는 L2/L3 side effect 실행을 즉시 차단한다.
- 읽기/관측 경로는 유지해 상태 확인과 복구 판단을 계속 가능하게 한다.

## 자동 스위치 트리거 범위 (B)

- 자동 조치는 `safe-mode(sm)` + `rs comm/harness` 1회까지만 허용한다.
- `rs state/execution/observability`는 자동 실행하지 않고 운영자 수동 명령으로만 처리한다.
- 자동 `rs`는 `incident(no_response >= 3분)` 판정 상태에서만 시도한다.
- 동일 plane에서 자동 `rs`가 1회 실패하거나 10분 내 재발하면 자동 복구를 중단하고 수동 복구 절차로 전환한다.
- 자동 스위치 실행 이력은 모두 감사 로그와 운영 알림으로 남긴다.

## 상황 기반 튜닝 원칙

- `sm`, `rs <plane>`, `replan` 튜닝은 고정 순서(runbook order)로 강제하지 않는다.
- 장애 plane, 영향 범위, 위험도, queue lag, 승인 상태를 기준으로 상황에 맞게 선택한다.
- 기본 운용은 사용자(운영자) 수동 판단이며, 자동 조치는 위 `자동 스위치 트리거 범위 (B)`로 제한한다.
- 자동 복구 이후 추가 조치(`replan`, 추가 `rs`)는 사용자 명령/승인으로만 진행한다.

## 킬스위치

1. 신규 작업 접수 차단
2. 실행 중 작업 정지
3. 잠금 유지(수동 해제 전 재개 금지)

- AI 경로 우회 시스템 명령으로 즉시 실행
- 반복 호출 시 동일 결과(idempotent)
- 시스템 장애 유형과 무관하게 최종 대응 수단으로 `!!!!!!!` 전체 중단을 항상 허용한다.

## `respawn(???????)` 해제 전 헬스체크 (B)

- 해제 전 필수 확인 항목은 아래 3가지다.
  - heartbeat 정상(연속 누락 없음)
  - State read/write 정상(기본 CRUD 점검 통과)
  - queue lag 임계치 이내(운영 기본 임계치 이하)
- 3가지 중 하나라도 실패하면 `respawn` 해제를 거부하고 수동 점검 절차로 전환한다.
