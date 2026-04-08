---
layout: post
title: "nano · nano-dev 전체 아키텍처와 코드 구조 보고서"
date: 2026-04-08 15:10:00 +0900
categories: [개발, 아키텍처]
tags: [NanoClaw, nano, nano-dev, Codex, Claude, Discord, Dashboard, Watchdog]
description: "현재 운영 중인 nano와 nano-dev의 전체 아키텍처, 주요 코드 경로, 세션 구조, 상태 저장, 대시보드와 watchdog 흐름까지 한 번에 정리한 보고서입니다."
toc: true
---

## 개요

지금 운영 중인 시스템은 단일 봇 하나가 모든 일을 처리하는 구조가 아닙니다. 크게 보면 **사용자 업무 처리 본체인 `nano`**와, 그 본체를 관리하고 고치고 복구하는 **제어기 `nano-dev`**가 분리되어 있습니다.

이 글은 현재 시점의 `nano`, `nano-dev` 전체 구조를 코드 기준으로 다시 정리한 보고서입니다. 단순 개념 설명이 아니라 실제 코드가 어떤 역할로 나뉘어 있는지, 데이터와 세션이 어디에 저장되는지, Discord와 컨테이너가 어떤 식으로 이어지는지까지 포함합니다.

---

## 한 줄 요약

- `nano`는 사용자와 대화하며 실제 작업을 수행하는 본체입니다.
- `nano-dev`는 `nano`를 재시작, 복구, 빌드, 롤백, preview 제어하는 운영 제어기입니다.
- 두 인스턴스 모두 Discord를 주 인터페이스로 사용합니다.
- 실제 에이전트 실행은 컨테이너 내부의 `agent-runner`가 담당합니다.
- 메인 엔진은 이제 `Claude`와 `Codex`를 모두 지원하며, 채널별로 전환할 수 있습니다.
- 상태 저장은 `messages.db`와 `state.db`로 나뉘고, watchdog/preview/control action도 별도 추적합니다.

---

## 전체 구조

가장 단순한 그림은 아래와 같습니다.

```text
사용자
  ↓
Discord
  ├─ #nano      → nano
  └─ #nano_dev  → nano-dev

nano
  ├─ Discord 수신/응답
  ├─ 메시지/세션/상태 저장
  ├─ 컨테이너 에이전트 실행
  ├─ dashboard / lab server / preview gateway
  └─ watchdog 대상 본체

nano-dev
  ├─ nano 상태 조회
  ├─ restart / stop / build / revert / safe-mode
  ├─ preview 생성/종료
  ├─ watchdog 신호 수신 및 운영 관제
  └─ nano 제어용 컨테이너 에이전트 실행
```

핵심은 **사용자-facing 채널과 운영 채널을 분리**했다는 점입니다. 사용자는 대부분 `#nano`에서 상호작용하고, `#nano_dev`는 운영 제어와 복구를 위한 콘솔 역할을 합니다.

---

## 디렉터리 기준 구조

## `nano`

현재 `nano`는 `/Users/kebab/nano`에 있습니다.

주요 디렉터리:

- `src/`
  호스트 런타임 본체입니다. Discord, DB, dashboard, preview, scheduler, IPC watcher가 여기 있습니다.
- `container/`
  실제 컨테이너 이미지와 `agent-runner`가 있습니다.
- `groups/`
  그룹별 작업 폴더입니다. 현재 주요 그룹은 `discord_main`, `global`, `main`입니다.
- `store/`
  `messages.db`, `state.db`가 있습니다.
- `data/`
  IPC, permits, sessions, watchdog, log archive 등 런타임 데이터가 저장됩니다.
- `logs/`
  서비스 로그가 남습니다.
- `dist/`
  빌드 산출물입니다.

## `nano-dev`

현재 `nano-dev`는 `/Users/kebab/nano-dev`에 있습니다.

주요 디렉터리:

- `src/`
  nano 제어용 명령, dev queue, 승인, preview 제어, watchdog signal watcher가 있습니다.
- `container/`
  nano-dev용 agent-runner입니다.
- `groups/`
  `nano_dev`, `global`, `main`이 있습니다.
- `store/`
  `messages.db`, `state.db`와 dev queue/pending approval 상태가 저장됩니다.
- `data/`
  IPC, permits, sessions가 저장됩니다.
- `logs/`
  nano-dev 서비스 로그가 남습니다.
- `dist/`
  빌드 산출물입니다.

---

## 역할 분리

## nano

`nano`는 사용자가 직접 체감하는 본체입니다.

담당하는 일:

- Discord에서 메시지를 받는다
- 시스템 명령과 일반 대화를 분기한다
- 그룹별 컨테이너 에이전트를 실행한다
- 응답과 로그를 Discord에 다시 보낸다
- dashboard, lab server, preview read path를 제공한다
- watchdog의 감시 대상이 된다

즉 `nano`는 실제 업무 수행 엔진입니다.

## nano-dev

`nano-dev`는 `nano`를 관리하는 제어기입니다.

담당하는 일:

- `!status`, `!restart`, `!stop`, `!revert`, `!build`, `!safe-mode`
- `!preview`, `!preview-close`
- 현재 엔진/모델/세션 확인과 전환
- pending approval 처리
- dev queue 관리
- watchdog signal 수신 후 운영 채널로 보고

즉 `nano-dev`는 일반 사용자 작업보다 **운영 제어와 복구**에 초점이 있습니다.

---

## Discord와 호스트 런타임

두 인스턴스 모두 `src/index.ts`가 Discord 메시지 수신의 시작점입니다.

흐름은 대체로 같습니다.

1. Discord에서 메시지를 받는다.
2. 시스템 명령이면 호스트 레벨에서 바로 처리한다.
3. 일반 작업이면 그룹 큐에 태운다.
4. 호스트가 컨테이너를 띄우고 `container/agent-runner`에 입력을 넘긴다.
5. 컨테이너가 결과와 이벤트를 IPC에 쓴다.
6. 호스트가 그 이벤트를 읽어 Discord 로그 채널과 대시보드에 반영한다.

이 구조 덕분에 위험한 운영 명령은 AI가 아니라 호스트 코드가 직접 처리하고, 일반 작업만 컨테이너 에이전트에게 넘길 수 있습니다.

---

## 시스템 명령 구조

## nano 명령

현재 `nano`에는 대표적으로 아래 명령이 있습니다.

- `!status`
- `!status <id>`
- `!approve <id>`
- `!reject <id>`
- `!model`
- `!switch <claude|codex>`
- `!help`
- `!remote-control`
- `!remote-control-end`

여기서 중요한 것은 `!model`, `!switch`가 이미 들어가 있어서 채널 기준 엔진 전환과 확인이 가능하다는 점입니다.

## nano-dev 명령

`nano-dev`에는 운영 명령이 더 많이 있습니다.

- `!status`
- `!model`
- `!switch <claude|codex>`
- `!restart`
- `!stop`
- `!revert [hash]`
- `!build`
- `!safe-mode`
- `!preview <path> [minutes]`
- `!preview-close <preview_id>`
- `!help`

즉 `nano-dev`는 작업 수행보다는 **서비스 제어판** 역할이 강합니다.

---

## 에이전트 엔진 구조

현재 컨테이너 `agent-runner`는 더 이상 Claude 전용이 아닙니다. 코드상 `claude | codex` 분기를 가지고 있습니다.

핵심 포인트는 아래와 같습니다.

- `container/agent-runner/src/index.ts`에서 엔진을 판별합니다.
- `runClaudeQuery(...)`와 `runCodexQuery(...)`가 분리되어 있습니다.
- 저장 세션도 `claude:<id>`와 `codex:<id>`로 분리됩니다.
- 채널에서 `!switch`를 치면 그 채널의 기본 엔진을 바꿀 수 있습니다.

즉 현재 구조는 “Codex를 보조 도구로 한 번 부르는 것”이 아니라, **메인 에이전트 엔진 자체를 Claude/Codex 중 하나로 선택 가능한 구조**입니다.

---

## Claude 경로와 Codex 경로의 차이

## Claude

Claude 경로는 SDK 기반입니다.

- `query(...)` 스트림 사용
- `resume`, `resumeSessionAt` 사용
- `PreCompact` 훅 사용
- transcript archive 생성 가능

이 경로는 세션 compaction 훅이 있어 장기 세션 관리 선례가 이미 있었습니다.

## Codex

Codex 경로는 CLI와 JSON 이벤트 스트림 기반입니다.

- `codex exec`
- `codex exec resume`
- JSON 이벤트 파싱
- hooks + event stream 혼합 로그

Codex에는 Claude SDK의 `PreCompact`에 대응하는 구조가 없기 때문에, 지금은 별도의 **soft compaction** 정책을 추가했습니다.

---

## Codex 세션 롤오버 구조

최근 추가된 가장 중요한 부분 중 하나가 여기입니다.

기존 문제는 같은 `codex:` 세션을 너무 오래 이어 쓰면서 컨텍스트가 비대해지는 것이었습니다. 그래서 지금은 그룹별로 아래 파일을 기록합니다.

- `.session/codex-runtime-state.json`
- `.session/active-codex-summary.md`

이 파일들에는 아래 정보가 들어갑니다.

- 현재 세션 ID
- query 수
- turn 수
- item 수
- tool item 수
- 최근 usage
- 마지막 사용자 요청 요약
- 마지막 assistant 응답 요약
- 최근 Codex 이벤트 요약

그리고 아래 조건 중 하나를 넘으면 세션을 새로 엽니다.

- `input_tokens >= 120000`
- `query_count >= 24`
- `item_count >= 160`

롤오버 시에는:

1. 현재 상태를 `active-codex-summary.md`로 저장
2. `session_rotate` 이벤트 기록
3. 기존 세션 참조를 끊음
4. 다음 Codex 세션 시작 시 summary를 프롬프트 앞에 붙여 carry-over

즉 현재 Codex는 완전한 compact API는 없지만, 운영적으로는 **요약 기반 세션 교체**를 수행하도록 바뀌었습니다.

---

## 상태 저장 구조

## messages.db

메시지와 그룹 상태의 기본 저장소입니다.

주로 저장되는 것:

- registered groups
- 그룹 메타데이터
- 일반 대화 관련 데이터

## state.db

운영 상태 추적을 위한 보조 저장소입니다.

`nano` 쪽에서는 대표적으로 아래가 있습니다.

- `tasks`
- `task_events`
- `control_actions`
- `preview_sessions`
- `watchdog_events`

`nano-dev` 쪽에서는 아래가 중요합니다.

- `pending_approvals`
- `dev_queue`
- `control_actions`
- `preview_sessions`

즉 `messages.db`는 기본 메시지/그룹 저장, `state.db`는 운영 제어와 상태 추적입니다.

---

## Preview 구조

Preview는 `nano-dev`가 만들고 `nano`가 보여주는 구조에 가깝습니다.

흐름은 이렇습니다.

1. 사용자가 `#nano_dev`에서 `!preview <path> [minutes]` 실행
2. nano-dev가 허용 경로인지 확인
3. `preview_sessions`에 세션 생성
4. `nano`의 dashboard/preview 경로가 해당 preview를 서빙
5. `!preview-close <id>`로 종료 가능

즉 preview는 `nano-dev`가 제어하고, 실제 서빙은 `nano`가 맡습니다.

---

## Dashboard와 Lab Server

현재 `nano`는 dashboard와 lab server를 둘 다 가집니다.

- dashboard
  상태, preview, 파일트리, 이벤트 뷰 등 운영 관측용
- lab server
  별도 showcase / 실험용 서버

최근 구조에서는 dashboard 접근 목적 자체가 로컬 전용이 아니라 **Tailscale을 통한 원격 확인**으로 확장되었습니다. 그래서 대시보드는 로컬 브라우저 디버그용이 아니라 운영 관측면의 의미도 큽니다.

현재 파일트리 기준 최상위는 다음 세 폴더를 보여주도록 정리되었습니다.

- `nano`
- `nano-dev`
- `Lab`

즉 운영 중 코드를 원격에서 훑어볼 수 있는 관측 인터페이스 역할도 겸합니다.

---

## Watchdog 구조

watchdog는 `nano`를 감시하는 별도 프로세스입니다.

역할:

- 프로세스 생존 확인
- IPC 상태 확인
- 반복 크래시 감지
- `state.db`의 `watchdog_events` 기록
- `data/watchdog/signal.json` 기록

그리고 `nano-dev`는 이 signal 파일을 읽어 운영 채널에서 상태를 보여줍니다.

즉 구조는 아래와 같습니다.

```text
com.nano-watchdog
  ↓
state.db / signal.json 기록
  ↓
nano-dev signal watcher
  ↓
#nano_dev 에 상태 보고
```

이렇게 분리되어 있어야 감시자와 피감시자가 같은 실패 도메인에 묶이지 않습니다.

---

## IPC와 이벤트 로그

호스트와 컨테이너는 `/workspace/ipc` 아래 파일 기반 IPC를 사용합니다.

주요 흐름:

- 입력: `/workspace/ipc/input`
- 이벤트: `/workspace/ipc/events`
- permit: `/workspace/permits`

컨테이너는 아래 같은 이벤트를 씁니다.

- `assistant_text`
- `tool_use`
- `tool_result`
- `codex_event`
- `codex_error`
- `session_start`
- `session_stop`
- `session_rotate`

호스트 watcher는 이 파일을 읽은 뒤:

- Discord 로그 채널에 반영
- dashboard recent event에 반영
- raw archive JSONL에 저장
- 원본 이벤트 파일 삭제

즉 현재 로그 관측은 “순간 이벤트 파일 → 소비 → 아카이브” 구조입니다.

---

## 보안 경계

현재 구조에서 중요한 경계는 아래와 같습니다.

- `nano`는 자기 프로젝트를 직접 수정하지 못하도록 read-only 경계가 중요합니다.
- `nano-dev`는 `PROJECT_TARGET_DIR`이 반드시 명시돼야 하며 자기 자신을 target으로 잡으면 안 됩니다.
- host tools는 게이팅이 있어야 하고, 꺼져 있으면 우회가 없어야 합니다.
- 위험한 실행은 permit/approval 경계를 타야 합니다.
- 운영 명령은 AI 자연어가 아니라 시스템 명령으로 처리해야 합니다.

즉 이 시스템의 핵심은 단순 자동화가 아니라 **권한 경계가 있는 자동화**입니다.

---

## 지금 구조의 장점

현재 구조의 장점은 명확합니다.

- 사용자 채널과 운영 채널이 분리되어 있습니다.
- 메인 에이전트와 제어기가 분리되어 있습니다.
- 세션, preview, watchdog, control action이 상태 저장으로 추적됩니다.
- Claude와 Codex를 동등한 엔진 후보로 다룰 기반이 있습니다.
- dashboard와 Discord 로그를 통해 관측성이 높습니다.

즉 단순 챗봇이 아니라 **운영 가능한 장기 실행 에이전트 시스템**에 가깝습니다.

---

## 지금 구조의 남은 과제

반대로 남아 있는 과제도 있습니다.

- `dev queue` 워크플로우는 아직 더 단순한 UX로 다듬을 여지가 있습니다.
- preview 생성 흐름은 작업 스펙과 더 자연스럽게 통합될 수 있습니다.
- Codex soft compaction 임계치는 실제 사용량을 보며 더 조정해야 합니다.
- 로그는 많이 모인 뒤 다시 한 번 노이즈를 줄여야 합니다.
- 장기적으로는 작업 단위를 issue/spec 중심으로 더 추상화할 필요가 있습니다.

즉 구조는 상당히 정리되었지만, 사용성 면에서는 아직 더 다듬을 수 있습니다.

---

## 결론

현재 `nano`와 `nano-dev`는 다음과 같이 볼 수 있습니다.

- `nano`
  사용자와 실제로 일하는 메인 에이전트 런타임
- `nano-dev`
  메인 에이전트를 제어하고 복구하는 운영 제어기

그리고 그 아래에는:

- 컨테이너 에이전트 런타임
- Discord 시스템 명령
- 상태 저장 DB
- preview/dashboard/watchdog
- Claude/Codex 멀티엔진 구조

가 조합되어 있습니다.

즉 지금의 시스템은 “Discord 봇”이라기보다, **Discord를 인터페이스로 쓰는 분리형 에이전트 운영 플랫폼**에 더 가깝습니다.

앞으로의 개선은 새 구조를 또 크게 뒤엎기보다, 지금 만든 경계와 상태 추적을 유지하면서 UX와 워크플로우를 더 단순하게 만드는 방향이 맞습니다.
