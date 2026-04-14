# Dialog Channel (Architecture)

이 파일은 `notes/architecture` 범위 의사결정을 위한 에이전트 간 공용 로그입니다.

## Rules

1. 새 메시지는 아래 `Messages` 섹션 맨 아래에 추가합니다.
2. 타임스탬프는 `YYYY-MM-DD HH:mm (KST)` 형식으로 기록합니다.
3. 결정된 내용은 `Decisions`에, 미결 사항은 `Open Questions`에 옮깁니다.
4. 사용자 발화는 가능하면 원문을 함께 기록합니다.
5. 사용자 발화 중 중요 요청사항은 `important-requests.md`에도 함께 기록합니다.

## Messages

- 2026-04-11 17:25 (KST) system: Dialog file initialized.
- 2026-04-11 17:32 (KST) system: Scope fixed to `notes/architecture` only. Added README, code implementation spec, and reference research note.
- 2026-04-11 17:58 (KST) user: Routing should classify destination company (not work/research label). Harness decides, user approves. Simple questions are answered directly by harness. Harness approval for all except simple questions. Paperclip approval only for risky tasks.
- 2026-04-11 18:42 (KST) user/system: System commands and approvals are Discord-only for this architecture. Paperclip dashboard remains separate (existing operation). Added Discord-first end-to-end workflow checkpoints.
- 2026-04-11 18:43 (KST) user/system: System commands differ by purpose. Added command taxonomy (request/approval/recovery/operations/query) and fixed responsible plane per command type.
- 2026-04-11 19:51 (KST) user/system: Paperclip dashboard user approval/monitoring is included in control plane. System operations commands remain Discord path.
- 2026-04-11 21:23 (KST) user(raw): "그리고 앞으로 dialog에 사용자가 어떻게 얘기했눈지도 추가해주세요. 다른 에이전투가 볼 수 있게."
- 2026-04-11 21:23 (KST) user(raw): "아니아니 5,6번만 하면 돼요. 지금 하는 작업은 최초에 부여한 코드수정이 아니고 아키텍처 설계니까요."
- 2026-04-11 21:23 (KST) user(raw): "6번에 대해: 푸시, restart도 진행하지 않도록 합시다. 로컬에서만 계획하고 추후 아키텍처 설계시에만 활용 예정입니다"
- 2026-04-11 22:52 (KST) user(raw): "상황맥락이 날아가서 다시 설명드리죠... notes/architecture 폴더 내용 전부 읽어보고 오세요... 이전까지 얘기했던 내용 브리핑 해주세요."
- 2026-04-11 22:57 (KST) user(raw): "그냥 현재 브리핑한 내용 다 적절하게 파일에 먼저 반영해주세요"
- 2026-04-11 23:34 (KST) user(raw): "사용자가 대화 중에서 언급한 것 중 중요한 요청사항인 경우 저장해주세요."
- 2026-04-11 23:35 (KST) user(raw): "기본 구조를 언급하고, plan 구성은 전체 아키텍처/운영원칙 중심으로. 말씀한 구조로 이전. 시작 전/완료 후 커밋."
- 2026-04-12 11:31 (KST) user(raw): "제가 얘기한 가장 중요한 원칙 4가지 기억나요? ... 그게 빠져있어요. 추가해주시고, 폴더 내 정리가 잘됐는지 평가해서 다시 정리해주세요."
- 2026-04-12 12:46 (KST) user(raw): "거의 전부 실시간성이라고 보시면 됩니다만, 제한 없이 뒀다가 느려제면 장애로 판단해야겠죠 그런 상황을 말씀하시는 거면 몇분 이상 미응답시 장애 판단 정도는 넣어도 될 것 같네요"
- 2026-04-12 12:47 (KST) user(raw): "앞으로 모든 수정 직전 확인받고 사용자가 '네'라고 대답할 때만 수정하세요"
- 2026-04-12 13:24 (KST) user(raw): "unlock은 뭐에요? plane별 재기동은 있으면 좋지 않을까 싶은데..."
- 2026-04-12 13:48 (KST) user(raw): "replan도 명령어에 넣어는 주세요 ... respawn은 ??????? ... 킬 스위치는 !!!!!!!"
- 2026-04-12 14:03 (KST) user(raw): "완료된 내용은 문서에 반영해주세요"
- 2026-04-12 23:58 (KST) user(raw): "킬 스위치를 확실하게 잡고, 나머지는 실사용해보면서 잡아가야 할 것 같아서..."
- 2026-04-13 07:34 (KST) user(raw): "플레인 간의 API 및 통신 규약 정도만 잡고 나머지는 애초에 교체가능한 모델로 설계했으니 만들면서 정리하려고 하는데 꼭 짚고 넘어가야 할 부분이 있을까요?"
- 2026-04-13 07:50 (KST) user(raw): "db저장은 동일하게 하고 고위험 경로만 해당 필드를 채우나요"
- 2026-04-13 07:51 (KST) user(raw): "오키 확정. 다음 보여주세요"
- 2026-04-13 07:53 (KST) user(raw): "2번을 하네스의 무상태성 및 전체 시스템의 견고성 측면에서 재평가 해주실래요?"
- 2026-04-13 08:00 (KST) user(raw): "좋습니다 확정. 반영하세요. c안도 동일 방식으로 설명해주세요"
- 2026-04-13 08:03 (KST) user(raw): "b 저밖에 안 써요."
- 2026-04-13 08:04 (KST) user(raw): "네"
- 2026-04-13 08:24 (KST) user(raw): "b옵션 자세히 설명"
- 2026-04-13 08:28 (KST) user(raw): "네"
- 2026-04-13 20:45 (KST) user(raw): "결론부터 말하면, 네. 사용자에게 보내는 알림/이메일 같은 건 relay(outbox) 쓰는 게 좋습니다. 기준은 간단합니다. B로 충분: 내부용, 실패해도 큰 문제 없는 이벤트. C(=outbox+relay) 권장: 사용자 알림, 결제, 승인 결과처럼 빠지면 안 되는 이벤트. 실무에선 보통 이렇게 갑니다: 전체는 B로 시작하고, 중요한 사용자 이벤트만 C로 먼저 적용. 그렇게 적어주세요."
- 2026-04-13 21:28 (KST) user(raw): "미논의 항목은 쉽게 설명하고 3가지 안으로 제안. 선택: 2=B, 3=B, 4=C, 5=B. 1번(`rs` 실행 조건)과 6번은 추가 논의."
- 2026-04-13 23:56 (KST) user(raw): "자동 스위치 트리거 b"
- 2026-04-13 23:56 (KST) user(raw): "튜닝 시나리오는 잘 모르겠어요. 뭔가 순서대로 한다 이것보다는 다른 방식으로 생각해봐야 할 것 같은데…"
- 2026-04-14 00:49 (KST) user(raw): "보낸 파일 한글로 번역본 만들어서 보내주세요. 튜닝 원칙은 원래 확정했던 harness, comm 자동 rs와 sm 자동 진입 내용 확정된 거 참고하여 충돌하지 않게 작성해주세요."
- 2026-04-14 00:54 (KST) user(raw): "architecture 폴더 안에 있는 건 다 커밋, 이후 아까 요청한 수정 후 커밋. 그리고 번역본은 따로 만들어서 저장하고 보내주세요"

## Decisions

- Request routing decision point is "which Paperclip company to dispatch to".
- Harness classifies routing candidate and user approves before dispatch.
- Simple questions are handled directly by harness and do not require dispatch.
- Harness-level approval is required for all non-simple-question requests.
- Paperclip approval is required only for risky tasks.
- Preview concurrency cap: 3.
- Retry policy on preview failure: up to 3 retries, then mark as error.
- System command path: Discord only.
- Approval/review path: Discord or Paperclip Dashboard.
- Paperclip dashboard: included in control plane for user approval/monitoring.
- Canonical job state flow: `draft -> in_view -> waiting_approval -> approved -> running -> in_review -> done|failed|cancelled`.
- `in_view` and `pending_approval` are distinct terms (`pending_approval` is umbrella wording for `waiting_approval`/`in_review`).
- Routing first key is `destination_company`; `intent_type` and `risk_level` are secondary classifiers.
- `grant` token is mandatory for risky execution and completion transition.
- Glossary SSOT location: `notes/architecture/10-glossary.md`.
- Architecture design phase is local-doc only (no push/restart operation).
- Important user requests must be persisted in `notes/architecture/important-requests.md`.
- Documentation structure is modularized with numbered files (`00/10/20/...`) and `plan.md` is maintained as high-level architecture/ops principles.
- Core principle SSOT: `05-core-principles.md` (유연성/견고성/가시성/접근성, 동등 중요).
- Command processing is purpose-based:
  - request command -> Comm/State/Harness
  - approval command -> (Discord) Comm/State/Harness or (Paperclip) Harness Adapter/State/Harness
  - recovery command -> Comm/Harness/State
  - operations command -> Comm/Ops/State
  - query command -> Comm/State/Observability
- Real-time incident threshold is fixed: `no_response >= 3 minutes` => incident (`1 minute` => warning).
- Restart operation is plane-scoped (`rs <plane>`), and related running jobs move to `waiting_approval`.
- Safe mode blocks L2/L3 side effects.
- Emergency shortcuts are fixed as `kill-switch=!!!!!!!`, `respawn=???????`.
- `replan` is part of command set and requires user approval on risk-changing plans.
- Paperclip supports comm-plane orchestration at `company + agent + issue(task)` granularity.
- System command finalization priority is kill-switch-first (`!!!!!!!`), while other commands are tuned with operational data.
- Inter-plane message envelope baseline is fixed to option `B`: `job_id`, `command_id`, `ts`, `trace_id`, `source_plane`, `target_plane`, `schema_version`, `destination_company`, `risk_level`.
- Hardening fields `signature`, `nonce`, `sequence` are stored in the same DB schema and required only on high-risk paths.
- State transition ownership is fixed to `B+`: harness is stateless event emitter, State plane is the only transition authority.
- Robustness baseline for transition path is fixed: `command_id` idempotency + at-least-once receive with dedup + fail-closed on `L2/L3` when State plane is degraded.
- Approval/Grant model is fixed to `B-Solo` for single-operator use: owner-only approval with required verification fields `approval_id`, `plan_hash`, `risk_signature`, `grant_ttl`.
- Existing approval is invalidated immediately on `grant_ttl` expiry or risk-changing `replan`.
- Failure/retry/timeout policy is fixed to option `B` with command-type-specific timeout/retry and backoff+jitter.
- Retry target is limited to transient failures; `policy`/`validation` errors fail fast. Escalation keeps `1 minute warning`, `3 minutes incident`.
- Event delivery reliability policy uses hybrid baseline: keep global event transport on `B`, and apply `C(outbox+relay)` first to must-not-miss user-facing events (notification/email/payment/approval result).
- Non-preview concurrency/throttle is fixed to option `B`: dynamic cap `2~6` based on CPU/memory/queue wait, with overflow queued (no drop).
- Retention/storage is fixed to option `B`: keep raw events/logs `90 days`, then summary/compressed archive for `1 year`.
- Command scope matrix is fixed to option `C`: `global/company/job` default, enable `capability` only for exceptions.
- `respawn(???????)` unlock gate is fixed to option `B`: require healthy heartbeat, State read/write checks, and queue lag within threshold.
- Auto safety-switch trigger scope is fixed to option `B`: allow only `sm` + one-time automatic `rs` for `comm/harness`, then require manual recovery.
- Tuning for `sm`, `rs <plane>`, `replan` is scenario-based (no fixed operation order).
- Default tuning operation is operator-led manual control; automatic actions stay limited to `sm` + one-time `rs comm/harness`.

## Open Questions

- Scenario-based tuning is fixed; remaining question is which thresholds to standardize for `no_response`, error rate, queue lag, and running-job impact.
