# Публикация в Figma Community — чек-лист и тексты

Публикация делается вручную через **Figma Desktop → Plugins → Development → [AI Text Editor] → Publish…** — этот шаг нельзя автоматизировать, его нужно пройти в интерфейсе Figma. Ниже — всё, что нужно подготовить заранее, и готовые тексты, которые можно скопировать в форму публикации.

## Готово в этом репозитории

- [x] `manifest.json` — актуальный, без секретов. `networkAccess.allowedDomains` указывает `api.deepseek.com` (обязательный домен для проверки текстов) и `*` (пользователь сам указывает ссылки на `.md`-файлы с правилами — домен заранее неизвестен) с заполненным полем `reasoning`, которое требует Figma для wildcard-доступа.
- [x] `store/icon.png` — иконка плагина 128×128 (можно заменить своей — просто положить PNG 128×128 в это же место).
- [x] `store/icon-512.png` — версия иконки 512×512 про запас (если понадобится где-то ещё, кроме формы публикации).
- [x] `store/cover.png` — обложка для карточки Community, 1920×960, текст на английском (Community-листинг обычно смотрят международно).
- [x] `store/screenshots/` — пара скриншотов интерфейса (вкладка «Проверка» и «Результаты» с примером правок).
- [x] Мёртвый код шаблона Vite удалён, `README.md` описывает сам плагин.
- [x] `npm run build` и `npm run lint` проходят чисто.
- [x] В коде и истории git нет ключей/секретов (проверено ранее в этой сессии) — пользователь вводит свой DeepSeek-ключ сам, он хранится только локально через `figma.clientStorage`.

## Нужно сделать вручную перед публикацией

1. **Проверить, что сборка свежая**: `npm run build` (создаёт `dist/index.html` и `dist/main.js`, на которые ссылается `manifest.json`).
2. **Открыть Figma Desktop** → залогиниться нужным аккаунтом.
3. **Plugins → Development → Import plugin from manifest…** → выбрать `manifest.json` из корня, если плагин ещё не импортирован локально.
4. **Plugins → Development → AI Text Editor → Publish…** — откроется форма публикации. Дальше по пунктам ниже.
5. Перед отправкой на модерацию **поискать в Figma Community**, нет ли уже плагина с названием «AI Text Editor» — при совпадении Figma попросит переименовать.

## Тексты для формы публикации

**Название:**
```
AI Text Editor
```

**Короткое описание (tagline, ~140 символов):**
```
Проверяет UX-тексты на странице по вашим правилам tone of voice и предлагает правки с помощью ИИ.
```

**Tagline (English, ≤100 chars):**
```
AI-powered checks for your UX text against your tone-of-voice rules, right inside Figma.
```

**Полное описание:**
```
AI Text Editor проверяет текстовые слои в файле Figma на соответствие вашим правилам tone of voice и стиля — и предлагает точечные исправления, которые можно принять или пропустить по одному.

Как это работает:
1. Во вкладке «Настройки» укажите правила написания текстов — просто текстом, ссылкой на .md-файл с правилами (например, в GitHub) или тем и другим вперемешку, по одному правилу/ссылке в строке. Если источники правил могут противоречить друг другу, пометьте нужный как «Приоритетное правило:» — это учитывается при проверке.
2. Укажите свой API-ключ DeepSeek (получить можно на platform.deepseek.com).
3. Запустите проверку — на всей текущей странице или только в выделении.
4. Для каждого найденного нарушения плагин покажет diff «было → стало» и причину со ссылкой на конкретное правило.
5. Принимайте, пропускайте или отменяйте правки по отдельности — или нажмите «Принять все».
6. Во вкладке «Саммари» — готовый список принятых изменений со ссылками на нужные экраны в файле Figma (укажите ссылку на текущий файл в «Настройках», чтобы ссылки в саммари были кликабельны), чтобы поделиться с командой.

Интерфейс доступен на русском и английском — язык переключается там же, в «Настройках».

Важно об API-ключе и данных: содержимое проверяемых текстовых слоёв и ваш API-ключ отправляются в DeepSeek API (api.deepseek.com) для анализа. Если вы указали в правилах ссылку на .md-файл, плагин также скачивает его содержимое с указанного вами адреса (например, raw.githubusercontent.com). Ключ и правила хранятся только локально в файле через figma.clientStorage.
```

**Full description (English):**
```
AI Text Editor checks text layers in your Figma file against your tone-of-voice and style rules — and suggests targeted fixes you can accept or skip one by one.

How it works:
1. In the Settings tab, add your writing rules — as plain text, a link to a .md file (e.g. in GitHub), or a mix of both, one rule/link per line. If different sources might conflict, mark the one that should win with "Priority rule:" — this is taken into account during the check.
2. Add your own DeepSeek API key (get one at platform.deepseek.com).
3. Run a check — across the whole current page or just your selection.
4. For every issue found, the plugin shows a before → after diff and a reason referencing the specific rule.
5. Accept, skip, or undo each suggestion individually — or hit "Accept all".
6. The Summary tab gives you a ready-to-share list of accepted changes with clickable links to the exact frames in your Figma file (set the current file's link in Settings so summary links work).

The interface is available in Russian and English — switch it in Settings, which also changes the language of the AI's replies.

About your API key and data: the text of the layers you check, plus your API key, are sent to the DeepSeek API (api.deepseek.com) for analysis. If you add a link to a .md file in your rules, the plugin also fetches its content from the address you provided (e.g. raw.githubusercontent.com). Your key and rules are stored locally in the file only, via figma.clientStorage.
```

**Обоснование сетевого доступа** (Figma спросит, зачем нужен `networkAccess`):
```
Плагин отправляет текст проверяемых слоёв в DeepSeek API (api.deepseek.com), чтобы получить предложения по исправлению текста согласно правилам tone of voice, заданным пользователем — используется личный API-ключ пользователя, указанный в настройках плагина.

Дополнительно пользователь может задать правила не только текстом, но и ссылкой на .md-файл (например, в корпоративном GitHub-репозитории с гайдлайнами). Так как адрес такого файла заранее неизвестен и полностью определяется пользователем, для его скачивания используется wildcard-доступ (`*`) в дополнение к api.deepseek.com. Запрос уходит только на URL, который сам пользователь вписал в поле правил.
```

**Категория:** Content Design / Productivity (выбрать наиболее подходящую из списка, который предложит Figma — актуальный набор категорий меняется, сверьтесь прямо в форме).

**Теги:** `ux writing`, `tone of voice`, `content design`, `copywriting`, `ai`, `proofreading`, `text`

**Иконка:** `store/icon.png` (128×128)

**Обложка / медиа:** `store/cover.png` (1920×960), можно дополнительно приложить `store/screenshots/*.png`

## После публикации

- Первая публикация проходит модерацию Figma — может занять от нескольких часов до нескольких дней.
- Для последующих обновлений: `npm run build` → тот же пункт меню **Publish…** предложит опубликовать новую версию.
