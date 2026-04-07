import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { LogIn, UserPlus, AlertCircle, Eye, EyeOff, CheckCircle2, Moon, Sun } from 'lucide-react';
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';

export default function Auth({ theme, toggleTheme }: { theme?: 'light' | 'dark', toggleTheme?: () => void }) {
  const { login, isPendingApproval, logout } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        // Profile creation is handled in AuthContext's onAuthStateChanged
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let errorMessage = 'An error occurred. Please try again.';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'This sign-in method is not enabled. Please enable Email/Password in the Firebase Console.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google auth error:', err);
      let errorMessage = 'Google authentication failed.';
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in popup was closed before completion.';
      } else if (err.code === 'auth/cancelled-by-user') {
        errorMessage = 'Authentication was cancelled.';
      } else if (err.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized for Google Sign-in. Please add it to the "Authorized domains" list in your Firebase Console (Authentication > Settings).';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setMessage('Password reset email sent. Please check your inbox.');
      setIsForgotPassword(false);
    } catch (err: any) {
      console.error('Reset password error:', err);
      let errorMessage = 'Failed to send reset email. Please try again.';
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-black transition-colors duration-300 relative">
      <div className="absolute top-8 right-8">
        <button
          onClick={toggleTheme}
          className="p-3 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 p-10 bg-white dark:bg-[#121212] rounded-[40px] border border-zinc-200 dark:border-zinc-800/50 shadow-2xl transition-colors duration-300"
      >
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-zinc-500 text-lg">
            {isForgotPassword 
              ? 'Enter your email to receive a reset link' 
              : isLogin 
              ? 'Sign in to manage your expenses' 
              : 'Join us to start tracking your finances'}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-500"
          >
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        {isPendingApproval && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-[30px] space-y-4"
          >
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
              <AlertCircle size={24} />
              <p className="text-lg font-bold">Account Pending Approval</p>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
              Your account has been created successfully but is currently waiting for administrator approval. 
              You will be able to access the dashboard once your account is approved.
            </p>
            <button
              onClick={logout}
              className="w-full py-3 bg-amber-600 text-white rounded-2xl font-bold text-sm hover:bg-amber-700 transition-colors"
            >
              Sign Out
            </button>
          </motion.div>
        )}

        {message && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-500"
          >
            <CheckCircle2 size={20} />
            <p className="text-sm font-medium">{message}</p>
          </motion.div>
        )}

        {!isForgotPassword && !isPendingApproval && (
          <div className="space-y-6">
            <button
              onClick={handleGoogleAuth}
              className="w-full py-4 bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-2xl font-semibold flex items-center justify-center gap-3 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white transition-all"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>

            <div className="relative flex items-center justify-center">
              <span className="absolute px-4 bg-white dark:bg-[#121212] text-[10px] text-zinc-400 dark:text-zinc-600 font-bold uppercase tracking-[0.2em] transition-colors duration-300">Or use email</span>
              <div className="w-full h-[1px] bg-zinc-200 dark:bg-zinc-800/50 transition-colors duration-300"></div>
            </div>
          </div>
        )}

        {!isPendingApproval && (
          <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-6">
            {!isLogin && !isForgotPassword && (
            <div className="space-y-3">
              <label className="text-sm font-bold text-zinc-400 dark:text-zinc-500 ml-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-5 py-4 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-all"
                placeholder="John Doe"
              />
            </div>
          )}
          <div className="space-y-3">
            <label className="text-sm font-bold text-zinc-400 dark:text-zinc-500 ml-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-5 py-4 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-all"
              placeholder="name@example.com"
            />
          </div>
          {!isForgotPassword && (
            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-bold text-zinc-400 dark:text-zinc-500">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs font-bold text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-5 py-4 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-all pr-14"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-[20px] font-bold text-lg hover:bg-black dark:hover:bg-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? 'Processing...' : isForgotPassword ? 'Send Reset Link' : isLogin ? (
              <><LogIn size={22} /> Sign In</>
            ) : (
              <><UserPlus size={22} /> Sign Up</>
            )}
          </button>
        </form>
      )}

      {!isPendingApproval && (
        <div className="text-center">
          {isForgotPassword ? (
            <button
              onClick={() => setIsForgotPassword(false)}
              className="text-sm font-bold text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              Back to Sign In
            </button>
          ) : (
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-bold text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          )}
        </div>
      )}
      </motion.div>
    </div>
  );
}
