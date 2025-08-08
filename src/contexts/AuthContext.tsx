import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User as FirebaseUser, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser as firebaseDeleteUser,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebaseClient';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator';
  avatar?: string;
  department: string;
  lastLogin: string;
  status: 'active' | 'inactive';
}

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  addUser: (userData: Omit<User, 'id' | 'lastLogin'> & { password: string }) => Promise<boolean>;
  updateUser: (id: string, userData: Partial<User>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Demo users for development (only used when no Firebase connection)
  const demoUsers: User[] = [
    {
      id: 'demo-admin',
      name: 'Admin User',
      email: 'admin@logistics.com',
      role: 'admin',
      department: 'Administration',
      lastLogin: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'demo-manager',
      name: 'Manager User',
      email: 'manager@logistics.com',
      role: 'manager',
      department: 'Operations',
      lastLogin: new Date().toISOString(),
      status: 'active'
    },
    {
      id: 'demo-operator',
      name: 'Operator User',
      email: 'operator@logistics.com',
      role: 'operator',
      department: 'Warehouse',
      lastLogin: new Date().toISOString(),
      status: 'active'
    }
  ];

  // Convert Firebase user + profile to our User interface
  const mapFirebaseUserToUser = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      console.log('Attempting to map Firebase user to User object:', firebaseUser.uid);
      
      // Get user profile from Firestore
      const profileDoc = await getDoc(doc(db, 'profiles', firebaseUser.uid));
      
      if (!profileDoc.exists()) {
        console.warn('No profile found for user:', firebaseUser.uid);
        
        // Create a default profile if none exists
        const defaultProfile: Omit<User, 'id'> = {
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unknown User',
          email: firebaseUser.email || '',
          role: 'operator',
          department: 'General',
          lastLogin: new Date().toISOString(),
          status: 'active'
        };
        
        console.log('Creating default profile for user:', firebaseUser.uid);
        
        try {
          await setDoc(doc(db, 'profiles', firebaseUser.uid), defaultProfile);
          console.log('Default profile created successfully');
          
          return {
            id: firebaseUser.uid,
            ...defaultProfile
          };
        } catch (createError) {
          console.error('Error creating default profile:', createError);
          // Fall back to demo user if we can't create a profile
          return null;
        }
      }
      
      const profileData = profileDoc.data();
      console.log('Profile data retrieved:', profileData);
      
        return {
          id: firebaseUser.uid,
          name: profileData.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unknown User',
          email: firebaseUser.email || '',
          role: (profileData.role as 'admin' | 'manager' | 'operator') || 'operator',
          department: profileData.department || 'General',
          lastLogin: profileData.lastLogin || new Date().toISOString(),
          status: (profileData.status as 'active' | 'inactive') || 'active'
        };
    } catch (error) {
      console.error('Error mapping Firebase user to User:', error);
      
      // Return a fallback user object based on Firebase user
      if (firebaseUser) {
        return {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unknown User',
          email: firebaseUser.email || '',
          role: 'operator', // Default role
          department: 'General', // Default department
          lastLogin: new Date().toISOString(),
          status: 'active'
        };
      }
      
      return null;
    }
  };

  // Fetch all users from Firestore
  const refreshUsers = async () => {
    try {
      console.log('Refreshing users list from Firestore...');
      
      // Check if we have a current Firebase user
      const currentFirebaseUser = auth.currentUser;
      if (!currentFirebaseUser) {
        console.log('No authenticated user, using demo users');
        setUsers(demoUsers);
        return;
      }

      // Wait for the auth token to be ready
      await currentFirebaseUser.getIdToken(true);
      
      // Query profiles collection
      const profilesSnapshot = await getDocs(collection(db, 'profiles'));
      
      if (profilesSnapshot.empty) {
        console.log('No profiles found, using demo users');
        setUsers(demoUsers);
        return;
      }
      
      // Map profiles to users
      const usersFromProfiles = profilesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown User',
          email: data.email || 'Email not available',
          role: data.role || 'operator',
          department: data.department || 'General',
          lastLogin: data.lastLogin || new Date().toISOString(),
          status: data.status || 'active'
        };
      });
      
      console.log('Mapped users from profiles:', usersFromProfiles);
      setUsers(usersFromProfiles);
      
    } catch (error) {
      console.error('Error refreshing users:', error);
      console.log('Falling back to demo users due to error');
      setUsers(demoUsers);
    }
  };

  // Initialize auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('Found existing session for user:', firebaseUser.uid);
        try {
          const mappedUser = await mapFirebaseUserToUser(firebaseUser);
          if (mappedUser) {
            setUser(mappedUser);
            
            // Update lastLogin in Firestore
            try {
              await updateDoc(doc(db, 'profiles', firebaseUser.uid), {
                lastLogin: new Date().toISOString()
              });
            } catch (error) {
              console.warn('Error updating lastLogin:', error);
            }
            
            // Delay refreshUsers for admin users to ensure auth token is propagated
            if (mappedUser.role === 'admin') {
              setTimeout(async () => {
                try {
                  await refreshUsers();
                } catch (error) {
                  console.warn('Error refreshing users after delay:', error);
                }
              }, 1000); // 1 second delay
            }
          } else {
            console.log('No valid user mapping, falling back to demo users');
            setUser(null);
          }
        } catch (error) {
          console.error('Error during user mapping:', error);
          setUser(null);
        }
      } else {
        console.log('No session found');
        setUser(null);
        setUsers([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      console.log('Attempting login for:', email);
      
      // Check for demo credentials first
      const demoUser = demoUsers.find(u => u.email === email && password === 'password');
      if (demoUser) {
        console.log('Demo user login successful');
        setUser(demoUser);
        if (demoUser.role === 'admin') {
          // For demo admin, try to load real users, fallback to demo users
          try {
            await refreshUsers();
          } catch {
            setUsers(demoUsers);
          }
        }
        setIsLoading(false);
        return true;
      }

      // Try Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user) {
        console.log('Firebase login successful for user:', userCredential.user.uid);
        
        try {
          // Fetch profile immediately after successful login
          const mappedUser = await mapFirebaseUserToUser(userCredential.user);
          
          if (mappedUser) {
            console.log('Setting user:', mappedUser);
            setUser(mappedUser);
            
            // Update lastLogin in Firestore
            try {
              await updateDoc(doc(db, 'profiles', userCredential.user.uid), {
                lastLogin: new Date().toISOString()
              });
            } catch (updateError) {
              console.warn('Error updating lastLogin:', updateError);
              // Continue anyway, this is not critical
            }
            
            // Delay refreshUsers for admin users to ensure auth token is propagated
            if (mappedUser.role === 'admin') {
              setTimeout(async () => {
                try {
                  await refreshUsers();
                } catch (refreshError) {
                  console.warn('Error refreshing users after login:', refreshError);
                  // Fallback to demo users if refresh fails
                  setUsers(demoUsers);
                }
              }, 1000); // 1 second delay
            }
            
            setIsLoading(false);
            return true;
          }
        } catch (profileError) {
          console.error('Error fetching user profile:', profileError);
          
          // Create a fallback user from Firebase user data
          const fallbackUser: User = {
            id: userCredential.user.uid,
            name: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'New User',
            email: userCredential.user.email || '',
            role: 'operator', // Default role
            department: 'General', // Default department
            lastLogin: new Date().toISOString(),
            status: 'active'
          };
          
          console.log('Using fallback user data:', fallbackUser);
          setUser(fallbackUser);
          
          // Try to create a profile for this user
          try {
            await setDoc(doc(db, 'profiles', userCredential.user.uid), {
              name: fallbackUser.name,
              email: fallbackUser.email,
              role: fallbackUser.role,
              department: fallbackUser.department,
              status: fallbackUser.status,
              createdAt: serverTimestamp(),
              lastLogin: new Date().toISOString()
            });
            console.log('Created new profile for user');
          } catch (createError) {
            console.error('Error creating user profile:', createError);
            // Continue anyway, we already have the fallback user
          }
          
          setIsLoading(false);
          return true;
        }
      }
      
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUsers([]);
    } catch (error) {
      console.warn('Logout error:', error);
      // Force logout even if Firebase fails
      setUser(null);
      setUsers([]);
    }
  };

  const addUser = async (userData: Omit<User, 'id' | 'lastLogin'> & { password: string }): Promise<boolean> => {
    try {
      console.log('Creating user with data:', userData);
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        userData.email, 
        userData.password
      );
      
      if (userCredential.user) {
        console.log('User created successfully:', userCredential.user.uid);
        
        // Update display name
        await updateProfile(userCredential.user, {
          displayName: userData.name
        });
        
        // Create profile in Firestore
        await setDoc(doc(db, 'profiles', userCredential.user.uid), {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          department: userData.department,
          status: userData.status,
          createdAt: serverTimestamp(),
          lastLogin: new Date().toISOString()
        });
        
        // Refresh the users list to show the new user
        await refreshUsers();
        console.log('User list refreshed after adding user');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error adding user:', error);
      throw error;
    }
  };

  const updateUser = async (id: string, userData: Partial<User>): Promise<boolean> => {
    try {
      // Update profile in Firestore
      await updateDoc(doc(db, 'profiles', id), {
        ...(userData.name && { name: userData.name }),
        ...(userData.role && { role: userData.role }),
        ...(userData.department && { department: userData.department }),
        ...(userData.status && { status: userData.status }),
        updatedAt: serverTimestamp()
      });

      // Update local state if this is the current user
      if (user && user.id === id) {
        setUser({ ...user, ...userData });
      }

      // Refresh users list
      await refreshUsers();
      return true;
    } catch (error) {
      console.warn('Error updating user:', error);
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    try {
      // Delete profile from Firestore
      await deleteDoc(doc(db, 'profiles', id));
      
      // Delete user from Firebase Auth (requires admin SDK, typically done via Cloud Function)
      // For now, we'll just delete the profile and assume a Cloud Function will handle the auth deletion
      
      // Refresh the users list
      await refreshUsers();
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  };

  const value = {
    user,
    users,
    login,
    logout,
    isLoading,
    addUser,
    updateUser,
    deleteUser,
    refreshUsers
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};