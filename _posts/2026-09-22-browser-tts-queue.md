---
layout: post
title: "긴 글을 읽는 브라우저 TTS는 문장이 아니라 큐를 재생한다"
date: 2026-09-22 12:00:00 +0900
categories: [웹, 브라우저]
tags: [Web Speech API, TTS, SpeechSynthesis, JavaScript]
description: "브라우저 TTS로 긴 글을 읽을 때 텍스트 분할, utterance 큐, 완료 이벤트, 진행률을 함께 설계하는 방법입니다."
toc: true
---

긴 글을 브라우저 TTS로 읽히면 첫 문장만 읽고 멈추거나, 단어 일부만 뱉고 끝나는 문제가 있었다.

> “음성 기능이 제대로 안됨. 단어만 뱉다가 끝나. 내용을 제대로 읽는 게 아니야”

이 문제를 해결하면서 브라우저 TTS를 하나의 `speak(text)` 함수로 보면 안 된다는 걸 알게 됐다. 긴 문서는 여러 개의 `SpeechSynthesisUtterance`를 순서대로 재생하는 큐로 다뤄야 한다.

## 하나의 긴 utterance를 만들지 않는다

가장 단순한 구현은 다음과 같다.

```js
speechSynthesis.speak(new SpeechSynthesisUtterance(longText));
```

짧은 문장에서는 충분하지만 긴 텍스트에서는 브라우저·운영체제·음성 엔진에 따라 중단이나 지연이 생길 수 있다. 텍스트를 문장이나 적당한 길이의 단락으로 나눠 각각 utterance로 만든다.

```js
function splitText(text, maxLength = 220) {
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [text];
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
```

## 큐의 상태를 직접 관리한다

```js
function speakChunks(text) {
  const chunks = splitText(text);
  let index = 0;

  speechSynthesis.cancel();

  function speakNext() {
    if (index >= chunks.length) return;

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    const current = index;

    utterance.onstart = () => {
      renderProgress({ current, total: chunks.length });
    };

    utterance.onend = () => {
      index += 1;
      speakNext();
    };

    utterance.onerror = (event) => {
      renderError(event.error, current);
    };

    speechSynthesis.speak(utterance);
  }

  speakNext();
}
```

여기서 중요한 점은 `onend`가 다음 chunk를 시작하는 경계라는 것이다. 전체 글의 진행률은 실제 재생 시간으로 계산하기보다 `현재 chunk / 전체 chunk`로 계산하는 편이 단순하고 안정적이다.

## 취소와 중복 재생을 먼저 처리한다

사용자가 재생 버튼을 여러 번 누르면 이전 큐와 새 큐가 섞일 수 있다. 새 재생을 시작할 때 `speechSynthesis.cancel()`로 기존 재생을 취소하고, 일시정지와 완전 취소를 구분해야 한다.

또한 `onend`는 정상 종료뿐 아니라 브라우저 구현에 따라 예상하지 못한 상황에서 호출될 수 있으므로, 재생 세션 ID를 둬 오래된 utterance가 새 상태를 덮어쓰지 못하게 하는 것이 안전하다.

```js
let session = 0;

function play(text) {
  const mySession = ++session;
  speechSynthesis.cancel();

  // onend 내부에서 mySession !== session이면 다음 chunk를 시작하지 않는다.
}
```

## 브라우저 TTS는 오디오 파일 재생과 다르다

오디오 파일은 전체 길이와 seek 위치를 비교적 명확하게 알 수 있다. Web Speech API는 음성 엔진에 텍스트를 넘기고 이벤트를 받는 방식이므로, 정확한 초 단위 progress bar를 기대하기 어렵다.

따라서 UI에서 약속할 수 있는 것은 다음 정도다.

- 현재 읽는 문단
- 전체 문단 중 몇 번째인지
- 재생·일시정지·중지 상태
- 오류가 발생한 문단

이것을 알게 된 뒤 TTS 진행률을 “음성의 정확한 시간”이 아니라 “문서 처리 상태”로 설계하게 됐다.

## 정리

- 긴 텍스트는 여러 utterance로 나눈다.
- `onend`를 이용해 다음 chunk를 시작한다.
- 진행률은 chunk 기반으로 표시한다.
- 새 재생을 시작하기 전에 이전 큐를 취소한다.
- Web Speech API에서는 오디오 파일 같은 정밀한 seek를 약속하기 어렵다.

참고: [`SpeechSynthesisUtterance` end 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/end_event), [`SpeechSynthesisEvent`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisEvent)
