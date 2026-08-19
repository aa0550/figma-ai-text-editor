export type Lang = 'ru' | 'en'

export interface Strings {
  navScan: string
  navResults: string
  navSummary: string
  navRules: string
  checkButton: string
  stopButton: string
  retryButton: string
  checkingProgress: (done: number, total: number) => string
  noTextsError: string
  noApiKeyError: string
  noRulesError: string
  resultsHeader: (pending: number, accepted: number) => string
  noSuggestions: string
  acceptAll: string
  before: string
  after: string
  accept: string
  skip: string
  accepted: string
  skipped: string
  undo: string
  noAcceptedChanges: string
  copy: string
  copied: string
  apiKeyLabel: string
  getKey: string
  scopeLabel: string
  scopePage: string
  scopeSelection: string
  visibilityLabel: string
  visibilityAll: string
  visibilityVisible: string
  rulesLabel: string
  rulesPlaceholder: string
  ruleFetchError: (msg: string) => string
  fileUrlLabel: string
  languageLabel: string
  langRu: string
  langEn: string
}

export const STRINGS: Record<Lang, Strings> = {
  ru: {
    navScan: 'Проверка',
    navResults: 'Результаты',
    navSummary: 'Саммари',
    navRules: 'Настройки',
    checkButton: 'Проверить',
    stopButton: 'Остановить',
    retryButton: 'Попробовать снова',
    checkingProgress: (done: number, total: number) => `Проверка ${done} / ${total}`,
    noTextsError: 'На странице нет текстов',
    noApiKeyError: 'Укажите API ключ DeepSeek',
    noRulesError: 'Добавьте правила во вкладке «Настройки»',
    resultsHeader: (pending: number, accepted: number) => `${pending} ожидают · ${accepted} принято`,
    noSuggestions: 'Нет предложений. Запустите проверку.',
    acceptAll: 'Принять все',
    before: 'Было: ',
    after: 'Стало: ',
    accept: 'Принять',
    skip: 'Пропустить',
    accepted: 'Принято ✓',
    skipped: 'Пропущено',
    undo: 'Отменить',
    noAcceptedChanges: 'Нет принятых изменений',
    copy: 'Копировать',
    copied: 'Скопировано!',
    apiKeyLabel: 'DeepSeek API Key',
    getKey: 'Получить ключ',
    scopeLabel: 'Область сканирования',
    scopePage: 'Текущая страница',
    scopeSelection: 'Только выделенное',
    visibilityLabel: 'Видимость элементов',
    visibilityAll: 'Все элементы',
    visibilityVisible: 'Только видимые',
    rulesLabel: 'Правила и Tone of Voice',
    rulesPlaceholder: 'Укажите правила текстом или ссылкой на md-файл',
    ruleFetchError: (msg: string) => `Не удалось загрузить: ${msg}`,
    fileUrlLabel: 'Ссылка на текущий Figma-файл для формирования ссылок саммари',
    languageLabel: 'Язык',
    langRu: 'Русский',
    langEn: 'English',
  },
  en: {
    navScan: 'Scan',
    navResults: 'Results',
    navSummary: 'Summary',
    navRules: 'Settings',
    checkButton: 'Check',
    stopButton: 'Stop',
    retryButton: 'Try again',
    checkingProgress: (done: number, total: number) => `Checking ${done} / ${total}`,
    noTextsError: 'No texts found on the page',
    noApiKeyError: 'Enter your DeepSeek API key',
    noRulesError: 'Add rules in the Settings tab',
    resultsHeader: (pending: number, accepted: number) => `${pending} pending · ${accepted} accepted`,
    noSuggestions: 'No suggestions. Run a check.',
    acceptAll: 'Accept all',
    before: 'Before: ',
    after: 'After: ',
    accept: 'Accept',
    skip: 'Skip',
    accepted: 'Accepted ✓',
    skipped: 'Skipped',
    undo: 'Undo',
    noAcceptedChanges: 'No accepted changes',
    copy: 'Copy',
    copied: 'Copied!',
    apiKeyLabel: 'DeepSeek API Key',
    getKey: 'Get key',
    scopeLabel: 'Scan scope',
    scopePage: 'Current page',
    scopeSelection: 'Selection only',
    visibilityLabel: 'Element visibility',
    visibilityAll: 'All elements',
    visibilityVisible: 'Visible only',
    rulesLabel: 'Rules & Tone of Voice',
    rulesPlaceholder: 'Write rules as text or as links to .md files (one per line). If rules can conflict, label each one explicitly: "Priority rule:" / "Secondary rule:".',
    ruleFetchError: (msg: string) => `Failed to load: ${msg}`,
    fileUrlLabel: 'Current Figma file link for building summary links',
    languageLabel: 'Language',
    langRu: 'Русский',
    langEn: 'English',
  },
}
