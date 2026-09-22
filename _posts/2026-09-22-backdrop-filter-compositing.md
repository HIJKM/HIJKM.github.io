---
layout: post
title: "backdrop-filter는 뒤의 DOM을 복사하는 유리가 아니다"
date: 2026-09-22 11:00:00 +0900
categories: [웹, CSS]
tags: [CSS, backdrop-filter, compositing, glassmorphism]
description: "글래스모피즘 UI에서 이미지 배경은 비치지만 텍스트와 실시간 위젯은 기대처럼 투영되지 않는 이유를 정리했습니다."
toc: true
---

글래스모피즘을 만들면서 이미지 배경은 흐려지고 색이 섞이는데, 뒤에 있는 텍스트나 실시간 위젯은 유리 너머로 보이지 않는 현상을 만났다.

> “텍스트랑 그 화면에 실시간으로 그려지는 웹 위젯 같은 것들은 글래스의 투영이 안 돼 이미지같은거 배경만 투영 되더라 왜 그런 거야”

처음에는 `backdrop-filter`가 뒤에 있는 모든 것을 실시간으로 복사해 보여주는 속성이라고 생각했다. 실제로는 “뒤에서 이미 칠해진 픽셀에 필터를 적용하는 속성”에 가깝다.

## `filter`와 `backdrop-filter`는 방향이 반대다

`filter`는 요소 자신과 그 콘텐츠에 적용된다.

```css
.photo {
  filter: blur(8px) saturate(130%);
}
```

`backdrop-filter`는 반투명한 요소 뒤쪽 영역에 적용된다.

```css
.glass-card {
  background: rgb(255 255 255 / 18%);
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
}
```

이 카드의 텍스트는 카드의 앞쪽 콘텐츠이므로 `backdrop-filter`의 대상이 아니다. 텍스트는 필터링된 배경 위에 별도로 그려진다.

```text
뒤쪽 픽셀 → backdrop-filter → 반투명 카드 배경
                               ↑
                         카드의 텍스트는 별도 레이어
```

따라서 글래스 카드 안에 있는 텍스트가 흐려지지 않는 것은 실패가 아니다. 그것이 속성의 방향이다.

## 왜 어떤 배경은 보이고 어떤 콘텐츠는 안 보이는가

브라우저는 모든 DOM을 하나의 평면 이미지로 먼저 합친 뒤 필터링하지 않는다. 여러 레이어와 합성 경계를 관리하면서 화면을 그린다. `opacity`, `filter`, `transform`, `will-change` 같은 속성은 새로운 합성 경계나 backdrop root를 만들 수 있다.

부모 요소가 backdrop root가 되면 자식의 `backdrop-filter`가 볼 수 있는 범위가 그 경계 안으로 제한될 수 있다. 그래서 같은 CSS라도 다음 조건에 따라 결과가 달라진다.

- 필터 요소가 실제 배경 위에 있는가
- 요소와 배경 사이에 불투명한 레이어가 있는가
- 부모가 새로운 backdrop root를 만들었는가
- 원하는 콘텐츠가 같은 합성 트리에 있는가

## “뒤의 실시간 화면”이 필요하다면

`backdrop-filter`만으로 다른 DOM의 최신 렌더 결과를 복사해 보여줄 수는 없다. 그런 효과가 필요하다면 선택지는 달라진다.

1. 같은 데이터를 사용해 배경과 위젯을 두 번 렌더링한다.
2. 화면을 캡처해 이미지나 canvas로 합성한다.
3. WebGL/WebGPU에서 장면을 직접 렌더링한다.
4. 글래스 효과의 목표를 “뒤 콘텐츠 투영”이 아니라 “배경 대비와 깊이감”으로 낮춘다.

대부분의 제품 UI에서는 네 번째가 가장 싸고 안정적이다. 글래스 카드는 데이터를 보여주는 창이 아니라, 콘텐츠 위에 놓인 반투명한 표면으로 설계하는 편이 브라우저의 합성 모델과 잘 맞는다.

## 정리

- `filter`는 자기 자신을 필터링한다.
- `backdrop-filter`는 요소 뒤쪽 픽셀에 필터를 적용한다.
- 카드 안의 텍스트와 위젯은 backdrop의 대상이 아니다.
- 합성 경계와 불투명한 부모는 필터가 볼 수 있는 범위를 바꾼다.
- 실제 DOM 투영이 필요하면 중복 렌더링·캔버스·WebGL 같은 다른 설계가 필요하다.

참고: [`backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter), [CSS compositing and blending](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Compositing_and_blending)
