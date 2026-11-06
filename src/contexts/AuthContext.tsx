import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { User } from '../types/user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  updateProfilePhoto: (photoUrl: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;
    let unsubTutorDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubUserDoc) { unsubUserDoc(); unsubUserDoc = null; }
      if (unsubTutorDoc) { unsubTutorDoc(); unsubTutorDoc = null; }

      if (firebaseUser) {
        unsubUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();
            let paymentMethods = userData.paymentMethods || {};

            const updateUserState = (effectivePaymentMethods: any) => {
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: userData.name || firebaseUser.displayName || '',
                role: userData.role || 'tutor',
                mustChangePassword: userData.mustChangePassword || false,
                linkedStudentIds: userData.linkedStudentIds || [],
                createdByTutorId: userData.createdByTutorId,
                contactNumber: userData.contactNumber,
                photoUrl: userData.photoUrl || null,
                paymentMethods: effectivePaymentMethods,
              });
              setIsLoading(false);
            };

            if (userData.role === 'parent' && userData.createdByTutorId) {
              if (unsubTutorDoc) unsubTutorDoc();
              unsubTutorDoc = onSnapshot(doc(db, 'users', userData.createdByTutorId), (tutorSnap) => {
                const tutorPaymentMethods = tutorSnap.exists() ? (tutorSnap.data().paymentMethods || {}) : {};
                updateUserState(tutorPaymentMethods);
              }, (err) => {
                console.warn('Error listening to tutor doc:', err);
                updateUserState(paymentMethods);
              });
            } else {
              updateUserState(paymentMethods);
            }
          } else {
            // The Auth session outlived its Firestore profile (e.g. the account
            // was cleared then restored with a fresh profile). Drop the stale
            // user so the next sign-in re-runs registration and on-boarding.
            setUser(null);
            setIsLoading(false);
          }
        }, (err) => {
          console.warn('Error listening to user doc:', err);
          setIsLoading(false);
        });
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubTutorDoc) unsubTutorDoc();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setIsLoading(false);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this Phone Number');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later');
      } else {
        throw new Error('Login failed. Please try again');
      }
    }
  };

  const logout = async () => {
    setUser(null);
    await auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this Phone Number');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      } else {
        throw new Error('Failed to send reset email. Please try again');
      }
    }
  };

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      let paymentMethods = userData.paymentMethods || {};
      if (userData.role === 'parent' && userData.createdByTutorId) {
        try {
          const tutorDoc = await getDoc(doc(db, 'users', userData.createdByTutorId));
          if (tutorDoc.exists() && tutorDoc.data().paymentMethods) {
            paymentMethods = tutorDoc.data().paymentMethods;
          }
        } catch (err) {
          console.warn('Failed to fetch tutor payment methods in refreshUser:', err);
        }
      }
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: userData.name || '',
        role: userData.role || 'tutor',
        mustChangePassword: userData.mustChangePassword || false,
        linkedStudentIds: userData.linkedStudentIds || [],
        createdByTutorId: userData.createdByTutorId,
        contactNumber: userData.contactNumber,
        photoUrl: userData.photoUrl || null,
        paymentMethods,
      });
    }
  };

  const changePassword = async (newPassword: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) throw new Error('Not authenticated');
    await updatePassword(firebaseUser, newPassword);
    await updateDoc(doc(db, 'users', firebaseUser.uid), {
      mustChangePassword: false,
    });
    await refreshUser();
  };

  const updateProfilePhoto = async (photoUrl: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid), { photoUrl });
    setUser((prev) => (prev ? { ...prev, photoUrl } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        resetPassword,
        refreshUser,
        changePassword,
        updateProfilePhoto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
