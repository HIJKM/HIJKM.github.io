# 00-index

이 문서는 `notes/architecture`의 단일 진입점이다.
먼저 이 파일을 읽고 필요한 문서만 선택해서 읽는다.

## 1) 기본 구조

```text
notes/architecture/
  00-index.md
  05-core-principles.md
  10-glossary.md
  20-state-model.md
  30-approval-and-grant.md
  40-routing-and-classification.md
  50-command-taxonomy.md
  60-preview-observability.md
  70-paperclip-integration.md
  80-failure-recovery.md
  90-decisions.md
  99-open-questions.md
  important-requests.md
  dialog.md
  companies.md
  runbooks/
    restart.md
    kill-switch.md
  reference/
```

## 2) 질문별 읽기 라우팅

- 아키텍처 원칙/충돌 판단: `05-core-principles.md`
- 상태/전이/완료: `20-state-model.md`
- 승인/권한/실행 차단(`grant`): `30-approval-and-grant.md`
- 라우팅/분류/company 분기: `40-routing-and-classification.md`
- 명령 종류와 처리 plane: `50-command-taxonomy.md`
- preview/모니터링/관측: `60-preview-observability.md`
- Paperclip 연동/완료 규칙: `70-paperclip-integration.md`
- 장애/복구/킬스위치: `80-failure-recovery.md`
- 확정 결정만 빠르게 보기: `90-decisions.md`
- 미결 이슈만 보기: `99-open-questions.md`
- 사용자 중요 요청 추적: `important-requests.md`
- 대화 원문/결정 로그: `dialog.md`

## 3) 운영 규칙

- 규칙 중복 금지: 용어는 `10-glossary.md`를 SSOT로 사용한다.
- 문서 길이 제한: 파일이 길어지면 맥락별 새 파일로 분리한다.
- 설계 단계는 로컬 문서 갱신만 수행하고 push/restart는 하지 않는다.

## 4) 레거시 문서 위치

- `plan.md`, `implementation-spec.md`, `code-implementation-spec.md`는 요약/호환 진입점으로 유지한다.
- `glossary.md`는 `10-glossary.md`로 안내하는 호환용 alias 파일이다.
- 상세 규칙은 numbered 문서 세트가 기준이다.

## 5) 정리 점검 상태 (2026-04-12)

- 완료: 코어 규칙이 번호형 문서로 분리되어 탐색 경로가 명확하다.
- 완료: 4대 원칙 기준 문서(`05-core-principles.md`)를 추가했다.
- 완료: 승인 경로/운영 명령 경로 분리가 문서 전반에 일관되게 반영됐다.
- 주의: 호환용 파일(`plan.md`, `implementation-spec.md`, `code-implementation-spec.md`, `glossary.md`)은 중복 규칙을 쓰지 않고 링크/요약만 유지해야 한다.
