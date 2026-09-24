import { auth } from './auth';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authorize(request: Request) {
  const session = await auth().api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, 'Please sign in to continue.');
  return session.user;
}
export function checkOrigin(request: Request) {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    throw new HttpError(403, 'Please reload the page and try again.');
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export async function body(request: Pick<Request, 'headers' | 'body'>): Promise<unknown> {
  if (Number(request.headers.get('content-length') || 0) > 65536)
    throw new HttpError(413, 'This entry is too long.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Please check your entry.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      throw new HttpError(413, 'This entry is too long.');
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new HttpError(400, 'Please check your entry.');
  }
}
export async function safe(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof Error && error.name === 'ZodError')
      return json({ error: 'Please check the date, times and numbers in your entry.' }, 400);
    console.error(
      JSON.stringify({
        event: 'request_failed',
        name: error instanceof Error ? error.name : 'unknown',
      }),
    );
    return json({ error: 'Couldn’t save this entry. Please try again.' }, 500);
  }
}
