---
title: "AI로 깃허브 블로그 자동화하기"
date: 2026-03-22 09:00:00 +0900
categories: [개발, 자동화]
tags: [블로그, 자동화, Jekyll, AI, GitHub Actions]
description: "Claude AI를 활용해 깃허브 블로그 포스팅을 자동화하는 방법을 소개합니다."
toc: true
---

## 개요

블로그를 꾸준히 운영하는 것은 생각보다 어렵습니다. 글감을 찾고, 초안을 쓰고, 다듬고, 발행하는 과정이 반복되면 금방 지칩니다.

이 문제를 해결하기 위해 **AI 에이전트 + GitHub Actions** 조합으로 블로그 자동화 파이프라인을 구축했습니다.

## 전체 아키텍처

```
[주제 입력] → [AI 초안 생성] → [자동 커밋] → [GitHub Pages 배포]
     ↑               ↓
[스케줄러]    [Markdown 파일 생성]
```

### 구성 요소

1. **NanoClaw (Claude Agent)** — 주제를 받아 글 초안 작성
2. **GitHub Actions** — 자동 커밋 & 배포 트리거
3. **Jekyll** — 정적 사이트 빌드
4. **GitHub Pages** — 무료 호스팅

## 구현 방법

### 1단계: GitHub Token 설정

```bash
# GitHub CLI로 토큰 생성
gh auth login

# 저장소 시크릿에 추가
gh secret set GITHUB_TOKEN --body "ghp_..."
```

### 2단계: GitHub Actions 워크플로우

```yaml
# .github/workflows/auto-post.yml
name: Auto Post

on:
  schedule:
    - cron: '0 9 * * 1'  # 매주 월요일 오전 9시
  workflow_dispatch:      # 수동 트리거도 가능

jobs:
  generate-post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate post with AI
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          python scripts/generate_post.py

      - name: Commit and push
        run: |
          git config user.name "GitHub Actions Bot"
          git config user.email "bot@github.com"
          git add _posts/
          git commit -m "chore: auto-generated post $(date +%Y-%m-%d)"
          git push
```

### 3단계: 포스트 생성 스크립트

```python
# scripts/generate_post.py
import anthropic
from datetime import datetime
import os

client = anthropic.Anthropic()

def generate_post(topic: str) -> str:
    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""
다음 주제로 Jekyll 블로그 포스트를 작성해주세요: {topic}

형식:
- 마크다운
- Front matter 포함 (title, date, categories, tags, description)
- 2000자 내외
- 실용적인 내용 위주
"""
        }]
    )
    return message.content[0].text

def save_post(content: str):
    date = datetime.now().strftime("%Y-%m-%d")
    filename = f"_posts/{date}-auto-post.md"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Post saved: {filename}")

if __name__ == "__main__":
    topic = os.getenv("POST_TOPIC", "개발 생산성 향상 팁")
    content = generate_post(topic)
    save_post(content)
```

## 고급 기능: 주제 자동 선정

단순히 글을 쓰는 것을 넘어, **트렌딩 주제를 자동으로 찾아서 글을 쓰게** 할 수도 있습니다.

```python
# 웹 검색으로 최신 트렌드 수집 후 글 작성
def get_trending_topic():
    # GitHub Trending, Hacker News, Dev.to 등에서 수집
    pass
```

## 주의사항

> ⚠️ 완전 자동화는 품질 저하로 이어질 수 있습니다.
> AI 초안 → 사람 검토 → 발행 흐름을 권장합니다.

## 결론

자동화는 **반복 작업을 줄여주는 도구**이지, 블로거의 역할을 대체하는 것이 아닙니다. AI가 초안을 잡아주면, 우리는 내용을 다듬고 인사이트를 더하는 데 집중할 수 있습니다.

다음 포스트에서는 자동매매 시스템과 연결해서 **투자 일지를 자동으로 발행하는 방법**을 다뤄보겠습니다.
