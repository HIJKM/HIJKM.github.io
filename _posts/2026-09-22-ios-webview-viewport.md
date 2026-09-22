---
layout: post
title: "innerHeight만 믿으면 안 되는 이유: iOS WebView viewport 진단"
date: 2026-09-22 10:00:00 +0900
categories: [웹, 모바일]
tags: [WebView, viewport, visualViewport, safe-area, iOS]
description: "iOS WebView에서 화면 하단 여백과 노치 침범을 디버깅하며 viewport API가 서로 다른 값을 나타내는 이유를 정리했습니다."
toc: true
---

모바일 PWA에서 하단에 여백이 생기고, 어떤 화면에 들어갔다 나오면 다시 정상으로 보이는 문제가 있었다. 처음에는 CSS의 `padding`이나 `100dvh` 하나를 고치면 해결될 거라고 생각했다.

> “치유 안 먹음. 증상 여전함. 대신 채팅 페이지 들어가면 멀쩡해짐”

하지만 이 문제는 화면 안의 여백 하나가 아니라, 브라우저·WebView·safe area가 서로 다른 높이를 보고 있는 문제였다.

## 화면에는 여러 개의 높이가 있다

가장 먼저 네 값을 동시에 기록해야 한다.

```js
function readViewport() {
  const html = document.documentElement;
  const visual = window.visualViewport;

  return {
    innerHeight: window.innerHeight,
    visualHeight: visual ? visual.height : null,
    visualOffsetTop: visual ? visual.offsetTop : null,
    htmlClientHeight: html.clientHeight,
    htmlBoxHeight: html.getBoundingClientRect().height,
    rootBoxHeight: document.querySelector("#root")?.getBoundingClientRect().height ?? null
  };
}
```

각 값은 비슷해 보이지만 같은 의미가 아니다.

- `window.innerHeight`: 현재 브라우저 창이 보고하는 layout viewport 높이
- `visualViewport.height`: 실제로 사용자가 보고 있는 visual viewport 높이
- `documentElement.clientHeight`: 문서의 initial containing block과 관련된 값
- `getBoundingClientRect().height`: 특정 요소가 실제로 그려진 상자 높이

특히 `clientHeight`를 실제 `<html>` 상자 높이처럼 비교하면 잘못된 진단을 만들 수 있다. 노치가 있는 기기에서는 상태바와 small viewport의 영향으로 둘이 다를 수 있다. 요소의 실제 크기를 알고 싶으면 `getBoundingClientRect()`로 측정해야 한다.

## `100vh`, `100dvh`, `100svh`는 무엇이 다른가

모바일 브라우저에서는 주소창과 키보드가 나타나면서 보이는 영역이 계속 달라진다.

- `svh`: 작은 viewport 기준
- `lvh`: 큰 viewport 기준
- `dvh`: 현재 동적으로 변하는 viewport 기준

`100dvh`가 현재 보이는 영역에 맞는 것처럼 보여도, WebView의 네이티브 프레임이나 safe area inset이 잘못 남아 있으면 CSS만 바꿔서는 해결되지 않는다. 반대로 `100svh`가 실제 문제를 가리는 경우도 있다.

그래서 CSS를 바꾸기 전에 다음을 확인해야 한다.

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

.app-shell {
  min-height: 100dvh;
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
}
```

## 증상을 고치는 것보다 분류하는 것이 먼저다

하단에 47px이 남았다고 해서 무조건 `padding-bottom: 47px`를 추가하면 안 된다. 그 47px이 다음 중 무엇인지 먼저 구분해야 한다.

1. 앱 루트가 실제로 짧은가
2. visual viewport만 짧게 보고 있는가
3. safe area가 중복 적용됐는가
4. WebView 바깥 네이티브 프레임에 여백이 있는가
5. 이전 키보드 상태의 inset이 남아 있는가

이 구분 없이 보정값을 쌓으면 한 화면에서는 고쳐지고 다른 화면에서는 노치가 침범하는 식으로 증상이 교환된다. 채팅 화면 진입 후 정상화되는 것도 “채팅 화면의 CSS가 정답”이라는 뜻이 아니라, 화면 전환 과정에서 WebView가 레이아웃을 다시 계산했을 가능성을 보여주는 단서다.

## 정리

- viewport API마다 측정 대상이 다르다.
- `clientHeight`와 실제 요소 상자 높이를 혼동하면 잘못된 진단을 한다.
- 모바일 viewport 문제는 CSS, visual viewport, WebView 프레임, safe area를 함께 기록해야 한다.
- 숫자를 보정하기 전에 그 숫자가 어느 레이어에서 생겼는지 분류해야 한다.

참고: [VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [CSS viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/length#relative_length_units_based_on_viewport), [env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
