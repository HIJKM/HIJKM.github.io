---
title: "Jekyll 블로그에 옵시디언 스타일 지식 그래프 추가하기"
date: 2026-03-23 08:00:00 +0900
categories: [개발]
tags: [Jekyll, 옵시디언, D3.js, 지식관리, 블로그]
description: "D3.js force simulation을 활용해 Jekyll 블로그에 옵시디언 스타일 지식 그래프를 구현하는 방법"
toc: true
---

## 왜 지식 그래프인가?

옵시디언(Obsidian)의 가장 강력한 기능 중 하나는 **지식 그래프(Graph View)**입니다. 모든 노트가 어떻게 연결되어 있는지 시각적으로 보여주죠.

이 그래프를 Jekyll 블로그에도 넣고 싶었습니다. 독자들이 글을 읽으면서 **연관된 글들이 어떻게 연결되는지** 바로 볼 수 있다면, 탐색 경험이 훨씬 풍부해질 것이라 생각했습니다.

## 구현 개요

```
Jekyll 빌드 시:
  - 모든 포스트의 태그를 수집
  - 공통 태그를 가진 포스트들을 엣지로 연결
  - graph-data.json 생성

브라우저에서:
  - graph-data.json 로드
  - D3.js force simulation으로 렌더링
  - 현재 페이지 강조 표시
```

## 핵심 기술: D3.js Force Simulation

D3.js의 `forceSimulation`은 물리 기반 레이아웃 엔진입니다.

```javascript
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links)
    .id(d => d.id)
    .distance(70))          // 노드 간 거리
  .force('charge', d3.forceManyBody()
    .strength(-180))        // 노드 간 반발력
  .force('center', d3.forceCenter(0, 0))  // 중심으로 당기는 힘
  .force('collision', d3.forceCollide().radius(20));  // 충돌 방지
```

### 주요 Force 설명

| Force | 역할 |
|-------|------|
| `forceLink` | 연결된 노드들을 적절한 거리로 유지 |
| `forceManyBody` | 노드 간 반발력 (음수 = 밀어냄) |
| `forceCenter` | 전체를 중앙으로 당김 |
| `forceCollide` | 노드 겹침 방지 |

## graph-data.json 생성 (Liquid 템플릿)

Jekyll의 Liquid 템플릿으로 빌드 타임에 그래프 데이터를 생성합니다:

```liquid
---
layout: null
---
{% raw %}
{
  "nodes": [
    {% for post in site.posts %}
    {
      "id": "{{ post.url | slugify }}",
      "title": {{ post.title | jsonify }},
      "url": "{{ post.url }}",
      "tags": {{ post.tags | jsonify }}
    }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ],
  "links": [
    // 공통 태그를 가진 포스트들을 연결
    ...
  ]
}
{% endraw %}
```

## 인터랙션 구현

### 호버 효과 — 연결된 노드 강조

```javascript
node.on('mouseover', function(event, d) {
  // 연결된 노드 ID 수집
  const connected = new Set([d.id]);
  links.forEach(l => {
    if (l.source.id === d.id) connected.add(l.target.id);
    if (l.target.id === d.id) connected.add(l.source.id);
  });

  // 연결 안 된 노드 흐리게
  node.classed('dimmed', n => !connected.has(n.id));
  link.classed('highlighted', l =>
    l.source.id === d.id || l.target.id === d.id
  );
});
```

### 클릭으로 글 이동

```javascript
node.on('click', (event, d) => {
  window.location.href = d.url;
});
```

## 현재 페이지 강조

가장 중요한 기능 중 하나입니다. 현재 읽고 있는 글을 그래프에서 바로 확인할 수 있어야 합니다.

```javascript
// Jekyll이 현재 페이지 URL을 전달
window.CURRENT_PAGE = "{{ page.url }}";

// D3에서 현재 노드 강조
node.classed('current', d => d.url === currentUrl);
```

CSS에서 펄스 애니메이션 적용:

```css
.graph-node.current circle {
  filter: drop-shadow(0 0 6px var(--accent));
  animation: pulse 2s ease-in-out infinite;
}
```

## 줌 & 패닝

```javascript
const zoom = d3.zoom()
  .scaleExtent([0.3, 3])
  .on('zoom', (event) => {
    g.attr('transform', event.transform);
  });

svg.call(zoom);
```

## 결과물

구현 결과, 오른쪽 패널에서 다음을 볼 수 있습니다:

- 🔵 **파란 노드** — 현재 읽고 있는 글
- 🟢 **초록 노드** — 직접 연결된 글
- ⬜ **회색 노드** — 다른 글들
- **선(엣지)** — 공통 태그로 연결된 관계

## 다음 단계

- [ ] 태그 외에도 글 내용의 `[[링크]]` 파싱
- [ ] 카테고리별 색상 구분
- [ ] 그래프 전용 전체 화면 페이지 (`/graph`)
- [ ] 노드 클러스터링 (비슷한 주제끼리 그룹화)

지식 그래프는 블로그를 단순한 글 목록이 아닌, **살아있는 지식 네트워크**로 만들어줍니다. 🌐
