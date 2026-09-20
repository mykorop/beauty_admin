export const UK_TRANSLATIONS = {
  'app.title': 'BookMe · Адмінка',

  'nav.dashboard': 'Дашборд',
  'nav.salons': 'Салони',
  'nav.independentMasters': 'Незалежні майстри',
  'nav.clients': 'Клієнти',
  'nav.appointments': 'Записи',
  'nav.reviews': 'Відгуки',
  'nav.auditLog': 'Журнал дій',

  'header.signOut': 'Вийти',
  'header.language': 'Мова інтерфейсу',

  'env.dev': 'DEV · дані спільні зі STAGING',
  'env.staging': 'STAGING · дані спільні з DEV',
  'env.prod': 'PROD',

  'login.title': 'Вхід для адміністратора',
  'login.email': 'Email',
  'login.password': 'Пароль',
  'login.submit': 'Увійти',
  'login.totp.title': 'Двофакторна перевірка',
  'login.totp.hint': 'Введіть 6-значний код із застосунку-автентифікатора.',
  'login.totp.code': 'Код',
  'login.totp.submit': 'Підтвердити',
  'login.totp.back': 'Назад',
  'login.error.credentials': 'Невірний email або пароль.',
  'login.error.totpInvalid': 'Невірний код. Спробуйте ще раз.',
  'login.error.totpExpired': 'Час на введення коду сплив. Увійдіть ще раз.',
  'login.error.notAdmin': 'Цей акаунт не має доступу до адмінки. Вас виведено з системи.',
  'login.error.mfaRequired':
    'Для цього акаунта не налаштовано TOTP, тому вхід в адмінку заборонено. Вас виведено з системи.',
  'login.error.unsupportedStep': 'Цей акаунт вимагає кроку входу, який адмінка не підтримує: {{step}}.',
  'login.error.tooManyAttempts': 'Забагато спроб. Спробуйте пізніше.',
  'login.error.generic': 'Не вдалося увійти. Спробуйте ще раз.',
  'login.sessionExpired': 'Сесія спливла. Увійдіть ще раз, щоб повернутися на ту саму сторінку.',

  'stub.comingSoon': 'Цей розділ ще в розробці.',

  'error.title': 'Помилка',
  'error.BAD_REQUEST': 'Некоректний запит.',
  'error.UNAUTHORIZED': 'Потрібно увійти ще раз.',
  'error.FORBIDDEN': 'Недостатньо прав для цієї дії.',
  'error.NOT_FOUND': 'Не знайдено.',
  'error.CONFLICT': 'Дані змінилися або конфліктують із наявними. Оновіть сторінку й спробуйте ще раз.',
  'error.VALIDATION_ERROR': 'Дані не пройшли перевірку.',
  'error.INTERNAL_SERVER_ERROR': 'Помилка на сервері. Спробуйте пізніше.',
  'error.NETWORK_ERROR': 'Немає зв’язку із сервером. Перевірте з’єднання.',
} as const;

export type TranslationKey = keyof typeof UK_TRANSLATIONS;
