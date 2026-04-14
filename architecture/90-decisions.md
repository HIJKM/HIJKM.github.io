# 90-decisions

변경 시 사전 합의가 필요한 확정 결정 목록.

1. 4대 원칙(유연성/견고성/가시성/접근성)은 동등 중요하며, 설계 변경 시 모두 점검한다.
2. 원칙 충돌 시 임시 판단 규칙은 `05-core-principles.md`를 따른다.
3. 시스템 운영 명령은 Discord 단일 경로로 처리한다.
4. 승인/리뷰는 Discord와 Paperclip Dashboard를 병행 허용한다.
5. 위험 작업 분류는 `L1/L2/L3`로 고정한다.
6. 상태 흐름은 `draft -> in_view -> waiting_approval -> approved -> running -> in_review -> done|failed|cancelled`로 고정한다.
7. 라우팅 1차 기준은 `destination_company`로 고정한다.
8. `grant` 없는 위험 실행/완료 전이는 차단한다.
9. Preview 정책은 동시 3개, 재시도 3회(1/5/15분) 기본값을 사용한다.
10. 하네스 재시작 후 자동 재개를 금지한다.
11. 설계 단계(`notes/architecture`)는 로컬 문서 작업만 수행한다(push/restart 제외).
12. 용어 SSOT는 `10-glossary.md`를 사용한다.
13. 실시간성 기준으로 `no_response` 3분 이상은 장애(`incident`)로 판정한다(1분은 경고).
14. 시스템 명령어 세트는 `st`, `sm`, `rs <plane>`, `replan <id>`, `!!!!!!!`, `???????`를 기본으로 사용한다.
15. `safe-mode(sm)`는 L2/L3 side effect를 차단한다.
16. `rs <plane>` 실행 시 연관 `running` 작업은 자동 중단 후 `waiting_approval`로 전환한다.
17. 위험 변경이 포함된 `replan`은 사용자 승인 없이는 실행 재진입할 수 없다.
18. comm plane은 Paperclip에서 `company + agent + issue(task)` 단위 승인/거부를 운영할 수 있다.
19. 시스템 커맨드 확정 우선순위는 `!!!!!!!`(전역 전체 중단)이며, 다른 명령은 실사용 데이터를 기반으로 튜닝한다.
20. 플레인 간 공통 메시지 Envelope 기본안은 `B`로 고정한다: `job_id`, `command_id`, `ts`, `trace_id`, `source_plane`, `target_plane`, `schema_version`, `destination_company`, `risk_level`.
21. 강화 필드(`signature`, `nonce`, `sequence`)는 DB 스키마에는 공통 컬럼으로 유지하되, 고위험 경로(`L2/L3`, 위험 변경 `replan`, 위험 작업 완료 전이, 운영 강제 명령, 승인 결정 입력)에서만 필수 검증한다.
22. 상태 전이 책임 모델은 `B+`로 고정한다: 하네스는 `state_event` 발행 전용(무상태), 전이 확정은 State plane 단일 권한으로 처리한다.
23. 상태 전이 견고성 기준은 `command_id` idempotency, at-least-once 수신 + dedup, State plane 이상 시 `L2/L3` fail-closed를 기본값으로 사용한다.
24. 승인/Grant 모델은 `B-Solo`를 기본으로 사용한다: 단일 운영자(`owner_user_id`)가 승인 권한을 가지며 `approval_id`, `plan_hash`, `risk_signature`, `grant_ttl` 검증을 필수로 한다.
25. `grant_ttl` 만료 또는 위험 변경 `replan` 발생 시 기존 승인/권한은 즉시 무효화한다.
26. 실패/재시도/타임아웃 정책은 `B`를 기본으로 한다: 명령 유형별(`request/approval/recovery/operations/query`) timeout/retry를 분리하고 backoff+jitter를 적용한다.
27. 재시도 대상은 `transient` 오류로 한정하고, `policy`/`validation` 오류는 즉시 실패 처리한다. `1분 warning`, `3분 incident` 승격 기준은 유지한다.
28. 이벤트 전달 신뢰성은 혼합 전략을 기본으로 한다: 전체 이벤트 경로는 `B`로 시작하고, 누락되면 안 되는 사용자 대상 이벤트(알림/이메일/결제/승인 결과)는 `C(outbox+relay)`를 우선 적용한다.
29. preview 외 일반 실행 동시성/스로틀은 `B`를 기본으로 한다: 동시 실행 상한을 `2~6` 범위에서 CPU/메모리/큐 대기시간 신호로 동적으로 조절하고, 초과 작업은 대기열로 흡수한다.
30. 상태/로그 보관 정책은 `B`를 기본으로 한다: 원본 데이터 `90일` 보관 후 요약/압축본을 `1년` 유지한다.
31. 명령 스코프 매트릭스는 `C`를 기본으로 한다: `global/company/job`를 기본 3단계로 사용하고 `capability`는 예외 케이스에서만 활성화한다.
32. `respawn(???????)` 해제 전 헬스체크는 `B`를 기본으로 한다: heartbeat 정상, State read/write 정상, queue lag 임계치 이내를 모두 만족해야 해제할 수 있다.
33. 자동 스위치 트리거 범위는 `B`를 기본으로 한다: 자동 조치는 `sm` + `rs comm/harness` 1회까지만 허용하고, `rs state/execution/observability`는 수동 복구로 제한한다.
34. `sm`, `rs <plane>`, `replan` 튜닝은 고정 순서(runbook order)로 강제하지 않고 상황 기반으로 선택한다.
35. 튜닝 운용 기본값은 사용자(운영자) 수동 판단이며, 자동 조치 확장 없이 33번 범위(`sm` + `rs comm/harness` 1회)만 유지한다.
