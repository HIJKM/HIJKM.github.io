---
title: "JSP 완전 입문 — 자바 웹 개발의 첫걸음"
date: 2026-03-26 10:00:00 +0900
categories: [개발]
tags: [JSP, Java, 웹개발, 백엔드, 입문]
description: "JSP(JavaServer Pages)가 무엇인지, 어떻게 동작하는지 초보자 눈높이에서 차근차근 설명합니다."
toc: true
---

## JSP가 뭔가요?

**JSP(JavaServer Pages)**는 HTML 안에 Java 코드를 심어서 동적인 웹 페이지를 만드는 기술입니다.

```jsp
<%-- 이게 JSP 파일입니다 --%>
<html>
<body>
  <h1>안녕하세요, <%= "세상" %>!</h1>
  <p>지금 시각: <%= new java.util.Date() %></p>
</body>
</html>
```

브라우저가 이 파일을 요청하면 서버가 Java 코드를 실행한 뒤, 결과를 HTML로 변환해서 돌려줍니다.

---

## 동작 원리

```
브라우저 요청
    ↓
Tomcat (서블릿 컨테이너)
    ↓
JSP → Java 코드로 변환 (Servlet)
    ↓
Java 실행 → HTML 생성
    ↓
브라우저에 응답
```

JSP는 내부적으로 **서블릿(Servlet)**으로 변환됩니다. 즉 JSP는 서블릿을 더 편하게 쓰기 위한 문법적 설탕(syntactic sugar)이에요.

---

## 개발 환경 설정

### 필요한 것들

| 도구 | 역할 | 다운로드 |
|------|------|----------|
| JDK 17+ | Java 실행 환경 | [adoptium.net](https://adoptium.net) |
| Apache Tomcat 10 | JSP 서블릿 컨테이너 | [tomcat.apache.org](https://tomcat.apache.org) |
| IntelliJ IDEA | 편집기 (Community 무료) | [jetbrains.com](https://jetbrains.com) |

### 프로젝트 구조

```
my-web-app/
├── src/
│   └── main/
│       ├── java/          ← Java 클래스
│       └── webapp/
│           ├── WEB-INF/
│           │   └── web.xml
│           ├── index.jsp  ← JSP 파일들
│           └── hello.jsp
└── pom.xml                ← Maven 설정
```

---

## JSP 기본 문법

### 1. 표현식 `<%= %>`

값을 출력합니다.

```jsp
<p>이름: <%= request.getParameter("name") %></p>
<p>현재 시각: <%= new java.util.Date() %></p>
```

### 2. 스크립틀릿 `<% %>`

Java 코드를 실행합니다.

```jsp
<%
  int count = 10;
  String msg = "안녕하세요";
  out.println(msg);
%>
```

### 3. 선언 `<%! %>`

메서드나 변수를 선언합니다.

```jsp
<%!
  int add(int a, int b) {
      return a + b;
  }
%>
<p>결과: <%= add(3, 5) %></p>
```

### 4. 지시어 `<%@ %>`

페이지 설정을 지정합니다.

```jsp
<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ page import="java.util.List, java.util.ArrayList" %>
```

---

## 내장 객체 (Implicit Objects)

JSP에서는 별도 선언 없이 바로 쓸 수 있는 객체들이 있어요.

| 객체 | 설명 | 자주 쓰는 메서드 |
|------|------|-----------------|
| `request` | 클라이언트 요청 정보 | `getParameter()`, `getAttribute()` |
| `response` | 서버 응답 설정 | `sendRedirect()`, `setContentType()` |
| `session` | 사용자 세션 | `getAttribute()`, `setAttribute()` |
| `out` | 출력 스트림 | `println()`, `print()` |
| `application` | 앱 전체 공유 | `getAttribute()`, `setAttribute()` |

```jsp
<%
  // 로그인한 사용자 이름 세션에서 가져오기
  String userName = (String) session.getAttribute("userName");
  if (userName == null) {
      response.sendRedirect("login.jsp");
      return;
  }
%>
<h1>환영합니다, <%= userName %>님!</h1>
```

---

## 실습: 간단한 계산기 만들기

### calc.jsp

```jsp
<%@ page contentType="text/html; charset=UTF-8" %>
<html>
<head><title>계산기</title></head>
<body>
  <h2>간단 계산기</h2>

  <form method="post" action="calc.jsp">
    <input type="number" name="num1" placeholder="첫 번째 숫자" required />
    <select name="op">
      <option value="+">+</option>
      <option value="-">-</option>
      <option value="*">×</option>
      <option value="/">÷</option>
    </select>
    <input type="number" name="num2" placeholder="두 번째 숫자" required />
    <button type="submit">계산</button>
  </form>

  <%
    String num1Str = request.getParameter("num1");
    String num2Str = request.getParameter("num2");
    String op      = request.getParameter("op");

    if (num1Str != null && num2Str != null && op != null) {
        double n1 = Double.parseDouble(num1Str);
        double n2 = Double.parseDouble(num2Str);
        double result = 0;

        switch (op) {
            case "+": result = n1 + n2; break;
            case "-": result = n1 - n2; break;
            case "*": result = n1 * n2; break;
            case "/":
                if (n2 != 0) result = n1 / n2;
                else { out.println("<p>0으로 나눌 수 없습니다.</p>"); return; }
                break;
        }
  %>
    <hr>
    <p>결과: <strong><%= n1 %> <%= op %> <%= n2 %> = <%= result %></strong></p>
  <%
    }
  %>
</body>
</html>
```

---

## MVC 패턴으로 발전하기

JSP에 모든 코드를 넣으면 유지보수가 힘들어집니다. 실무에서는 **MVC 패턴**을 씁니다.

```
[View]        [Controller]     [Model]
JSP (화면)  ←  Servlet (로직)  →  DAO (DB)
```

| 역할 | 담당 | 예시 |
|------|------|------|
| Model | Java Bean, DAO | `UserDAO.java` |
| View | JSP | `userList.jsp` |
| Controller | Servlet | `UserServlet.java` |

> 💡 요즘은 JSP 대신 **Thymeleaf**, **React** 등을 많이 씁니다. 하지만 JSP는 레거시 시스템 유지보수나 기업 환경에서 여전히 현역입니다.

---

## 다음 단계

1. **JSTL** — JSP 태그 라이브러리로 Java 코드 없이 조건/반복 처리
2. **EL (Expression Language)** — `${변수명}` 형태로 더 깔끔한 표현
3. **Servlet** — JSP의 기반이 되는 Java 클래스
4. **Spring MVC** — 현대적인 Java 웹 프레임워크

JSP의 기초를 탄탄히 잡으면, Spring으로 넘어갈 때 훨씬 수월합니다. 🚀
