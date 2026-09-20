import type { TranslationKey } from './uk';

export const RO_TRANSLATIONS: Record<TranslationKey, string> = {
  'app.title': 'BookMe · Administrare',

  'nav.dashboard': 'Panou',
  'nav.salons': 'Saloane',
  'nav.independentMasters': 'Maeștri independenți',
  'nav.clients': 'Clienți',
  'nav.appointments': 'Programări',
  'nav.reviews': 'Recenzii',
  'nav.auditLog': 'Jurnal de acțiuni',

  'header.signOut': 'Ieșire',
  'header.language': 'Limba interfeței',

  'env.dev': 'DEV · date comune cu STAGING',
  'env.staging': 'STAGING · date comune cu DEV',
  'env.prod': 'PROD',

  'login.title': 'Autentificare administrator',
  'login.email': 'Email',
  'login.password': 'Parolă',
  'login.submit': 'Intră',
  'login.totp.title': 'Verificare în doi pași',
  'login.totp.hint': 'Introduceți codul din 6 cifre din aplicația de autentificare.',
  'login.totp.code': 'Cod',
  'login.totp.submit': 'Confirmă',
  'login.totp.back': 'Înapoi',
  'login.error.credentials': 'Email sau parolă greșită.',
  'login.error.totpInvalid': 'Cod greșit. Încercați din nou.',
  'login.error.totpExpired': 'Timpul pentru introducerea codului a expirat. Autentificați-vă din nou.',
  'login.error.notAdmin': 'Acest cont nu are acces la panoul de administrare. Ați fost deconectat.',
  'login.error.mfaRequired':
    'Pentru acest cont nu este configurat TOTP, de aceea accesul este interzis. Ați fost deconectat.',
  'login.error.unsupportedStep': 'Acest cont cere un pas de autentificare nesuportat: {{step}}.',
  'login.error.tooManyAttempts': 'Prea multe încercări. Încercați mai târziu.',
  'login.error.generic': 'Autentificarea a eșuat. Încercați din nou.',
  'login.sessionExpired': 'Sesiunea a expirat. Autentificați-vă din nou pentru a reveni la aceeași pagină.',

  'stub.comingSoon': 'Această secțiune este încă în lucru.',

  'error.title': 'Eroare',
  'error.BAD_REQUEST': 'Cerere incorectă.',
  'error.UNAUTHORIZED': 'Trebuie să vă autentificați din nou.',
  'error.FORBIDDEN': 'Drepturi insuficiente pentru această acțiune.',
  'error.NOT_FOUND': 'Nu a fost găsit.',
  'error.CONFLICT': 'Datele s-au schimbat sau intră în conflict cu cele existente. Reîncărcați pagina și încercați din nou.',
  'error.VALIDATION_ERROR': 'Datele nu au trecut verificarea.',
  'error.INTERNAL_SERVER_ERROR': 'Eroare de server. Încercați mai târziu.',
  'error.NETWORK_ERROR': 'Nu există conexiune cu serverul. Verificați conexiunea.',
};
