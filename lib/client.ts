export async function request<T>(
  url: string,
  method = 'GET',
  data?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new Error('Couldn’t confirm the save. Please check your connection and try again.');
  }
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Please sign in again.');
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error('Couldn’t connect to your journal. Please try again.');
  }
  const problem = value as { error?: string; message?: string };
  if (!response.ok)
    throw new Error(
      problem.error || problem.message || 'Couldn’t save this entry. Please try again.',
    );
  return value as T;
}
