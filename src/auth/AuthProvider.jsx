import { createContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/services/firebase/firebaseConfig';
import { ensureUserProfile } from '@/services/firebase/userService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let authRunId = 0;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const runId = ++authRunId;

      setCurrentUser(user);

      if (!user) {
        setUserProfile(null);
        setAuthLoading(false);
        return;
      }

      // La sesión ya está resuelta: no bloqueamos la UI mientras Firestore
      // asegura/sincroniza el perfil del usuario.
      setAuthLoading(false);

      ensureUserProfile(user)
        .then((profile) => {
          if (runId !== authRunId) {
            return;
          }

          setUserProfile(profile);
        })
        .catch((error) => {
          if (runId !== authRunId) {
            return;
          }

          console.error('No se pudo asegurar el perfil de usuario:', error);
          setUserProfile(null);
        });
    });

    return () => {
      authRunId += 1;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      userProfile,
      authLoading,
      isAuthenticated: Boolean(currentUser),
    }),
    [currentUser, userProfile, authLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
