import { auth } from '@/lib/auth';
import { env } from 'cloudflare:workers';
import { timingSafeEqual } from 'node:crypto';
import { json, body } from '@/lib/http';
import { database } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
async function handler(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (path.endsWith('/sign-up/email')) {
    let data: Record<string, unknown>;
    try {
      data = (await body(request.clone())) as Record<string, unknown>;
    } catch {
      return json({ message: 'Please check your details.' }, 400);
    }
    const invitation = request.headers.get('x-invitation') ?? '',
      expected = env.SIGNUP_INVITE ?? '';
    const suppliedBytes = Buffer.from(invitation),
      expectedBytes = Buffer.from(expected);
    const valid =
      expected.length > 20 &&
      suppliedBytes.length === expectedBytes.length &&
      timingSafeEqual(suppliedBytes, expectedBytes);
    const existing = await database().select({ id: users.id }).from(users).limit(1);
    if (
      !valid ||
      String(data.email).toLowerCase() !== env.OWNER_EMAIL?.toLowerCase() ||
      existing.length
    )
      return json(
        { message: 'Registration is private. Use your invitation to set up your account.' },
        403,
      );
  }
  try {
    const response = await auth().handler(request);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return json({ message: 'Couldn’t sign in. Please try again.' }, 500);
  }
}
export const GET = handler;
export const POST = handler;
