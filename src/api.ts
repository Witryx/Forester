export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}
let csrfToken = '';
export const setCsrf = (token: string) => {
  csrfToken = token;
};
export async function api<T>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`/api${url}`, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new ApiError(data.message || 'Požadavek selhal.', response.status, data.fields);
    if (response.status === 401 && !url.startsWith('/auth/login'))
      window.dispatchEvent(new Event('forester:expired'));
    throw error;
  }
  return data;
}
