# 99-open-questions

## 미결 사항

참고: 상황 기반 튜닝 원칙 자체는 확정했다(고정 순서 미사용, 사용자 수동 판단 우선, 자동 조치는 `sm + rs comm/harness 1회` 제한).

1. 상황 기반 판단 신호의 표준 임계값을 어디까지 고정할 것인가?
   - 후보 신호: `no_response` 지속시간, plane별 오류율, queue lag, 영향받는 `running` 작업 수
