---
layout: post
title: "agent.md 메모를 현재 NanoClaw 구조에 붙이기"
date: 2026-04-05 23:48:00 +0900
categories: [개발, 아키텍처]
tags: [NanoClaw, 에이전트, 워크플로우, Codex, 블로그, 자동화]
description: "memo/agent.md의 아이디어를 현재 nano/nano-dev 구조에 어떻게 접목할지 정리한 글입니다."
toc: true
---

## 출발점

`memo/agent.md`에는 한 문장으로 요약하면 이런 고민이 담겨 있습니다.

> 에이전트를 어떻게 효율적으로, 상시적으로, 통합적으로, 내 전체 맥락을 공유하며 사용할 것인가

이 메모는 툴 목록보다 방향성이 중요합니다.

- 생활 자동화
- 블로그 자동화
- 자료 습득 자동화
- 실제 제품 설계 워크플로우 체험
- 툴에 매몰되지 않고 실력을 넓히는 구조

즉 목표는 “AI 툴을 많이 붙이기”가 아니라,  
**에이전트를 일상과 개발에 자연스럽게 편입하는 운영 구조**를 만드는 것입니다.

---

## 현재 구조와의 연결

지금 NanoClaw는 이미 그 기반을 갖고 있습니다.

- `nano`: 사용자 인터페이스
- `nano-dev`: 운영 제어와 코드 변경
- Discord 중심 인터페이스
- 블로그 저장소 내장
- preview, watchdog, state DB
- 최근 추가된 Codex 기본 엔진

그래서 지금 필요한 것은 새 거대한 프레임워크가 아니라,  
기존 구조 위에 `작업 흐름`을 정리하는 일입니다.

---

## 어떤 워크플로우를 붙이는 게 맞나

Anthropic은 에이전트 시스템을 만들 때 단순한 패턴부터 시작하라고 권합니다.  
출처: <https://www.anthropic.com/engineering/building-effective-agents>

현재 구조에 잘 맞는 패턴은 네 가지입니다.

### 1. Prompt chaining

블로그와 리서치는 단계가 비교적 명확합니다.

- 주제 선정
- 자료 수집
- 요약
- 초안 작성
- 평가
- 저장

즉 이 영역은 완전 자율 에이전트보다, 단계형 체인으로 다루는 것이 더 안정적입니다.

### 2. Routing

사용자가 하는 말은 다 같은 종류가 아닙니다.

- 일반 질문
- 블로그 요청
- 조사 요청
- 코드 수정 요청
- 운영 명령

따라서 시스템이 먼저 요청을 분류해 적절한 lane으로 보내는 구조가 중요합니다.

### 3. Orchestrator-workers

복잡한 개발 작업은 중앙 오케스트레이터가 워커를 쓰는 방식이 맞습니다.

하지만 모든 작업을 swarm으로 보낼 필요는 없습니다.  
여러 파일 변경, 대규모 조사, 설계 비교처럼 복잡한 경우에만 쓰는 편이 낫습니다.

### 4. Evaluator-optimizer

블로그 초안, 설계 문서, UI 결과물은 “한 번에 끝내기”보다 평가 루프가 중요합니다.

즉:

- 생성
- 평가
- 수정

루프를 붙여야 결과 품질이 안정됩니다.

---

## 메모에 나온 도구들은 어떻게 볼까

### Codex CLI

이건 이미 코어에 들어왔습니다.  
지금 `nano`와 `nano-dev`는 모두 Codex를 기본 엔진으로 쓸 수 있습니다.

### oh-my-codex (OMX)

문서 기준 OMX는 orchestration, autoresearch, team worktrees, notifications 같은 기능을 강조합니다.  
출처: <https://yeachan-heo.github.io/oh-my-codex-website/docs.html>

전부를 가져오는 것은 과합니다.  
대신 아래 개념은 차용 가치가 큽니다.

- autoresearch
- team worktrees
- intent-first interview
- state continuity

### oh-my-openagent

이 도구의 핵심은 planner, executor, reviewer 같은 역할 분리입니다.  
출처: <https://ohmyopenagent.com/>

이 역시 전체를 들이기보다:

- 계획과 실행 분리
- 검증 루프 분리
- 세션 continuity

정도만 가져오는 것이 현재 구조에 맞습니다.

### clawhip

메모에서는 Git/PR/에이전트 상태 감시와 Discord 알림 도구로 적혀 있습니다.

현재 구조는 이미 watchdog, dashboard, Discord 알림이 있으므로,  
완전히 새 제품을 붙이기보다 **현재 알림 체계를 확장**하는 것이 더 자연스럽습니다.

### awesome-design-md

이건 오히려 실도입 가치가 높습니다.

블로그, showcase, preview 대상 UI에 `DESIGN.md`를 붙이면,  
에이전트가 더 일관된 프론트 결과물을 만들 수 있습니다.

---

## 실제 접목 방향

현재 구조에 메모의 아이디어를 붙이면 아래 순서가 가장 자연스럽습니다.

### 1. 자료 수집 라인

- Apple 메모
- 외부 링크
- 조사 자료

를 Markdown으로 모으고, nano가 이를 정리해 research 노트로 바꿉니다.

### 2. 블로그 생산 라인

- 주제 정리
- 조사
- 아웃라인
- 초안
- 평가
- `_posts` 저장

블로그는 가장 먼저 자동화 가치가 높은 영역입니다.

### 3. 개발 작업 라인

- 요청 수집
- 계획 작성
- 승인
- 실행
- 검증
- 완료 보고

여기서 중요한 건 명령 수를 늘리는 것이 아니라,  
`작업 질문인지`, `실제 실행 요청인지`, `운영 명령인지`를 분리하는 것입니다.

### 4. 평가 루프

블로그, 설계, UI, 코드 결과물마다 reviewer pass를 얹어야 합니다.

즉 메모의 방향을 실제 구조에 접목하는 핵심은 `더 많은 툴`이 아니라,  
**더 좋은 루프**입니다.

---

## 결론

`agent.md`는 지금 봐도 방향이 맞습니다.  
다만 지금 필요한 것은 새로운 거대 플랫폼 도입이 아니라, 이미 갖춘 구조를 다음처럼 다듬는 일입니다.

- 입력은 routing
- 블로그와 리서치는 chaining
- 복잡한 개발 작업만 orchestrator-workers
- 중요한 결과물에는 evaluator loop

그리고 도구는 전면 도입보다 개념 차용이 더 적절합니다.

즉 앞으로의 NanoClaw는 “무엇을 더 붙일까”보다,  
**현재 구조 안에서 어떻게 더 적은 조작으로 더 좋은 흐름을 만들까**가 핵심이 됩니다.
