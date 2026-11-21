# AITranslate

AITranslate는 지정한 디스코드 서버의 메시지를 OpenAI 호환 API로 번역해서 원문 바로 아래에 보여 주는 [Vencord](https://github.com/Vendicated/Vencord) 플러그인입니다. 번역문은 내 화면에만 표시되고, 다른 사람에게는 보이지 않습니다.

## 기능

- 설정에 추가한 서버에서 새로 올라온 메시지를 자동으로 번역합니다.
- 번역할 메시지 앞의 대화와 답장 대상 메시지를 문맥으로 함께 보내므로, 줄임말이나 앞 대화를 가리키는 표현도 흐름에 맞게 번역합니다.
- 이미 번역 언어로 쓴 메시지와 내가 보낸 메시지는 번역하지 않습니다.
- 메시지가 수정되면 수정된 내용으로 다시 번역합니다.
- 메시지 우클릭 메뉴에서 원하는 메시지를 직접 번역하거나, 번역을 다시 하거나, 번역을 숨길 수 있습니다. DM이나 자동 번역 기간이 지난 메시지도 이 메뉴로 번역할 수 있습니다.
- OpenAI뿐 아니라 `/chat/completions` 형식을 지원하는 다른 API 서버나 로컬 LLM 서버도 사용할 수 있습니다.

## 요구 사항

- 디스코드 데스크톱 앱 (Windows, macOS, Linux)
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 22 이상
- [pnpm](https://pnpm.io/)
- OpenAI API 키 또는 OpenAI 호환 API 서버

Vencord는 소스에서 직접 빌드한 경우에만 사용자 플러그인을 불러옵니다. 공식 설치 프로그램으로 설치한 Vencord에서는 이 플러그인을 사용할 수 없습니다.

## 설치

1. 같은 상위 폴더 안에 Vencord 소스와 이 저장소를 나란히 받고, Vencord의 의존성을 설치합니다.

   ```sh
   git clone https://github.com/Vendicated/Vencord.git
   git clone <이 저장소 주소> Vencord-AITranslate
   cd Vencord
   pnpm install --frozen-lockfile
   ```

   설치가 끝나면 폴더 구조는 다음과 같습니다. 이 저장소의 `tsconfig.json`이 `../Vencord`를 기준으로 Vencord의 경로 별칭(`@api`, `@utils`, `@webpack` 등)을 찾기 때문에, Vencord 폴더 이름은 반드시 `Vencord`여야 합니다.

   ```text
   <상위 폴더>/
   ├── Vencord/
   └── Vencord-AITranslate/
   ```

2. 상위 폴더에서 이 저장소를 Vencord의 `src/userplugins/aiTranslate`로 연결합니다.

   Windows에서는 명령 프롬프트(cmd)로 디렉터리 정션을 만듭니다.

   ```bat
   mklink /J "Vencord\src\userplugins\aiTranslate" "%CD%\Vencord-AITranslate"
   ```

   macOS와 Linux에서는 심볼릭 링크를 만듭니다.

   ```sh
   ln -s "$PWD/Vencord-AITranslate" Vencord/src/userplugins/aiTranslate
   ```

3. Vencord 폴더에서 Vencord를 빌드하고 디스코드에 적용합니다.

   ```sh
   pnpm build
   pnpm inject
   ```

   `pnpm inject`를 실행하면 디스코드가 Vencord 폴더의 `dist`를 직접 불러오도록 설정됩니다. 그러므로 적용한 뒤에는 Vencord 폴더를 옮기거나 지우면 안 됩니다.

4. 디스코드를 완전히 종료했다가 다시 실행합니다.
5. **사용자 설정 → Vencord → Plugins**에서 **AITranslate**를 켜고, 플러그인 설정에 API 키를 입력합니다.

## 사용 방법

### 자동 번역할 서버 지정

서버 아이콘을 우클릭한 뒤 **AI 자동 번역 켜기**를 누릅니다. 같은 메뉴에서 **AI 자동 번역 끄기**를 누르면 목록에서 빠집니다. 플러그인 설정의 **자동 번역 서버** 항목에 서버 ID를 직접 입력해도 됩니다.

### 메시지 우클릭 메뉴

| 메뉴 | 표시되는 경우 | 동작 |
| --- | --- | --- |
| AI로 번역 | 번역문이 없는 메시지 | 해당 메시지를 바로 번역합니다. |
| AI 번역 다시 하기 | 번역문이 있는 메시지 | 같은 메시지를 다시 번역합니다. |
| AI 번역 숨기기 | 번역문이 있는 메시지 | 번역문을 숨기고, 이후 자동 번역에서도 제외합니다. |

번역에 실패하면 원문 아래에 실패 원인과 **다시 시도** 버튼이 표시됩니다.

## 설정

| 항목 | 기본값 | 설명 |
| --- | --- | --- |
| 자동 번역 서버 | 없음 | 자동 번역할 서버 ID 목록입니다. 쉼표나 줄바꿈으로 구분합니다. |
| API 엔드포인트 | `https://api.openai.com/v1` | 주소가 `/chat/completions`로 끝나지 않으면 뒤에 붙여서 요청합니다. |
| API 키 | 없음 | `Authorization: Bearer` 헤더로 보냅니다. 키가 필요 없는 로컬 서버라면 비워 둡니다. |
| 모델 | `gpt-5-mini` | 번역에 사용할 모델 이름입니다. |
| 추론 강도 | 보내지 않음 | `reasoning_effort` 값입니다. 보내지 않음을 고르면 요청에 넣지 않으므로 모델 기본값이 적용됩니다. |
| 번역 언어 | `Korean` | 번역 결과로 받을 언어입니다. |
| 이전 메시지 수 | 10 | 문맥으로 함께 보낼 이전 메시지 수입니다. 0에서 30 사이로 고릅니다. |
| 자동 번역 기간 | 24시간 | 이 기간 안에 올라온 메시지만 화면에 표시될 때 자동으로 번역합니다. |
| 알파벳이 있는 메시지만 번역 | 켜짐 | 알파벳(A-Z)이 없는 메시지는 번역을 요청하지 않습니다. |
| 추가 지시 사항 | 없음 | 모델이 번역할 때 추가로 따를 지시 사항입니다. |

## 번역 요청 방식

- 메시지는 채널 화면에 표시될 때 번역을 요청합니다. 열어 보지 않은 채널의 메시지에는 요청을 보내지 않습니다.
- 요청은 동시에 최대 3개까지 보내고, 가장 최근에 표시된 메시지부터 처리합니다.
- 문맥으로 보내는 메시지는 현재 채널에 불러와진 메시지 중에서 고릅니다. 문맥 메시지의 사용자 멘션과 채널 멘션은 이름으로 바꿔서 보냅니다.
- 번역 대상 메시지의 마크다운, 멘션, 커스텀 이모지, 링크, 코드 블록은 그대로 유지하도록 요청합니다.
- 번역 결과는 디스코드를 다시 시작하기 전까지 메모리에 저장되며, 같은 메시지를 다시 표시해도 새로 요청하지 않습니다.
- API 요청은 디스코드의 메인 프로세스에서 보냅니다. 따라서 브라우저의 CORS 제한을 받지 않습니다.

## 주의 사항

- **API 비용**: 메시지마다 요청을 한 번씩 보냅니다. 대화가 활발한 서버를 추가하거나, 이전 메시지 수나 자동 번역 기간을 늘리면 요청량과 비용이 함께 늘어납니다.
- **API 키 보관**: API 키는 Vencord 설정 파일(Windows 기준 `%APPDATA%\Vencord\settings\settings.json`)에 평문으로 저장됩니다.
- **약관**: 디스코드 클라이언트를 수정하는 것은 디스코드 서비스 약관에 어긋납니다. 이 플러그인과 Vencord를 사용하는 데 따르는 책임은 사용자에게 있습니다.
- **모바일 미지원**: 모바일 디스코드 앱에서는 동작하지 않습니다.

## 업데이트

이 저장소에서 `git pull`로 최신 코드를 받은 뒤, Vencord 폴더에서 다음 명령을 실행합니다.

```sh
cd <Vencord 경로>
git pull
pnpm install --frozen-lockfile
pnpm build
```

빌드한 뒤에는 디스코드를 다시 시작합니다. 디스코드 본체가 업데이트되면서 Vencord가 풀렸다면 `pnpm inject`를 다시 실행합니다.

## 개발

Vencord 폴더에서 다음 명령을 실행하면 이 플러그인의 타입을 검사합니다.

```sh
pnpm exec tsc --noEmit -p ../Vencord-AITranslate
```

`pnpm watch`를 실행해 두면 파일을 저장할 때마다 Vencord가 다시 빌드됩니다. 바뀐 코드는 디스코드에서 `Ctrl+R`로 화면을 새로 고치면 적용되며, `native.ts`를 바꿨다면 디스코드를 다시 시작해야 합니다.

## 라이선스

[MIT](LICENSE)

번역 아이콘은 Google [Material Symbols](https://github.com/google/material-design-icons)의 아이콘이며, Apache License 2.0을 따릅니다.
