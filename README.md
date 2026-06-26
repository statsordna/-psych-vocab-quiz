# 계량심리 용어 퀴즈 (PWA)

안드로이드 Chrome에서 접속 후 "홈 화면에 추가"하면 앱처럼 사용할 수 있습니다.

## 화면
- **단어장**: `glossary.json`의 모든 용어를 카테고리 필터/검색과 함께 표시
- **객관식 퀴즈**: 영단어를 보고 알맞은 국문 용어 4지선다
- **주관식 퀴즈**: 영단어+국문 용어를 보고 설명을 입력. 키워드 겹침 기반으로 유사 답변도 정답 처리하며, 애매한 경우 한 번 더 구체적으로 물어봄

## 용어 업데이트 (매일)
1. `C:\Users\andro\Documents\계량심리 용어`에 새 `vocab_YYYY-MM-DD.xlsx` 추가
2. `scripts/build_glossary.pl`로 전체 xlsx를 다시 파싱해 `glossary.json` 재생성
3. `git add glossary.json && git commit -m "update glossary" && git push`
4. 앱은 네트워크 우선으로 `glossary.json`을 불러오므로, 휴대폰에서 앱을 열면(인터넷 연결 시) 자동으로 최신 용어 반영됨
