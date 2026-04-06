---
layout: post
title: "현재 NanoClaw 구조와 Codex 기본 엔진 전환 정리"
date: 2026-04-05 23:35:00 +0900
categories: [개발, 아키텍처]
tags: [NanoClaw, Nano, NanoDev, Codex, Claude, Discord, 에이전트]
description: "현재 NanoClaw 운영 구조와 nano/nano-dev 분리, Discord 중심 동작 방식, Codex를 기본 엔진으로 전환한 내용을 정리합니다."
toc: true
---

## 개요

지금의 NanoClaw는 하나의 봇이 모든 걸 직접 처리하는 단일 프로세스가 아닙니다. 크게 보면 `사용자-facing 본체`인 **nano**와, 본체를 관리하고 고치는 **nano-dev**가 분리된 구조입니다.

이 글은 현재 시점의 구조를 한 번에 정리합니다. 특히 최근 변경된 내용인 **Codex를 기본 엔진으로 붙인 메인 에이전트 구조**까지 포함합니다.

---

## 한 줄 요약

- `nano`는 사용자가 주로 대화하는 본체입니다.
- `nano-dev`는 `nano`를 관리하고 수정하는 제어기입니다.
- 두 인스턴스 모두 Discord를 기본 인터페이스로 사용합니다.
- 실제 에이전트 실행은 컨테이너 안에서 돌아갑니다.
- 최근 변경으로 `Claude 전용` 구조에서 벗어나, `Codex`도 **기본 엔진**으로 사용할 수 있게 바뀌었습니다.

---

## 전체 구조

현재 구조를 가장 단순하게 그리면 아래와 같습니다.

```text
사용자
  ↓
Discord 채널
  ├─ #nano      → nano
  └─ #nano_dev  → nano-dev

nano
  ├─ 메시지 저장 / 상태 저장
  ├─ Discord 응답
  ├─ task scheduler
  ├─ watchdog / preview / dashboard
  └─ 컨테이너 에이전트 실행

nano-dev
  ├─ nano 운영 제어
  ├─ 승인/거절/복구 명령
  ├─ dev queue / preview 제어
  ├─ watchdog 상태 확인
  └─ 컨테이너 에이전트 실행
```

핵심은 **사용자 인터페이스와 운영 제어를 분리**했다는 점입니다.  
`nano`는 사용자 입장에서 일을 처리하는 쪽이고, `nano-dev`는 그 본체를 손보는 쪽입니다.

---

## 디렉터리 기준 구조

### 1. nano

`nano`는 현재 `/Users/kebab/nano`에 있습니다.

주요 디렉터리는 아래와 같습니다.

- `src/`
  - 호스트 런타임 본체
  - Discord 연결, DB, scheduler, preview, watchdog, IPC watcher 포함
- `container/`
  - 실제 에이전트가 돌아가는 컨테이너 이미지와 agent-runner
- `groups/`
  - 그룹별 작업 폴더
  - `discord_main`, `global` 등을 포함
- `store/`
  - `messages.db`, `state.db` 등 상태 저장소
- `data/`
  - IPC, permits, sessions, preview 관련 데이터
- `dist/`
  - 빌드 산출물

### 2. nano-dev

`nano-dev`는 현재 `/Users/kebab/nano-dev`에 있습니다.

구조는 nano와 비슷하지만 역할이 다릅니다.

- `src/`
  - nano 운영 제어, dev queue, preview 제어, watchdog 상태 연계
- `container/`
  - nano-dev용 컨테이너 agent-runner
- `groups/`
  - `nano_dev`, `global` 등 제어용 그룹
- `store/`
  - 메시지, 승인, dev queue 상태 저장
- `data/`
  - IPC, permits, sessions, watchdog signal 등
- `dist/`
  - 빌드 산출물

---

## Discord 기준 역할 분리

### `#nano`

이 채널은 사용자의 기본 인터페이스입니다.

- 일반 대화
- 작업 요청
- 상태 확인
- 결과 보고
- 필요 시 승인

즉, 사용자는 대부분 이 채널만 보면 됩니다.

### `#nano_dev`

이 채널은 운영/제어용입니다.

- nano 재시작
- 중단
- 롤백
- safe-mode
- 로그 확인
- preview 제어
- watchdog 상태 확인

즉, `#nano_dev`는 사용자-facing 채널이 아니라 **운영 콘솔에 가까운 채널**입니다.

---

## 그룹 폴더와 메모리 구조

현재 에이전트는 그룹 폴더를 기준으로 동작합니다.

- `groups/discord_main`
- `groups/nano_dev`
- `groups/global`

여기서 중요한 점은 `global`이 모든 그룹에 공통으로 붙는다는 것입니다.  
즉 그룹별 지침과 공통 지침이 함께 작동합니다.

실제 컨테이너 안에서는 대략 이렇게 보입니다.

```text
/workspace/group   -> 현재 그룹 폴더
/workspace/global  -> 공통 지침
/workspace/project -> 프로젝트 루트
/workspace/ipc     -> 호스트와의 메시지/승인/이벤트 통신
/workspace/permits -> permit 파일
```

이 구조 덕분에 그룹별 역할은 분리하면서도 공통 정책은 유지할 수 있습니다.

---

## 세션 구조

에이전트는 한 번 답하고 끝나는 stateless 봇이 아니라, 그룹별 세션을 이어가는 구조입니다.

기존에는 사실상 Claude 세션 중심이었습니다.  
최근 변경 이후에는 세션 저장도 엔진별로 구분됩니다.

- `claude:<session-id>`
- `codex:<thread-id>`

이렇게 접두사를 붙여 저장하면, 같은 그룹이라도 엔진이 바뀔 때 세션이 섞이지 않습니다.

즉 현재는 아래 같은 상태가 가능합니다.

- 어떤 그룹은 Claude 세션 사용
- 어떤 그룹은 Codex 세션 사용
- 필요하면 이후 엔진 전환도 가능

---

## 왜 Codex를 기본 엔진으로 바꿨나

이전 구조는 본질적으로 **Claude 전용 런타임**이었습니다.

- 컨테이너 안 메인 에이전트 루프가 Claude SDK에 직접 연결
- 세션 재개도 Claude 기준
- 메모리 로딩도 Claude 가정이 강함

문제는 한 엔진에만 의존하면, 토큰 상황이나 사용성 측면에서 운영이 불안정해진다는 점입니다.

그래서 최근 변경의 목표는 단순히 “Codex를 보조 툴로 부르기”가 아니라,  
**Codex를 메인 엔진으로도 돌릴 수 있게 만드는 것**이었습니다.

즉 변경 방향은:

- Claude를 보조로 남겨두는 것
- Codex를 도구처럼 부르는 것

이 아니라,

- Claude와 Codex를 모두 **에이전트 엔진 후보**로 두는 것

이었습니다.

---

## 이번 Codex 기본 엔진 전환에서 바뀐 점

### 1. 컨테이너 이미지에 Codex 설치

이제 컨테이너 이미지 안에는 Claude 관련 툴뿐 아니라 Codex CLI도 들어갑니다.

즉 컨테이너 내부에서 바로 Codex를 메인 엔진으로 실행할 수 있습니다.

### 2. agent-runner에 엔진 선택 구조 추가

컨테이너 agent-runner는 이제 아래 두 경로를 가집니다.

- `claude`
- `codex`

호스트는 `ContainerInput.engine` 또는 환경변수 `AGENT_ENGINE` 기준으로 어떤 엔진을 쓸지 정합니다.

### 3. Codex용 홈 디렉터리 분리

컨테이너 안에서 Codex가 세션과 인증 정보를 유지하려면 `.codex` 홈이 필요합니다.

그래서 그룹별로 아래 같은 디렉터리를 씁니다.

```text
data/sessions/<group>/.claude
data/sessions/<group>/.codex
```

그리고 호스트의 `~/.codex`에서 필요한 인증/설정 파일을 동기화한 뒤, 컨테이너에 마운트합니다.

### 4. 서비스 기본 엔진을 Codex로 변경

현재 운영 서비스는 launchd 환경변수 기준으로 다음과 같이 설정되어 있습니다.

```text
AGENT_ENGINE=codex
```

즉 지금 시점의 `nano`, `nano-dev`는 모두 **Codex를 기본 메인 엔진으로 사용**하는 상태입니다.

---

## Codex 경로는 어떻게 동작하나

Codex는 기존 Claude SDK 루프와 방식이 다릅니다.

현재 구조에서는 Codex CLI를 다음처럼 사용합니다.

- 새 세션 시작: `codex exec --json ...`
- 기존 세션 재개: `codex exec resume --json ...`

결과는 JSONL 이벤트 스트림으로 읽고, 그 안에서:

- `thread.started`
- `item.completed`
- `turn.completed`

같은 이벤트를 파싱해서 NanoClaw의 기존 `OUTPUT_START/END` 프로토콜에 맞춰 다시 감쌉니다.

즉 바깥 호스트 입장에서는 여전히:

- 결과 문자열을 받고
- 세션 ID를 저장하고
- 다음 턴에서 이어가는

기존 모델을 유지합니다.

---

## CLAUDE.md와 Codex의 관계

여기서 이름이 조금 헷갈릴 수 있습니다.

파일 이름은 여전히 `CLAUDE.md`이지만, 지금 구조에서는 이 파일을 **Codex에도 정책 문서처럼 주입**합니다.

즉:

- Claude일 때는 기존 메모리/추가 디렉터리 로딩 방식
- Codex일 때는 `global/CLAUDE.md`, `group/CLAUDE.md` 등을 읽어서 프롬프트 앞에 붙이는 방식

으로 처리합니다.

파일 이름은 역사적으로 `CLAUDE.md`지만, 현재는 사실상 **에이전트 정책 파일**처럼 쓰이고 있습니다.

---

## nano와 nano-dev의 현재 관계

가장 중요한 구조적 원칙은 다음입니다.

### nano

- 사용자-facing 본체
- 직접 결과를 내는 쪽
- 기본 인터페이스

### nano-dev

- nano를 관리하는 제어기
- 필요 시 nano 코드를 수정
- 빌드, 재시작, revert 같은 운영 명령 수행

이 구조의 장점은, 사용자가 대화하는 본체와 그 본체를 고치는 주체를 분리할 수 있다는 점입니다.

즉 본체가 문제가 생겨도, 별도 제어 채널에서 복구 경로를 확보할 수 있습니다.

---

## 현재 블로그 구조

`discord_main` 안에는 블로그 저장소가 별도로 들어 있습니다.

```text
groups/discord_main/blog
  ├─ _posts
  ├─ _layouts
  ├─ _includes
  ├─ _data
  └─ assets
```

즉 NanoClaw는 단순히 채팅만 하는 구조가 아니라,  
실제 작업 폴더 안에 **블로그 운영 대상 저장소**까지 함께 두고 관리하는 구조입니다.

이 글도 그 `_posts` 안에 직접 저장되어 블로그에서 보이도록 작성되었습니다.

---

## 현재 시점 상태 요약

현재 운영 기준으로 보면:

- `nano`와 `nano-dev`는 분리되어 있음
- Discord 기반으로 각각 `#nano`, `#nano_dev` 역할이 나뉘어 있음
- 실제 실행은 컨테이너 안 agent-runner가 담당
- 세션은 그룹별로 관리
- 공통 정책은 `global` 그룹을 통해 전달
- preview, watchdog, state DB, remote-control 같은 운영 보조 기능이 붙어 있음
- 최근 변경으로 두 인스턴스 모두 Codex를 기본 엔진으로 사용할 수 있게 됨

현재 코드 기준 커밋은 다음과 같습니다.

- `nano`: `a9e5d77`
- `nano-dev`: `ee799f8`

둘 다 Codex를 **first-class engine**으로 다루는 변경이 반영된 상태입니다.

---

## 마무리

지금의 NanoClaw는 단순 Discord 봇이 아닙니다.  
정리하면 이것은 다음 네 가지를 동시에 갖는 구조입니다.

1. Discord를 인터페이스로 쓰는 장기 실행 에이전트
2. `nano`와 `nano-dev`로 역할을 분리한 운영 구조
3. 그룹 폴더와 공통 메모리를 함께 쓰는 작업 공간 구조
4. Claude 전용이 아니라 Codex도 기본 엔진으로 쓸 수 있는 멀티엔진 기반

앞으로 남은 과제는 “Codex를 붙였다”에서 끝나는 것이 아니라,  
이 멀티엔진 구조 위에서 작업 워크플로우, preview, 블로그 자동화, 승인 체계를 더 단순하게 다듬는 것입니다.
