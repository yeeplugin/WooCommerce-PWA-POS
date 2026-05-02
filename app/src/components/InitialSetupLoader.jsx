import React from 'react';
import logo from '../assets/logo.png';
import { useTranslation } from '../utils/i18n';

export function InitialSetupLoader({ progress, message }) {
  const { t } = useTranslation();

  // If no translation string exists, fallback to English / general text
  const title = t('setup.title') === 'setup.title' ? 'Setting up terminal...' : t('setup.title');

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0A0A0E] overflow-hidden z-[100]">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--brand-primary)]/10 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse delay-700"></div>
      
      <div className="relative z-10 flex flex-col items-center space-y-10 w-full max-w-sm px-6">
        <div className="w-28 h-28 bg-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-[var(--brand-primary)]/20 animate-bounce p-5 transform -rotate-3">
          <img src={logo} alt="YeePOS" className="w-full h-full object-contain" />
        </div>
        
        <div className="text-center space-y-3 w-full">
          <h2 className="text-white text-2xl font-black tracking-tight">{title}</h2>
          <p className="text-gray-400 text-sm font-medium h-5 transition-all duration-300">{message}</p>
        </div>

        <div className="w-full space-y-2 pt-4">
          <div className="h-3 w-full bg-[#141419] rounded-full overflow-hidden border border-[#2C2C35] shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-[var(--brand-primary)] to-blue-400 rounded-full transition-all duration-700 ease-out relative"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            >
              <div 
                className="absolute inset-0 w-[200%] animate-[shimmer_2s_infinite]" 
                style={{ 
                  backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)', 
                  transform: 'skewX(-20deg)' 
                }}
              ></div>
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] font-black tracking-widest uppercase">
            <span className="text-gray-600">{t('setup.loading')}</span>
            <span className="text-[var(--brand-primary)]">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(50%) skewX(-20deg); }
        }
      `}</style>
    </div>
  );
}
