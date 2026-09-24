import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { JournalApp } from '@/components/journal-app';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  return <JournalApp />;
}
