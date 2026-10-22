export const zone = 'Europe/Prague';
export const dayKey = (date: number | Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(date);
export const time = (date: number) =>
  new Intl.DateTimeFormat('cs-CZ', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
export const shortDate = (date: number) =>
  new Intl.DateTimeFormat('cs-CZ', {
    timeZone: zone,
    day: 'numeric',
    month: 'numeric',
  }).format(date);
export const fullDate = (date: Date | number) =>
  new Intl.DateTimeFormat('cs-CZ', {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
export const states: Record<string, string> = {
  planned: 'Naplánováno',
  in_progress: 'Na cestě',
  completed: 'Dokončeno',
  waiting: 'Čeká na přiřazení',
  cancelled: 'Zrušeno',
};
export const actions: Record<string, string> = {
  'auth.login': 'Přihlášení do aplikace',
  'auth.logout': 'Odhlášení z aplikace',
  'demo.initialized': 'Vytvoření ukázkových dat',
  'user.initialized': 'Vytvoření prvního dispečera',
  'user.created': 'Vytvoření účtu',
  'user.updated': 'Změna účtu',
  'user.password_changed': 'Změna hesla',
  'user.password_reset': 'Reset hesla',
  'reservation.created': 'Vytvoření rezervace',
};
