'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  profile_photo: string | null;
}

interface UserContextType {
  profile: UserProfile | null;
  loading: boolean;
  displayName: string;
  firstName: string;
  initials: string;
  refresh: () => void;
}

const UserContext = createContext<UserContextType>({
  profile: null,
  loading: true,
  displayName: 'User',
  firstName: 'User',
  initials: 'U',
  refresh: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && !data.error) setProfile(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProfile();
    window.addEventListener('sova:profile-updated', fetchProfile);
    return () => window.removeEventListener('sova:profile-updated', fetchProfile);
  }, [fetchProfile]);

  const displayName = profile?.full_name ?? 'User';
  const firstName = displayName.split(' ')[0];
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <UserContext.Provider value={{ profile, loading, displayName, firstName, initials, refresh: fetchProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
