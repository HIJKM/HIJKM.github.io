---
layout: post
title: "Claude Agent SDK로 자율 에이전트 루프 만들기"
date: 2026-03-27 20:00:00 +0900
tags: [AI, Claude, SDK, 에이전트, 자동화]
---

Claude Agent SDK는 단순한 API 래퍼가 아닙니다. Claude Code를 만들며 검증된 에이전트 런타임 전체를 라이브러리로 열어놓은 것입니다. 이것을 이용해 목표를 스스로 평가하고 달성하는 자율 루프를 어떻게 설계할 수 있는지, 그리고 실제로 이 방식으로 무엇이 만들어지고 있는지 정리합니다.

## 루프의 구조

자율 에이전트 루프는 두 겹으로 이루어집니다.

**내부 루프 (SDK가 자동 처리)**는 Claude가 도구를 호출하고, 결과를 받아 다시 판단하고, 다음 도구를 호출하는 사이클입니다. 도구 호출이 없는 응답이 나오면 자동으로 종료됩니다. 이것이 Claude Code가 파일을 읽고 수정하고 테스트를 실행하는 방식과 완전히 동일합니다.

**외부 루프 (개발자가 작성)**는 내부 루프가 끝난 뒤 "목표가 달성됐는가?"를 판단하고, 달성되지 않았다면 세션을 이어받아 재시도하는 코드입니다.

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

async def goal_loop(goal: str, success_criteria: str, max_iterations: int = 5):
    session_id = None

    for iteration in range(1, max_iterations + 1):
        print(f"\n--- Iteration {iteration} ---")

        prompt = (
            f"목표: {goal}\n\n"
            f"성공 조건: {success_criteria}\n\n"
            "계획을 세우고 단계별로 실행하세요. "
            "마지막에 성공 조건이 충족되었는지 검증하고, "
            "달성했으면 GOAL_ACHIEVED를, 아니면 NEEDS_MORE_WORK를 출력하세요."
        ) if not session_id else (
            f"이전 작업을 이어서 목표({goal})를 향해 계속 진행하세요. "
            "성공 조건: {success_criteria}\n"
            "달성했으면 GOAL_ACHIEVED를 출력하세요."
        )

        async for msg in query(
            prompt=prompt,
            options=ClaudeAgentOptions(
                allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
                permission_mode="acceptEdits",
                max_turns=20,
                resume=session_id,
            ),
        ):
            if isinstance(msg, ResultMessage):
                session_id = msg.session_id
                if msg.subtype == "success" and "GOAL_ACHIEVED" in (msg.result or ""):
                    print(f"✅ 목표 달성 (iteration {iteration})")
                    return msg.result
                elif msg.subtype == "error_max_turns":
                    print("턴 한도 초과, 다음 반복에서 재개...")

    print(f"최대 반복 횟수 도달 ({max_iterations})")

asyncio.run(goal_loop(
    goal="인증 모듈을 JWT 방식으로 리팩토링",
    success_criteria="모든 테스트가 통과하고 린트 오류가 없을 것",
))
```

## 목표 달성 판단 방법

SDK에는 목표 달성을 자동으로 감지하는 오라클이 없습니다. 직접 설계해야 하며 네 가지 방법이 주로 쓰입니다.

**실행 가능한 체크**가 가장 확실합니다. `npm test`, `pytest`, `eslint`처럼 통과/실패가 명확한 명령어를 성공 조건으로 주면 됩니다. Claude가 결과를 직접 해석할 수 있습니다.

**센티넬 토큰**은 프롬프트에 "달성하면 `GOAL_ACHIEVED` 출력"이라고 지시하고, 외부 루프에서 그 문자열을 파싱하는 방식입니다.

**PostToolUse Hook**은 Bash 도구 결과에 `"FAILED"`나 `"ERROR"`가 포함되면 자동으로 Claude에게 피드백을 주입합니다. 토큰을 소비하지 않고 루프에 개입할 수 있습니다.

```python
async def guide_on_failure(input_data, tool_use_id, context):
    if input_data.get("hook_event_name") == "PostToolUse":
        output = str(input_data.get("tool_response", ""))
        if "error" in output.lower() or "failed" in output.lower():
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PostToolUse",
                    "additionalContext": (
                        "마지막 명령에서 오류가 발생했습니다. "
                        "다음 단계로 넘어가기 전에 원인을 진단하세요."
                    ),
                }
            }
    return {}
```

**LLM-as-judge**는 주관적인 기준이 있을 때 Claude 자신이 달성 여부를 평가하게 하는 방법입니다. 비용이 더 들지만 자동 체크가 불가능한 경우에 유용합니다.

## Hooks로 루프 제어하기

Hook은 Claude의 컨텍스트 바깥에서 실행되므로 토큰을 소비하지 않습니다. 위험한 명령을 차단하고, 실패를 감지해 가이드를 주입하고, 루프를 강제 종료할 수 있습니다.

```python
async def safety_hook(input_data, tool_use_id, context):
    event = input_data.get("hook_event_name")

    if event == "PreToolUse" and input_data.get("tool_name") == "Bash":
        command = input_data.get("tool_input", {}).get("command", "")
        if any(x in command for x in ["rm -rf /", "DROP TABLE", "DELETE FROM"]):
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "위험한 명령어가 감지되어 차단했습니다.",
                }
            }
    return {}
```

주요 Hook 종류와 용도는 다음과 같습니다.

| Hook | 용도 |
|------|------|
| `PreToolUse` | 도구 실행 전 검증, 위험 명령 차단 |
| `PostToolUse` | 결과 감지, 가이드 주입 |
| `Stop` | 최종 결과 검증, 상태 저장 |
| `SubagentStart/Stop` | 병렬 서브에이전트 추적 |
| `PreCompact` | 압축 전 전체 대화 보관 |

## 세션 유지 전략

세션은 `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`에 저장됩니다. 프로세스를 재시작해도 `resume=session_id`로 이어받을 수 있습니다.

장기 작업에서는 세션 하나가 모든 것을 기억하게 하는 대신, **`progress.txt` + `CLAUDE.md` 패턴**이 더 안정적입니다. 매 세션 시작 시 진행 상황 파일을 읽고, 종료 시 업데이트하게 합니다. Git 커밋도 자연스러운 체크포인트가 됩니다.

```markdown
# CLAUDE.md
매 세션 시작 시:
1. progress.txt를 읽어 현재 상태 파악
2. git log로 최근 커밋 확인
3. 테스트 스위트 실행으로 현재 통과 여부 확인

작업 완료 시:
- progress.txt 업데이트
- 변경사항 커밋
```

## 멀티에이전트 아키텍처

복잡한 목표는 하나의 에이전트가 모두 처리하는 것보다 전문화된 에이전트들이 협력하는 방식이 더 효과적입니다.

**오케스트레이터 + 전문 서브에이전트** 패턴이 가장 일반적입니다. 오케스트레이터는 계획과 라우팅만 담당하고 좁은 권한을 가집니다. 서브에이전트는 각각 하나의 역할만 수행합니다.

```
Orchestrator (계획, 라우팅)
  ├── Researcher  (Read, Grep 전용)
  ├── Implementer (Read, Edit, Bash)
  └── Tester      (Bash 전용)
```

`Task` 도구를 `allowedTools`에 포함하면 서브에이전트 스폰이 가능합니다. 단, 서브에이전트 자신의 도구 목록에는 `Task`를 넣지 않아야 합니다. 재귀적 스폰은 지원되지 않습니다.

## 주요 주의사항

**컨텍스트 창이 조용히 꽉 찹니다.** 큰 Bash 출력 하나로 수천 토큰이 소비됩니다. `max_turns`를 20~30으로 제한하고, 독립적인 하위 작업은 서브에이전트로 분리하세요.

**컴팩션 후 초기 지시가 사라집니다.** 컨텍스트가 꽉 차면 SDK가 자동으로 요약합니다. 이때 초반 프롬프트의 핵심 규칙이 손실될 수 있습니다. 중요한 지시는 `CLAUDE.md`에 두세요. 매 요청마다 재주입됩니다.

**목표 망각이 발생합니다.** 긴 세션에서 도구 결과가 쌓이면 원래 목표를 잃어버릴 수 있습니다. 반복마다 목표를 프롬프트에 다시 명시하거나, `TodoWrite` 도구로 태스크 목록을 유지하게 하세요.

**세션은 로컬에 저장됩니다.** CI/컨테이너 환경에서는 세션 파일을 함께 이동하거나, 중요한 결과를 애플리케이션 상태로 캡처해 다음 세션 프롬프트에 주입하는 방식으로 설계하세요.

## 실제 사례들

### Ruflo (claude-flow)

가장 많이 참조되는 오픈소스 오케스트레이션 프레임워크입니다. GitHub 스타 약 2만 개. Claude Agent SDK를 기반으로 퀸-워커 계층 구조의 에이전트 스웜을 구현합니다. SWE-Bench 84.8% 달성을 주장하며, WASM 커널로 단순 결정성 작업은 LLM 호출 없이 처리해 API 비용을 75% 절감한다고 보고합니다. Claude Agent SDK가 단일 에이전트를 다루는 레이어라면, Ruflo는 그 위에서 스웜을 오케스트레이션하는 레이어로 포지셔닝합니다.

- GitHub: [ruvnet/ruflo](https://github.com/ruvnet/ruflo), [ruvnet/claude-flow](https://github.com/ruvnet/claude-flow)

### SecureVibes

Claude Agent SDK의 멀티에이전트 패턴으로 구현한 보안 취약점 스캐너입니다. 다섯 전문 에이전트가 순차적으로 동작합니다.

```
Assessment Agent → Threat Modeling Agent → Code Review Agent
                                         → DAST Agent (선택)
                                         → Report Generator
```

단일 에이전트 Claude 대비 취약점 발견 수가 4배 이상(4~5개 → 16~17개)이었다고 보고합니다. 11개 언어를 지원하며, `PreToolUse` Hook으로 `rm -rf` 등 위험 명령을 차단합니다.

- GitHub: [anshumanbh/securevibes](https://github.com/anshumanbh/securevibes)

### Ralph Loop

목표를 반복적으로 달성하는 자율 루프 패턴입니다. Claude의 종료 시도를 `Stop` Hook으로 가로채어 같은 프롬프트를 재공급하고, 완료 선언 문자열(`GOAL_ACHIEVED`)이 나오거나 반복 한도에 도달하면 종료합니다. **Git을 메모리 레이어로 활용**합니다. 각 사이클마다 커밋하고, 다음 사이클은 Git 상태에서 컨텍스트를 재구성합니다.

Anthropic 내부에서 C 컴파일러 프로젝트에 이 패턴을 적용해 약 2,000개의 세션을 돌려 Linux 커널을 컴파일할 수 있는 컴파일러를 완성했다고 알려져 있습니다.

- GitHub: [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code)
- 공식 플러그인: [claude.com/plugins/ralph-loop](https://claude.com/plugins/ralph-loop)

### BGL × Amazon Bedrock AgentCore

12,700개 이상 기업에 SMSF 관리 솔루션을 제공하는 BGL의 프로덕션 BI 에이전트 사례입니다. Claude Agent SDK와 AWS Bedrock AgentCore를 결합해 세션 관리와 스케일링을 처리합니다. Bedrock AgentCore는 메모리 영속성, ID 통합, 관찰 가능성, 코드 실행 샌드박스를 제공하는 관리형 플랫폼으로, Claude Agent SDK와 프레임워크 무관하게 연동됩니다.

- 사례 포스트: [AWS Machine Learning Blog](https://aws.amazon.com/blogs/machine-learning/democratizing-business-intelligence-bgls-journey-with-claude-agent-sdk-and-amazon-bedrock-agentcore/)

### claude-code-security-review

GitHub Action으로 배포된 공식 Anthropic 프로젝트입니다. CI/CD 파이프라인에서 코드 diff를 Claude로 분석해 보안 취약점을 자동으로 리뷰합니다.

- GitHub: [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review)

## 패턴 요약

| 패턴 | 적합한 상황 |
|------|-------------|
| 단순 목표 루프 | 단일 세션으로 끝나는 작업 |
| Initializer + Incremental Coder | 여러 세션에 걸친 장기 작업 |
| Orchestrator + 전문 서브에이전트 | 병렬 처리 또는 역할 분리가 필요한 작업 |
| Ralph Loop (Git 메모리) | 수백~수천 반복이 필요한 대규모 자동화 |
| WASM Fast-Path (Ruflo) | 단순 결정성 작업이 많은 고빈도 에이전트 |

## 참고 자료

- Anthropic Engineering — [Building Agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- Anthropic Engineering — [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Anthropic Research — [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- 공식 문서 — [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- 공식 데모 — [claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos)
- Python SDK — [claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python)
- SecureVibes 분석 — [CyberSecurityNews](https://cybersecuritynews.com/securevibes/)
- BGL 사례 — [AWS ML Blog](https://aws.amazon.com/blogs/machine-learning/democratizing-business-intelligence-bgls-journey-with-claude-agent-sdk-and-amazon-bedrock-agentcore/)
- Sitepoint 가이드 — [The Developer's Guide to Autonomous Coding Agents](https://www.sitepoint.com/the-developers-guide-to-autonomous-coding-agents-orchestrating-claude-code-ruflo-and-deerflow/)
