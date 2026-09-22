---
layout: post
title: "SPA는 페이지를 없애는 게 아니라 상태 전환을 관리하는 방식이다"
date: 2026-09-22 09:00:00 +0900
categories: [웹, 프론트엔드]
tags: [SPA, PWA, History API, JavaScript]
description: "PWA에서 페이지 이동이 뒤로가기와 화면 상태를 어떻게 바꾸는지 직접 부딪히며 이해한 History API의 핵심입니다."
toc: true
---

PWA에서 화면을 이동할 때마다 브라우저의 뒤로가기가 생기는 문제가 있었다. 화면 안에서 패널만 바꾸고 싶었는데, 브라우저는 그것을 새로운 페이지 방문으로 기록했다.

> “다른 페이지로 넘어가버리면 pwa에서는 뒤로가기가 생기더라구. 그래서 가급적 전체페이지 어떤 이동이든 SPA식으로 처리했으면 해”

이 문제를 겪고 나서 SPA를 “페이지가 하나뿐인 앱”이라고 이해하면 부족하다는 걸 알게 됐다. SPA의 핵심은 문서(document)를 다시 로드하지 않고도, 애플리케이션 상태와 브라우저의 탐색 기록을 함께 바꾸는 데 있다.

## 페이지 이동과 상태 전환은 다르다

전통적인 웹 앱에서 링크를 클릭하면 브라우저는 새 문서를 요청한다.

```text
현재 문서 → 새 URL 요청 → 새 문서 로드 → 화면 초기화
```

이 방식은 문서 단위로 이동해야 하는 사이트에는 자연스럽다. 하지만 모바일 앱처럼 화면 위에 패널을 열고 닫거나, 채팅 목록과 상세 화면을 빠르게 오가는 경우에는 매번 문서를 다시 로드할 필요가 없다.

SPA는 다음처럼 동작한다.

```text
현재 문서 → 상태 변경 → 필요한 데이터 요청 → 일부 UI 갱신
```

여기서 URL도 같이 바꾸고 싶다면 History API를 사용한다. `history.pushState()`는 문서를 다시 로드하지 않고 세션 히스토리에 항목을 추가한다. 사용자가 뒤로가기를 누르면 `popstate` 이벤트가 발생하고, 애플리케이션은 그 상태에 맞게 화면을 복원한다.

## 가장 작은 라우터

```js
const initialRoute = {
  page: "home",
  panel: null
};

history.replaceState(initialRoute, "", location.href);

function navigate(nextRoute) {
  history.pushState(nextRoute, "", routeToUrl(nextRoute));
  render(nextRoute);
}

window.addEventListener("popstate", (event) => {
  render(event.state ?? initialRoute);
});
```

`replaceState()`는 현재 페이지의 첫 상태를 기록한다. 이 작업이 없으면 첫 화면으로 돌아왔을 때 `event.state`가 비어 있어서 애플리케이션이 어떤 화면을 복원해야 할지 모를 수 있다.

`pushState()`는 사용자가 의미 있는 탐색을 했을 때 사용한다. 예를 들어 채팅방을 열거나 상세 페이지로 들어가는 동작은 히스토리에 남길 수 있다.

반대로 단순히 탭을 바꾸거나 임시 패널을 열었다 닫는 동작까지 모두 `pushState()`로 기록하면 뒤로가기가 너무 많은 중간 상태를 거치게 된다. 그런 상태는 로컬 UI 상태로만 관리하거나 `replaceState()`로 현재 기록을 교체하는 편이 낫다.

## 화면 상태를 URL에 넣을 것인가

모든 상태를 URL에 넣어야 하는 것은 아니다. 판단 기준은 “새로고침하거나 링크로 공유했을 때 복원되어야 하는가”다.

| 상태 | URL에 넣을 가능성 | 이유 |
| --- | --- | --- |
| 프로젝트 상세 화면 | 높음 | 새로고침 후에도 같은 대상을 열어야 한다 |
| 검색어 | 높음 | 결과를 공유하거나 복원할 수 있다 |
| 임시 메뉴 열림 | 낮음 | 문서의 의미보다 순간적인 UI 상태다 |
| 입력 중인 초안 | 낮음 | URL보다 별도 저장소가 적합하다 |

PWA에서 페이지 이동을 줄이려 했던 이유는 “페이지가 나쁘기 때문”이 아니다. 앱의 상태를 문서 로드와 분리해 사용자가 기대하는 뒤로가기 단위를 직접 설계하려 했기 때문이다.

## 항상 SPA가 정답은 아니다

문서가 실제로 바뀌는 경우, 검색 엔진이 독립 URL을 읽어야 하는 경우, 접근성이 페이지 단위 탐색을 기대하는 경우에는 일반적인 링크 이동이 더 적절할 수 있다.

SPA는 페이지를 없애는 기술이 아니라, 페이지 이동과 상태 전환을 구분하는 기술이다. 이 구분을 하지 않으면 패널 하나를 여는 동작이 브라우저 히스토리에 페이지 하나로 쌓인다.

## 정리

- `pushState()`는 현재 문서를 유지한 채 탐색 기록을 추가한다.
- `replaceState()`는 현재 기록을 새 상태로 교체한다.
- `popstate`는 뒤로가기와 앞으로가기에 맞춰 UI를 복원하는 진입점이다.
- 모든 UI 상태를 URL에 넣으면 오히려 뒤로가기가 불편해진다.

참고: [History API로 SPA 만들기](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API), [`pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState)
