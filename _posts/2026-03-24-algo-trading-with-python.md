---
title: "파이썬으로 시작하는 소액 자동매매 — 아이디어부터 백테스트까지"
date: 2026-03-24 09:00:00 +0900
categories: [투자, 자동화]
tags: [자동매매, 파이썬, 백테스트, 퀀트, 알고리즘트레이딩]
description: "소액으로 자동매매를 시작하고 싶다면? 전략 설계부터 백테스트, 실전 적용까지 기초를 정리했습니다."
toc: true
---

## 왜 소액으로 시작해야 하는가

자동매매를 처음 접하면 화려한 수익 곡선에 눈이 먼저 가기 마련입니다. 하지만 실제 시장에서 알고리즘이 어떻게 동작하는지는 **직접 소액으로 돌려봐야** 알 수 있습니다.

> 백테스트 수익률 70% ≠ 실전 수익률 70%

슬리피지, 수수료, 체결 지연, 감정 — 이런 변수들은 실전에서만 느낄 수 있습니다.

소액 실험의 목표는 **돈을 버는 것이 아니라 시스템을 검증하는 것**입니다.

---

## 전체 흐름

```
[아이디어] → [전략 설계] → [백테스트] → [페이퍼트레이딩] → [소액 실전]
                                ↓
                         실패 시 다시 설계
```

---

## 1단계: 전략 설계

### 좋은 전략의 조건

간단한 전략이 복잡한 전략보다 오래 살아남습니다.

| 조건 | 설명 |
|------|------|
| 명확한 진입/청산 조건 | "이럴 때 사고, 이럴 때 판다"가 수치로 정의돼야 함 |
| 낮은 과최적화 위험 | 파라미터가 적을수록 좋음 |
| 논리적 근거 | "왜 이 패턴이 통하는가"에 대한 설명 가능 |

### 예시: 이동평균 크로스오버 전략

```python
# 단순하지만 검증된 클래식 전략
# 5일선이 20일선을 위로 돌파 → 매수
# 5일선이 20일선을 아래로 돌파 → 매도

def generate_signal(df):
    df['ma5']  = df['close'].rolling(5).mean()
    df['ma20'] = df['close'].rolling(20).mean()
    df['signal'] = 0
    df.loc[df['ma5'] > df['ma20'], 'signal'] = 1   # 매수
    df.loc[df['ma5'] < df['ma20'], 'signal'] = -1  # 매도
    return df
```

---

## 2단계: 백테스트

백테스트는 **과거 데이터로 전략을 시뮬레이션**하는 과정입니다.

### 데이터 수집

```python
import FinanceDataReader as fdr

# 삼성전자 5년치 데이터
df = fdr.DataReader('005930', '2020-01-01', '2025-01-01')
df.head()
```

### 백테스트 엔진

```python
def backtest(df, initial_capital=1_000_000):
    capital = initial_capital
    position = 0
    trades = []

    for i in range(1, len(df)):
        signal = df['signal'].iloc[i]
        price  = df['close'].iloc[i]

        # 매수
        if signal == 1 and position == 0:
            position = capital / price
            capital  = 0
            trades.append({'type': 'buy', 'price': price, 'date': df.index[i]})

        # 매도
        elif signal == -1 and position > 0:
            capital  = position * price * (1 - 0.0015)  # 수수료 0.15%
            position = 0
            trades.append({'type': 'sell', 'price': price, 'date': df.index[i]})

    # 마지막 포지션 청산
    if position > 0:
        capital = position * df['close'].iloc[-1]

    total_return = (capital - initial_capital) / initial_capital * 100
    return total_return, trades
```

### 성과 지표 계산

수익률만 보면 안 됩니다. **MDD(최대 낙폭)** 와 **샤프 비율**이 더 중요합니다.

```python
def calc_mdd(equity_curve):
    peak = equity_curve.cummax()
    drawdown = (equity_curve - peak) / peak
    return drawdown.min() * 100  # %

def calc_sharpe(returns, rf=0.03):
    excess = returns - rf / 252
    return (excess.mean() / excess.std()) * (252 ** 0.5)
```

---

## 3단계: 실전 연결 (업비트 API 예시)

백테스트가 충분히 검증됐다면 실전 연결을 시도합니다.

```python
import pyupbit

# API 키 (환경변수로 관리할 것!)
upbit = pyupbit.Upbit(
    access=os.getenv('UPBIT_ACCESS'),
    secret=os.getenv('UPBIT_SECRET')
)

def execute_trade(signal, ticker='KRW-BTC', amount=10000):
    if signal == 1:
        # 소액 매수
        upbit.buy_market_order(ticker, amount)
        print(f"매수 실행: {ticker} {amount}원")

    elif signal == -1:
        # 보유 수량 전량 매도
        balance = upbit.get_balance(ticker.split('-')[1])
        if balance > 0:
            upbit.sell_market_order(ticker, balance)
            print(f"매도 실행: {ticker} {balance}")
```

> ⚠️ **주의:** API 키는 절대 코드에 하드코딩하지 마세요. `.env` 파일과 `python-dotenv`를 사용하세요.

---

## 실패에서 배운 것들

직접 소액 실험을 하면서 깨달은 것들입니다:

1. **백테스트 기간이 짧으면 과최적화가 심해진다** — 최소 3년 이상 데이터 사용
2. **수수료를 무시하면 수익률이 크게 다르다** — 단타일수록 치명적
3. **API 장애와 네트워크 오류를 반드시 처리해야 한다** — try/except는 선택이 아님
4. **새벽에 혼자 돌아가는 봇은 무서울 수 있다** — 알림 시스템 필수

---

## 다음 단계

- [ ] 텔레그램 봇으로 매매 알림 연동
- [ ] 포지션 사이징 (켈리 기준 등) 도입
- [ ] 멀티 종목으로 확장
- [ ] AI 기반 전략 (LSTM, 강화학습) 실험

자동매매는 결국 **자기 자신과의 싸움**입니다. 시스템을 믿고, 감정을 배제하고, 꾸준히 개선하는 것이 핵심입니다. 🤖
