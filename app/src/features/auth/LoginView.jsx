import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../utils/i18n';
import logo from '../../assets/logo.png';

export function LoginView({ onLoginSuccess }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captcha, setCaptcha] = useState({ a: 0, b: 0, challenge_id: '' });
  const [captchaInput, setCaptchaInput] = useState('');

  const fetchCaptcha = async () => {
    try {
      const response = await fetch(`${window.yeePOSData.apiUrl}yeepos/v1/captcha`);
      const data = await response.json();
      setCaptcha({
        a: data.a,
        b: data.b,
        challenge_id: data.challenge_id
      });
      setCaptchaInput('');
    } catch (err) {
      console.error('Failed to fetch captcha', err);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!captchaInput) {
       setError(t('login.captcha_placeholder'));
       return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${window.yeePOSData.apiUrl}yeepos/v1/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          username, 
          password,
          captcha_result: captchaInput,
          challenge_id: captcha.challenge_id
        })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        onLoginSuccess(data.user);
      } else {
        const errMsg = data.message || data.code || t('login.failed');
        setError(errMsg);
        fetchCaptcha();
      }
    } catch (err) {
      setError(t('login.error'));
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0E] overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--brand-primary)]/10 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse delay-700"></div>
      
      <div className="w-full max-w-lg p-1 px-1 rounded-[40px] bg-gradient-to-br from-[#2C2C35] to-[#141419] shadow-2xl relative z-10 transition-all duration-500 hover:scale-[1.01]">
         <div className="bg-[#141419] rounded-[39px] p-12 space-y-10 border border-[#2C2C35]/50 backdrop-blur-xl">
            <div className="text-center space-y-3">
               <div className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/20 transform -rotate-6 p-4">
                  <img src={logo} alt="YeePOS" className="w-full h-full object-contain" />
               </div>
               <h1 className="text-white text-3xl font-black mt-6 tracking-tighter">YeePOS <span className="text-[var(--brand-primary)]">.</span></h1>
               <p className="text-gray-500 text-xs font-black uppercase tracking-[0.3em]">{t('login.subtitle')}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
               <div className="space-y-1 group">
                  <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 transition-colors group-focus-within:text-[var(--brand-primary)]">{t('login.username')}</label>
                  <div className="relative">
                     <span className="material-icons-outlined absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 text-lg group-focus-within:text-[var(--brand-primary)] transition-colors">person</span>
                     <input 
                       id="username"
                       name="username"
                       autoComplete="username"
                       type="text" 
                       required
                       value={username}
                       onChange={(e) => setUsername(e.target.value)}
                       className="w-full bg-[#0A0A0E] border border-[#2C2C35] text-white rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/5 transition-all font-bold placeholder:text-gray-800"
                       placeholder={t('login.placeholder_username')}
                     />
                  </div>
               </div>

               <div className="space-y-1 group">
                  <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 transition-colors group-focus-within:text-[var(--brand-primary)]">{t('login.password')}</label>
                  <div className="relative">
                     <span className="material-icons-outlined absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 text-lg group-focus-within:text-[var(--brand-primary)] transition-colors">lock</span>
                     <input 
                       id="password"
                       name="password"
                       autoComplete="current-password"
                       type="password" 
                       required
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full bg-[#0A0A0E] border border-[#2C2C35] text-white rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/5 transition-all font-bold placeholder:text-gray-800"
                       placeholder="••••••••"
                     />
                  </div>
               </div>

               <div className="space-y-1 group">
                  <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest ml-4 transition-colors group-focus-within:text-[var(--brand-primary)]">
                    {captcha.challenge_id ? t('login.captcha_label', { a: captcha.a, b: captcha.b }) : '...'}
                  </label>
                  <div className="relative">
                     <span className="material-icons-outlined absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 text-lg group-focus-within:text-[var(--brand-primary)] transition-colors">verified_user</span>
                     <input 
                       id="captcha"
                       name="captcha_result"
                       autoComplete="off"
                       type="number" 
                       required
                       value={captchaInput}
                       onChange={(e) => setCaptchaInput(e.target.value)}
                       className="w-full bg-[#0A0A0E] border border-[#2C2C35] text-white rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/5 transition-all font-bold placeholder:text-gray-800"
                       placeholder={t('login.captcha_placeholder')}
                     />
                  </div>
               </div>

               {error && (
                 <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold p-4 rounded-xl flex items-center gap-3 animate-head-shake">
                    <span className="material-icons-outlined text-lg">error_outline</span>
                    {error}
                 </div>
               )}

               <button 
                 type="submit"
                 disabled={loading || !captcha.challenge_id}
                 className="w-full bg-gradient-to-r from-[var(--brand-primary)] to-[color-mix(in srgb, var(--brand-primary), black 15%)] text-white font-black tracking-widest py-5 rounded-2xl shadow-xl shadow-[var(--brand-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
               >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span>{t('login.button')}</span>
                  )}
               </button>
            </form>

            <div className="text-center pt-4">
               <p className="text-gray-700 text-[10px] font-black tracking-widest">{t('login.authorized_only')}</p>
            </div>
         </div>
      </div>
    </div>
  );
}
