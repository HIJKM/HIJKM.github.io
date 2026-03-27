---
layout: post
title: "Claude Agent SDK 완전 가이드"
date: 2026-03-27 15:00:00 +0900
tags: [AI, Claude, SDK, 에이전트]
---

Claude Agent SDK는 Anthropic이 Claude Code를 구동하는 런타임 인프라를 라이브러리 형태로 공개한 것입니다. Python(`claude-agent-sdk`)과 TypeScript(`@anthropic-ai/claude-agent-sdk`)를 지원하며, Claude Code가 갖춘 도구 실행·에이전트 루프·컨텍스트 관리 기능을 그대로 사용자 애플리케이션에 가져올 수 있습니다.

## 작동 방식

SDK는 Claude Code CLI를 서브프로세스로 실행하고 stdin/stdout을 통해 NDJSON 프로토콜로 통신합니다. 사용자 애플리케이션과 CLI가 별개 프로세스로 분리되어 있기 때문에 역할 분담이 명확합니다.

- **Anthropic이 관리**: 대화 관리, 도구 오케스트레이션, API 통신, 오류 복구
- **개발자가 관리**: 커스텀 도구 정의, 권한 정책, 데이터 처리 로직

CLI는 SDK 설치 시 자동으로 번들되므로 별도 설치가 필요 없습니다.

## 설치

**TypeScript**

```bash
npm install @anthropic-ai/claude-agent-sdk
```

**Python**

```bash
uv add claude-agent-sdk
# 또는
pip install claude-agent-sdk
```

Node.js 18+ 또는 Python 3.10+ 환경이 필요하며, `ANTHROPIC_API_KEY` 환경변수를 설정해야 합니다. Amazon Bedrock, Google Vertex AI, Microsoft Azure도 지원합니다.

## 핵심 API — query()

메인 진입점은 `query()` 함수로, 에이전트가 작업하는 동안 타입이 지정된 메시지를 스트리밍으로 yield하는 **비동기 제너레이터**를 반환합니다.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const messages = query({
  prompt: "현재 디렉토리의 파일 목록을 알려줘",
  options: {
    allowedTools: ["Read", "Glob"],
  },
});

for await (const message of messages) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

yield되는 메시지 타입은 네 가지입니다.

- `AssistantMessage` — Claude의 추론 과정, 텍스트 및 도구 블록 포함
- `ResultMessage` — 최종 결과, subtype(예: "success") 포함
- `SystemMessage` — session_id 포함
- `SystemInitMessage` — 초기 시스템 설정

## 세션 관리

대화 세션은 `~/.claude/projects/<encoded-cwd>/*.jsonl`에 디스크에 저장됩니다. 파일시스템 상태는 저장되지 않고 **대화 기록만 유지**됩니다.

### 멀티턴 세션 (Python)

```python
async with ClaudeSDKClient(options=options) as client:
    await client.query("첫 번째 질문")
    async for message in client.receive_response():
        process(message)

    await client.query("두 번째 질문")   # 동일 세션 자동 유지
    async for message in client.receive_response():
        process(message)
```

세션 모드는 다음과 같이 나뉩니다.

- **One-Shot**: CLI 인수로 단일 프롬프트 실행
- **Interactive**: stdin/stdout으로 멀티턴
- **Continue**: 가장 최근 세션 자동 재개
- **Resume by ID**: 특정 과거 세션 지정 재개
- **Fork**: 기존 세션을 분기하여 새 세션 ID 생성

## 권한 모드

| 모드 | 동작 | 적합한 상황 |
|------|------|-------------|
| `acceptEdits` | 파일 편집 자동 승인, 나머지는 질문 | 신뢰된 개발 워크플로 |
| `dontAsk` | `allowedTools` 외 모든 것 거부 | 잠긴 헤드리스 에이전트 |
| `bypassPermissions` | 모든 도구 프롬프트 없이 실행 | 샌드박스 CI 환경 |
| `default` | `canUseTool` 콜백으로 커스텀 승인 | 맞춤형 승인 플로 |

## Hooks — 이벤트 콜백

Hook은 에이전트 이벤트에 반응하여 커스텀 코드를 실행하는 메커니즘입니다. 작업 차단, 로깅/감사, 데이터 변환, 수동 승인 요구, 생명주기 추적 등에 활용합니다.

**주요 Hook 종류**

- `PreToolUse` / `PostToolUse` / `PostToolUseFailure` — 도구 실행 전후
- `UserPromptSubmit` — 사용자 프롬프트 제출 시
- `Stop` — 에이전트 중지 시
- `SubagentStart` / `SubagentStop` — 서브에이전트 시작/종료
- `PreCompact` — 컨텍스트 압축 직전
- `PermissionRequest` — 권한 요청 시
- `SessionStart` / `SessionEnd` — 세션 시작/종료 (TypeScript 전용)

`PreToolUse` Hook의 콜백은 `permission` 결정(allow/deny/ask), `reason`, `updatedInput`을 반환할 수 있습니다. `PostToolUse`는 `additionalContext`를 모델에 추가로 전달할 수 있습니다.

## 멀티에이전트 아키텍처

### 서브에이전트

하나의 세션 안에서 동작하며, 각 서브에이전트는 자체 컨텍스트 윈도우를 가져 작업이 서로 오염되지 않습니다.

```typescript
options: {
  allowedTools: ["Read", "Edit", "Task"],  // Task가 있어야 서브에이전트 스폰 가능
}
```

> 서브에이전트 자신의 `allowedTools`에는 `Task`를 포함시키지 마세요. 서브에이전트는 재귀적으로 자신의 서브에이전트를 생성할 수 없습니다.

### 에이전트 팀

별도 세션 간에 병렬 작업과 통신으로 조율합니다. Claude가 언제 병렬화할지 스스로 결정하며, 개발자는 능력(capability)만 정의합니다.

## 도구 조합 예시

| 도구 조합 | 가능한 작업 |
|-----------|-------------|
| `Read`, `Glob`, `Grep` | 읽기 전용 분석 |
| `Read`, `Edit`, `Glob` | 코드 분석 및 수정 |
| `Read`, `Edit`, `Bash`, `Glob`, `Grep` | 완전 자동화 |

## 파일시스템 기반 설정

`setting_sources=["project"]` 옵션 설정 시 프로젝트 디렉토리에서 구성을 로드합니다.

| 기능 | 경로 |
|------|------|
| Skills | `.claude/skills/SKILL.md` |
| Slash commands | `.claude/commands/*.md` |
| Memory | `CLAUDE.md` 또는 `.claude/CLAUDE.md` |

## 프로덕션 배포

**Amazon Bedrock AgentCore**는 AI 에이전트 운영을 위한 AWS 관리형 플랫폼입니다. 메모리 영속성, ID 통합, 관찰 가능성, 코드 실행 샌드박스를 제공하며 Claude Agent SDK, LangChain 등 프레임워크에 무관하게 동작합니다.

## Client SDK vs Agent SDK

| | Client SDK | Agent SDK |
|-|-----------|-----------|
| 도구 루프 | 개발자가 직접 구현 | Claude가 자율 실행 |
| 제어권 | 높음 | 낮음 |
| 복잡도 | 높음 | 낮음 |
| 적합한 용도 | 세밀한 제어가 필요한 경우 | 범용 에이전트 워크플로 |

Claude Agent SDK는 단순한 API 래퍼가 아니라, Claude Code를 만들며 검증된 에이전트 런타임 전체를 라이브러리로 제공한다는 점에서 차별화됩니다. 복잡한 도구 오케스트레이션과 멀티에이전트 협업이 필요한 애플리케이션에 특히 강점을 발휘합니다.
