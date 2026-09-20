import type { TranslationKey } from './uk';

export const RU_TRANSLATIONS: Record<TranslationKey, string> = {
  'app.title': 'BookMe · Админка',

  'nav.dashboard': 'Дашборд',
  'nav.salons': 'Салоны',
  'nav.independentMasters': 'Независимые мастера',
  'nav.clients': 'Клиенты',
  'nav.appointments': 'Записи',
  'nav.reviews': 'Отзывы',
  'nav.auditLog': 'Журнал действий',

  'header.signOut': 'Выйти',
  'header.language': 'Язык интерфейса',

  'env.dev': 'DEV · данные общие со STAGING',
  'env.staging': 'STAGING · данные общие с DEV',
  'env.prod': 'PROD',

  'login.title': 'Вход для администратора',
  'login.email': 'Email',
  'login.password': 'Пароль',
  'login.submit': 'Войти',
  'login.totp.title': 'Двухфакторная проверка',
  'login.totp.hint': 'Введите 6-значный код из приложения-аутентификатора.',
  'login.totp.code': 'Код',
  'login.totp.submit': 'Подтвердить',
  'login.totp.back': 'Назад',
  'login.error.credentials': 'Неверный email или пароль.',
  'login.error.totpInvalid': 'Неверный код. Попробуйте ещё раз.',
  'login.error.totpExpired': 'Время на ввод кода истекло. Войдите ещё раз.',
  'login.error.notAdmin': 'У этого аккаунта нет доступа к админке. Вы вышли из системы.',
  'login.error.mfaRequired':
    'Для этого аккаунта не настроен TOTP, поэтому вход в админку запрещён. Вы вышли из системы.',
  'login.error.unsupportedStep': 'Этот аккаунт требует шага входа, который админка не поддерживает: {{step}}.',
  'login.error.tooManyAttempts': 'Слишком много попыток. Попробуйте позже.',
  'login.error.generic': 'Не удалось войти. Попробуйте ещё раз.',
  'login.sessionExpired': 'Сессия истекла. Войдите ещё раз, чтобы вернуться на ту же страницу.',

  'stub.comingSoon': 'Этот раздел ещё в разработке.',

  'error.title': 'Ошибка',
  'error.BAD_REQUEST': 'Некорректный запрос.',
  'error.UNAUTHORIZED': 'Нужно войти ещё раз.',
  'error.FORBIDDEN': 'Недостаточно прав для этого действия.',
  'error.NOT_FOUND': 'Не найдено.',
  'error.CONFLICT': 'Данные изменились или конфликтуют с существующими. Обновите страницу и попробуйте ещё раз.',
  'error.VALIDATION_ERROR': 'Данные не прошли проверку.',
  'error.INTERNAL_SERVER_ERROR': 'Ошибка на сервере. Попробуйте позже.',
  'error.NETWORK_ERROR': 'Нет связи с сервером. Проверьте соединение.',
};
