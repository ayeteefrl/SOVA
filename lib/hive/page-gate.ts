// Used by the /charts layout AND by every /charts page: layouts don't re-render on client-side navigation
// (Next 16 docs, "Layouts and auth checks"), so each page checks again before rendering any Hive UI.
import { redirect } from 'next/navigation';
import { getHiveAccess, type HiveAccess } from './access';

/** Logged out -> SOVA's sign-in page. Otherwise the caller renders InviteOnly when role is "none". */
export async function gateHivePage(): Promise<HiveAccess> {
  const access = await getHiveAccess();
  if (!access.signedIn) redirect('/sign-in');
  return access;
}
