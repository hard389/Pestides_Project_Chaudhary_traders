import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '@/lib/firebase'; 
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { 
  Sun, Moon, Eye, EyeOff, Camera, ArrowLeft, 
  AlertCircle, Check, CheckCircle2, XCircle, Mail, Lock, User, Trash2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop';

export default function RegisterPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDark, setIsDark] = useState(true);
  
  // Form Field States
  const [name, setName] = useState('');
  const [whatsappDigits, setWhatsappDigits] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('JazzCash');
  const [profileImage, setProfileImage] = useState<string>(DEFAULT_AVATAR);
  
  // UI Helper States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Handle Profile Image Upload / Edit
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be less than 5MB, mere jaan!");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Picture Delete
  const handleDeleteImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setProfileImage(DEFAULT_AVATAR);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // WhatsApp Input Formatter (+92 handled automatically)
  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (raw.startsWith('+92')) raw = raw.replace('+92', '');
    else if (raw.startsWith('92')) raw = raw.replace('92', '');
    else if (raw.startsWith('0')) raw = raw.replace(/^0+/, '');
    
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 10);
    setWhatsappDigits(digitsOnly);
  };

  // Validations Checkers
  const isWhatsappValid = whatsappDigits.length === 10;
  const isGmailValid = /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email.trim());
  const hasCapitalLetter = /[A-Z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = password.length >= 6 && hasCapitalLetter && hasSpecialChar;
  const isPasswordMatched = password === confirmPassword && confirmPassword.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError("Teacher Name is required, mere jaan!");
      return;
    }

    if (!isGmailValid) {
      setError("Please enter a valid Gmail address ending with @gmail.com");
      return;
    }

    if (!isWhatsappValid) {
      setError(`Please enter complete 10 digits after +92. (${10 - whatsappDigits.length} remaining)`);
      return;
    }

    if (!isPasswordValid) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long!");
      } else if (!hasCapitalLetter) {
        setError("Password must contain at least 1 Uppercase (Capital) Letter!");
      } else if (!hasSpecialChar) {
        setError("Password must contain at least 1 Special Character (@, #, $, etc.)!");
      }
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and Confirm Password do not match, mere jaan!");
      return;
    }

    setLoading(true);

    if (!auth || !db) {
      setError("Firebase setup is missing! Please configure environment variables.");
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const fullWhatsappNumber = `+92${whatsappDigits}`;

    try {
      // 1. Create User Account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 2. Save Document in "users" collection with Email as Document ID
      const userDocRef = doc(db, "users", cleanEmail);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: cleanEmail,
        teacherName: name.trim(),
        whatsappNumber: fullWhatsappNumber,
        paymentMethod: paymentMethod,
        profileImage: profileImage,
        active: true,
        role: "teacher",
        createdAt: new Date().toISOString()
      });

      // 3. Redirect to Login Page on Success (Default dummy class step removed)
      navigate('/login', { 
        state: { registeredEmail: cleanEmail, message: "Registration successful! Please login with your credentials." } 
      });

    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered!');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else {
        setError(err.message || 'Something went wrong during registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8 transition-colors duration-700 ease-in-out ${
      isDark 
        ? 'bg-gradient-to-b from-[#0B1224] via-[#0F172A] to-[#0B1224]' 
        : 'bg-gradient-to-b from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0]'
    }`}>
      
      {/* Hidden File Input for Picture Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Day / Night Toggle Button */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <button
          onClick={() => setIsDark(!isDark)}
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

      {/* Ambient Glows */}
      <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Card Container */}
      <div className={`w-full max-w-md relative z-10 p-6 md:p-8 rounded-[2.5rem] border transition-all duration-700 ${
        isDark 
          ? 'bg-[#131E35]/90 border-slate-700/50 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md' 
          : 'bg-white border-slate-200 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.08)]'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link to="/login" className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold tracking-wide ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Teacher Register</span>
          </div>
          <div className="w-9" />
        </div>

        {/* Profile Picture Box with Edit & Delete options */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full border-2 border-orange-500/60 p-1 overflow-hidden transition-transform duration-300 shadow-md">
              <img 
                src={profileImage} 
                alt="Teacher Profile" 
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            {/* Edit Button (Camera Icon) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#1E293B] border-2 border-orange-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-orange-500 transition-colors"
              title="Upload / Change Picture"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Delete Button (Trash Icon - visible if picture modified) */}
            {profileImage !== DEFAULT_AVATAR && (
              <button
                type="button"
                onClick={handleDeleteImage}
                className="absolute bottom-0 -left-1 w-8 h-8 bg-red-600 border-2 border-white rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-700 transition-colors"
                title="Remove Picture"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 font-medium">Click camera to upload or change picture</span>
        </div>

        {/* Glowing Animated Red Notification Alert */}
        {error && (
          <div className="p-3.5 mb-5 rounded-2xl text-xs font-bold flex items-center gap-2.5 bg-red-500/15 border-2 border-red-500/60 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse transition-all">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500 animate-bounce" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* Teacher Name */}
          <div className="space-y-1">
            <Label htmlFor="name" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Teacher Name
            </Label>
            <div className="relative">
              <Input 
                id="name" 
                type="text" 
                placeholder="Ahmed Ali"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`rounded-xl h-11 pl-9 transition-all ${
                  isDark ? 'bg-[#0B1224] border-slate-700 text-white focus:border-orange-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'
                }`}
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1">
            <Label htmlFor="email" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Gmail Address (@gmail.com)
            </Label>
            <div className="relative">
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`rounded-xl h-11 pl-9 pr-10 transition-all ${
                  email.length === 0
                    ? (isDark ? 'bg-[#0B1224] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
                    : isGmailValid
                      ? 'bg-emerald-500/10 border-emerald-500/80 text-emerald-400 focus:border-emerald-500'
                      : 'bg-red-500/10 border-red-500/80 text-red-400 focus:border-red-500'
                }`}
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {email.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isGmailValid ? <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                </div>
              )}
            </div>
            {email.length > 0 && !isGmailValid && (
              <p className="text-[11px] text-red-400 font-semibold mt-1">Email must end strictly with @gmail.com</p>
            )}
          </div>

          {/* Contact WhatsApp */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label htmlFor="whatsapp" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Contact WhatsApp
              </Label>
              <span className={`text-[11px] font-bold ${isWhatsappValid ? 'text-emerald-500' : 'text-slate-400'}`}>
                {whatsappDigits.length} / 10 Digits
              </span>
            </div>
            
            <div className="relative flex items-center">
              <div className={`absolute left-0 top-0 bottom-0 px-3 flex items-center font-bold text-sm rounded-l-xl border-r z-10 ${
                isDark ? 'bg-slate-800 border-slate-700 text-orange-400' : 'bg-slate-200 border-slate-300 text-orange-600'
              }`}>
                +92
              </div>

              <Input 
                id="whatsapp" 
                type="tel" 
                placeholder="303 2093780"
                value={whatsappDigits}
                onChange={handleWhatsappChange}
                className={`rounded-xl h-11 pl-16 pr-10 font-bold transition-all ${
                  whatsappDigits.length === 0
                    ? (isDark ? 'bg-[#0B1224] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
                    : isWhatsappValid
                      ? 'bg-emerald-500/10 border-emerald-500/80 text-emerald-400 focus:border-emerald-500'
                      : 'bg-red-500/10 border-red-500/80 text-red-400 focus:border-red-500'
                }`}
              />

              {whatsappDigits.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isWhatsappValid ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500/70" />
                  )}
                </div>
              )}
            </div>

            {whatsappDigits.length > 0 && !isWhatsappValid && (
              <p className="text-[11px] text-red-400 font-semibold mt-1">
                Please enter remaining {10 - whatsappDigits.length} digits after +92.
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <Label htmlFor="password" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Password
            </Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`rounded-xl h-11 pl-9 pr-10 transition-all ${
                  password.length === 0 
                    ? (isDark ? 'bg-[#0B1224] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
                    : isPasswordValid
                      ? 'bg-emerald-500/10 border-emerald-500/80 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/80 text-red-400'
                }`}
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {password.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-medium">
                <span className={`flex items-center gap-1 ${hasCapitalLetter ? 'text-emerald-400' : 'text-red-400'}`}>
                  {hasCapitalLetter ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} 1 Capital Letter
                </span>
                <span className={`flex items-center gap-1 ${hasSpecialChar ? 'text-emerald-400' : 'text-red-400'}`}>
                  {hasSpecialChar ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} 1 Special Char
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1">
            <Label htmlFor="confirmPassword" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Confirm Password
            </Label>
            <div className="relative">
              <Input 
                id="confirmPassword" 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`rounded-xl h-11 pl-9 pr-10 transition-all ${
                  confirmPassword.length === 0
                    ? (isDark ? 'bg-[#0B1224] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900')
                    : isPasswordMatched
                      ? 'bg-emerald-500/10 border-emerald-500/80 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/80 text-red-400'
                }`}
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2 pt-1">
            <Label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Payment Method
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {['JazzCash', 'easypaisa', 'PayPal'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2.5 px-2 text-xs font-bold rounded-xl border transition-all duration-300 flex items-center justify-center ${
                    paymentMethod === method
                      ? 'bg-orange-500/10 border-orange-500 text-orange-500 shadow-sm shadow-orange-500/10'
                      : isDark
                        ? 'bg-[#0B1224] border-slate-700 text-slate-400 hover:text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{method}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold tracking-wide shadow-lg shadow-orange-500/20 hover:opacity-95 transform active:scale-[0.99] transition-all duration-300 mt-4"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Create Account"
            )}
          </Button>

          {/* Login Link */}
          <div className="text-center text-xs pt-2">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Already have an account? </span>
            <Link to="/login" className="font-bold text-orange-400 hover:text-orange-500 transition-colors underline-offset-4 hover:underline ml-1">
              Login
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}
