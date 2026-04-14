# 10-glossary

용어 단일 기준(SSOT).

## 상태 용어

- `draft`: Comm이 요청을 최초 기록한 상태
- `in_view`: Harness가 분류/판단 중인 상태(실행 아님)
- `waiting_approval`: 계획 고정 후 승인 대기 상태
- `approved`: 사용자 승인 완료 상태
- `running`: Execution 실행 중 상태
- `in_review`: 결과 검토/완료 승인 대기 상태
- `done`: 완료 승인까지 끝난 최종 상태
- `failed`: 오류 종료 상태
- `cancelled`: 사용자/정책 중단 종료 상태
- `pending_approval`: 일반 표현이며 실제 상태는 `waiting_approval` 또는 `in_review`
- `no_response`: 하트비트/응답 이벤트가 기준 시간 이상 관측되지 않은 상태

## 승인/권한 용어

- `grant`: 승인된 실행 권한 토큰
- 최소 필드: `approval_id`, `job_id`, `capability`, `expires_at`
- `blocked`: 정책 위반으로 실행이 거부된 이벤트 상태

## 분류 용어

- `intent_type`: `question` | `execution`
- `destination_company`: `ops` | `knowledge` | `blog` | `none`
- `risk_level`: `L1(읽기)` | `L2(로컬 수정)` | `L3(외부전송/삭제/파괴)`

## 명령 용어

- `request`, `approval`, `recovery`, `operations`, `query`
