# 🛒 Shopping List App

간단한 쇼핑 리스트 웹 앱입니다. 순수 HTML/CSS/JavaScript로 작성되었으며, `localStorage`를 이용해 항목을 저장합니다.

## 기능
- 아이템 추가 (Enter 키 또는 버튼 클릭)
- 완료 체크 / 취소 토글
- 전체 / 미완료 / 완료 필터
- 개별 삭제 및 완료 항목 일괄 삭제
- 새로고침 후에도 데이터 유지 (localStorage)

## 실행 방법
`shopping-list.html` 파일을 브라우저에서 열면 바로 사용할 수 있습니다.

## 테스트
`test-shopping.js`는 Playwright를 이용한 자동화 테스트입니다.

```bash
npm install playwright
node test-shopping.js
```
