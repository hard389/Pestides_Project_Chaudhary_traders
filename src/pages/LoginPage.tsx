import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { Sun, Moon, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  
  // Form & Interaction States
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Async Operation States
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 🔥 MAIN FIX: Check if user is already logged in (Back button protection)
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/dashboard', { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Sync current layout with HTML document classList
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!auth) {
      setError("Firebase setup is missing! Please configure VITE_FIREBASE variables in your .env file, mere jaan.");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // History replace fix
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password. Please verify credentials, mere jaan!');
      } else if (err.code === 'auth/invalid-email') {
        setError('The email address structure is badly formatted.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Account temporarily locked due to too many failed attempts. Try again later.');
      } else {
        setError(err.message || 'An error occurred while communicating with the database.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-12 transition-colors duration-700 ease-in-out ${
      isDark 
        ? 'bg-gradient-to-b from-[#0B1224] via-[#0F172A] to-[#0B1224]' 
        : 'bg-gradient-to-b from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0]'
    }`}>
      
      {/* Day/Night Controller */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <button
          onClick={() => setIsDark(!isDark)}
          type="button"
          className={`relative w-16 h-9 rounded-full p-1 transition-all duration-500 shadow-lg border focus:outline-none ${
            isDark ? 'bg-[#131E35] border-orange-500/30' : 'bg-slate-200 border-slate-300'
          }`}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center transform transition-all duration-500 ease-out ${
            isDark ? 'translate-x-7 bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'translate-x-0 bg-white text-slate-600'
          }`}>
            {isDark ? <Moon className="w-3.5 h-3.5 fill-white stroke-white" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
          </div>
        </button>
      </div>

      <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Login Card */}
      <div className={`w-full max-w-md relative z-10 p-6 md:p-8 rounded-[2.5rem] border transition-all duration-700 ${
        isDark 
          ? 'bg-[#131E35]/90 border-slate-700/50 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md' 
          : 'bg-white border-slate-200 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.08)]'
      }`}>
        
        <div className="flex flex-col items-center text-center">
          <div className="w-36 h-36 mb-1 drop-shadow-md">
            <img 
              src="/ChatGPT Image Jul 20, 2026, 05_05_41 PM.png" 
              alt="EduTrack Enterprise Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Chaudhary Traders
          </h2>
          <p className={`text-xs mt-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Sign in to continue to your workspace
          </p>
        </div>

        {error && (
          <div className="p-3 mt-4 -mb-2 rounded-xl text-xs font-medium flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 animate-pulse">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4" autoComplete="off">
          
          <div className="space-y-1">
            <Label htmlFor="email" className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Email Address</Label>
            <Input 
              id="email" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`rounded-xl h-11 transition-all ${isDark ? 'bg-[#0B1224] border-slate-700 text-white focus:border-orange-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'}`}
              placeholder="teacher@edutrack.com"
              autoComplete="off"
              required 
            />
          </div>

          <div className="space-y-1 relative">
            <Label htmlFor="password" className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Password</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`rounded-xl h-11 pr-10 transition-all ${isDark ? 'bg-[#0B1224] border-slate-700 text-white focus:border-orange-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'}`}
                autoComplete="new-password"
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember" 
                className={`rounded-md transition-all ${
                  isDark 
                    ? 'border-slate-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500' 
                    : 'border-slate-300 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500'
                }`} 
              />
              <label htmlFor="remember" className={`font-semibold cursor-pointer select-none ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Remember Me
              </label>
            </div>
            <a href="#" className="font-bold text-orange-400 hover:text-orange-500 transition-colors">
              Forgot Password?
            </a>
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold tracking-wide shadow-lg shadow-orange-500/20 hover:opacity-95 transform active:scale-[0.99] transition-all duration-300 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Login"
            )}
          </Button>

         

        </form>
      </div>
    </div>
  );
}
