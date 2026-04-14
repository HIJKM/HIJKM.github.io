# implementation-spec

이 문서는 구현 스펙 진입점이다.
세부 규칙은 아래 모듈 문서를 합쳐서 읽는다.

## 1) 필수 읽기

1. `10-glossary.md`
2. `05-core-principles.md`
3. `20-state-model.md`
4. `30-approval-and-grant.md`
5. `40-routing-and-classification.md`
6. `50-command-taxonomy.md`
7. `60-preview-observability.md`
8. `70-paperclip-integration.md`
9. `80-failure-recovery.md`

## 2) 구현 고정값 요약

- 4대 원칙(유연성/견고성/가시성/접근성)은 동등 중요하며, 모든 설계 변경에서 동시에 점검한다.
- 상태 전이: `draft -> in_view -> waiting_approval -> approved -> running -> in_review -> done|failed|cancelled`
- 승인 강제: `grant` 없으면 위험 실행/완료 전이 차단
- 라우팅 우선순위: `destination_company -> intent_type -> risk_level`
- 명령 경로: 운영은 Discord 단일, 승인은 Discord + Paperclip 병행
- preview 기본값: 동시 3개, 재시도 3회(1/5/15분)

## 3) 상세 결정/미결

- 확정 결정: `90-decisions.md`
- 미결 항목: `99-open-questions.md`
- 사용자 우선 요청: `important-requests.md`
