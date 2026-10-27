export type Destination = 'overview' | 'users' | 'profile' | 'drivers' | 'vehicles' | 'trailers';
export type Page = Destination | 'not-found';
export const paths: Record<Destination, string> = {
  overview: '/firma',
  users: '/firma/ucty',
  profile: '/firma/profil',
  drivers: '/firma/ridici',
  vehicles: '/firma/tahace',
  trailers: '/firma/navesy',
};
export function pageFromPath(): Page {
  return (
    (Object.keys(paths) as Destination[]).find(
      (k) =>
        paths[k] === window.location.pathname ||
        (['drivers', 'vehicles', 'trailers'].includes(k) &&
          new RegExp(`^${paths[k]}/[^/]+$`).test(window.location.pathname)),
    ) || (window.location.pathname === '/' ? 'overview' : 'not-found')
  );
}
