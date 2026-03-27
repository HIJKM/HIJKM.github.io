---
layout: post
title: "Style Test — 위젯 양식 확인"
description: "헤더, 텍스트, 인용문, 코드블럭, 목록 등 모든 요소의 스타일을 한눈에 확인하는 테스트 페이지입니다."
date: 2026-03-27 10:00:00 +0900
tags: [test, design]
---

본문 텍스트입니다. Lora 세리프 폰트, 1.2rem, line-height 1.75로 렌더링됩니다. 문단 사이 간격과 가독성을 확인할 수 있습니다. **굵은 텍스트**는 이렇게 표시되고, *이탤릭*은 이렇게 표시됩니다. [링크는 밑줄과 함께](https://example.com) 표시됩니다.

---

## H2 제목

H2는 DM Sans 1.5rem bold입니다. 섹션을 구분하는 주요 헤딩으로 사용합니다.

두 번째 문단입니다. 문단과 문단 사이의 여백, 헤딩과 본문 사이의 여백을 확인하세요.

### H3 제목

H3는 1.2rem으로 H2보다 약간 작습니다. 하위 섹션에 사용합니다.

H3 아래의 본문 텍스트입니다. 들여쓰기 없이 자연스럽게 이어집니다.

---

## 인용문 (Blockquote)

일반 문단 다음에 인용문이 옵니다.

> 좋은 디자인은 가능한 한 적게 디자인하는 것이다. 순수함으로 돌아가고, 단순함으로 돌아가라.
> — Dieter Rams

> 여러 줄에 걸친 인용문도 확인합니다. 인용문 안의 줄 간격과 좌측 보더가 깔끔하게 표시되어야 합니다.
> 두 번째 줄입니다.

인용문 다음의 일반 문단입니다.

---

## 코드 블럭

인라인 코드는 `const x = 42` 이렇게 표시됩니다. 배경색과 패딩, 폰트가 적용됩니다.

JavaScript 코드 블럭:

```javascript
// D3.js force simulation 예시
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).id(d => d.id).distance(80))
  .force('charge', d3.forceManyBody().strength(-200))
  .force('center', d3.forceCenter(width / 2, height / 2));

simulation.on('tick', () => {
  link
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  node.attr('transform', d => `translate(${d.x},${d.y})`);
});
```

Python 코드 블럭:

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find and fix the bug in auth.py",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash"],
            permission_mode="acceptEdits",
        ),
    ):
        print(message)
```

Shell 명령어:

```bash
git add .
git commit -m "feat: add knowledge graph"
git push origin main
```

---

## 불렛 목록 (Unordered List)

단일 수준의 불렛 목록입니다:

- 첫 번째 항목입니다
- 두 번째 항목입니다
- 세 번째 항목으로 좀 더 긴 텍스트를 포함합니다. 줄 바꿈이 발생할 때의 들여쓰기 정렬을 확인하세요
- 네 번째 항목입니다

---

## 번호 목록 (Ordered List)

순서가 있는 목록입니다:

1. 첫 번째 단계를 실행합니다
2. 두 번째 단계로 넘어갑니다
3. 세 번째 단계에서 결과를 확인합니다
4. 마지막 단계에서 정리합니다

---

## 표 (Table)

| 항목 | 설명 | 비고 |
|------|------|------|
| Read | 파일 읽기 | 읽기 전용 |
| Edit | 파일 수정 | 기존 파일 |
| Write | 파일 생성 | 신규 파일 |
| Bash | 터미널 명령 | 주의 필요 |
| Glob | 파일 패턴 검색 | `**/*.ts` |

---

## 혼합 사용 예시

실제 문서에서는 여러 요소가 혼합됩니다. 아래는 그 예시입니다.

Jekyll 블로그를 설정하려면 다음 단계를 따릅니다:

1. `_config.yml`에서 기본 설정을 완료합니다
2. `_layouts/default.html`에 공통 레이아웃을 정의합니다
3. `assets/css/main.css`에서 스타일을 커스터마이즈합니다

> **참고:** `future: true` 설정을 추가해야 미래 날짜의 포스트가 표시됩니다.

설정 파일 예시:

```yaml
title: HIJKM
url: "https://hijkm.github.io"
future: true
markdown: kramdown
highlighter: rouge
```

주요 디렉토리 구조:

- `_posts/` — 블로그 포스트 (YYYY-MM-DD-title.md)
- `_layouts/` — HTML 레이아웃 템플릿
- `assets/` — CSS, JS, 이미지
- `graph-data.json` — 지식 그래프 데이터
