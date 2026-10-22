export type Destination = 'overview' | 'users';
export type Page = Destination | 'not-found';
export const paths: Record<Destination, string> = {
  overview: '/firma',
  users: '/firma/ucty',
};
export function pageFromPath(): Page {
  return (
    (Object.keys(paths) as Destination[]).find((k) => paths[k] === window.location.pathname) ||
    (window.location.pathname === '/' ? 'overview' : 'not-found')
  );
}
