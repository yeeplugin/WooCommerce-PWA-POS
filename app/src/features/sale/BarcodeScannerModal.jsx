import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../utils/i18n';

export function BarcodeScannerModal({ onClose, onScan, formatPrice }) {
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const [isSupported, setIsSupported] = useState(true);

  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Check for BarcodeDetector support
    if (!('BarcodeDetector' in window)) {
      setIsSupported(false);
      setError(t('sale.scanner_unsupported'));
      return;
    }

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          } 
        });
        
        if (!isMountedRef.current) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Initialize detector - support common POS formats + QR CODE
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'codabar', 'itf', 'qr_code']
        });

        const scan = async () => {
          if (!isMountedRef.current) return;
          
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && isMountedRef.current) {
                const code = barcodes[0].rawValue;
                onScan(code);
                onClose(); // Auto-close on success
                return;
              }
            } catch (err) {
              console.error('Detection error:', err);
            }
          }
          
          if (isMountedRef.current) {
            animationFrameRef.current = requestAnimationFrame(scan);
          }
        };

        animationFrameRef.current = requestAnimationFrame(scan);
      } catch (err) {
        if (isMountedRef.current) {
          setError(t('sale.camera_denied'));
        }
        console.error(err);
      }
    }

    startCamera();

    return () => {
      isMountedRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Stop all tracks in the stream immediately
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => {
          track.stop();
          streamRef.current.removeTrack(track);
        });
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.removeAttribute('src'); // Completely clear the source
        videoRef.current.load();
      }
    };
  }, [onScan, t, onClose]);

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-300">
       <div className="bg-[#141419] w-full max-w-lg rounded-[32px] border border-[#2C2C35] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <header className="px-6 py-5 border-b border-[#2C2C35] flex justify-between items-center bg-[#141419] shrink-0">
             <div className="flex items-center gap-3">
                <svg className="w-5 h-5 fill-[var(--brand-primary)]" viewBox="0 0 24 24">
                  <path d="M2 5h2v14H2V5zm4 0h1v14H6V5zm3 0h3v14H9V5zm4 0h1v14h-1V5zm3 0h2v14h-2V5zm3 0h1v14h-1V5zM4 5h1v14H4V5zm10 0h2v14h-2V5z"/>
                </svg>
                <h2 className="text-white font-black text-sm uppercase tracking-[0.1em]">{t('sale.barcode_scanner')}</h2>
             </div>
             <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
                <span className="material-icons-outlined">close</span>
             </button>
          </header>

          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
             {error ? (
                <div className="text-center p-8 space-y-4">
                   <span className="material-icons-outlined text-red-500 text-5xl">error_outline</span>
                   <p className="text-gray-400 text-sm font-medium max-w-xs mx-auto">{error}</p>
                   {!isSupported && (
                      <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest mt-4">{t('sale.required_scanner')}</p>
                   )}
                </div>
             ) : (
                <>
                   <video 
                     ref={videoRef} 
                     autoPlay 
                     playsInline 
                     className="w-full h-full object-cover opacity-100"
                   />
                   {/* Scanning Glow Overlay */}
                   <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-64 h-48 border-2 border-[var(--brand-primary)]/50 rounded-2xl relative">
                         <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[var(--brand-primary)] rounded-tl-lg"></div>
                         <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[var(--brand-primary)] rounded-tr-lg"></div>
                         <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[var(--brand-primary)] rounded-bl-lg"></div>
                         <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[var(--brand-primary)] rounded-br-lg"></div>
                         
                         {/* Moving Laser Line */}
                         <div className="absolute left-2 right-2 h-1 bg-red-600 shadow-[0_0_15px_#dc2626] animate-scan-line top-1/2"></div>
                      </div>
                      <p className="mt-8 text-white/50 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">{t('sale.align_barcode')}</p>
                   </div>
                </>
             )}
          </div>

          <footer className="p-6 bg-[#1A1A20] shrink-0 border-t border-[#2C2C35]">
             <div className="flex items-start gap-4 text-gray-500">
                <span className="material-icons-outlined text-sm">info</span>
                <p className="text-[11px] leading-relaxed">
                   {t('sale.scanner_info')}
                </p>
             </div>
          </footer>
       </div>

       <style>{`
          @keyframes scan-line {
            0% { top: 10%; opacity: 0; }
            50% { opacity: 1; }
            100% { top: 90%; opacity: 0; }
          }
          .animate-scan-line {
            animation: scan-line 2.5s ease-in-out infinite;
            position: absolute;
          }
       `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}
