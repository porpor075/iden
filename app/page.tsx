'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Smartphone, Loader2, CheckCircle2, User, Fingerprint } from 'lucide-react';

export default function DesktopPage() {
  const [sessionId] = useState(`sess_${Math.random().toString(36).substring(2, 9)}`);
  const [status, setStatus] = useState<'waiting' | 'verified'>('waiting');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
    
    // 1. สร้าง Session ใน Supabase รอไว้ก่อน
    const createInitialSession = async () => {
      await supabase.from('sessions').insert([{ 
        id: sessionId, 
        is_verified: false,
        created_at: new Date().toISOString()
      }]);
    };
    createInitialSession();

    // 2. รอฟังการอัปเดตข้อมูลแบบ Real-time
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'sessions', 
          filter: `id=eq.${sessionId}` 
        }, 
        async (payload) => {
          console.log('Real-time update detected, fetching full record...');
          // เมื่อมีการอัปเดต ให้ดึงข้อมูลใหม่ทั้งหมดอีกครั้งเพื่อเลี่ยงปัญหา Payload ขนาดใหญ่
          const { data } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

          if (data && data.is_verified) {
            setCapturedImage(data.face_image);
            setVerifiedAt(data.verified_at);
            setStatus('verified');
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // หน้าจอเมื่อยืนยันตัวตนสำเร็จ
  if (status === 'verified') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-2xl p-10 rounded-[3rem] border border-green-500/20 shadow-[0_0_100px_rgba(34,197,94,0.1)] text-center relative overflow-hidden">
          
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <ShieldCheck size={120} className="text-green-500" />
          </div>

          <div className="relative z-10">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/20">
              <CheckCircle2 size={40} className="text-green-400" />
            </div>

            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              Access Granted
            </h1>
            <p className="text-slate-400 mb-10 text-sm font-medium uppercase tracking-[0.2em]">ยืนยันตัวตนสำเร็จ</p>

            {/* แสดงรูปภาพที่ถ่ายจากมือถือ */}
            <div className="relative inline-block mb-10 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative w-48 h-48 rounded-[2.2rem] overflow-hidden border-2 border-white/10 bg-slate-800">
                {capturedImage ? (
                  <img src={capturedImage} alt="Captured Face" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <User size={64} />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-3 -right-3 bg-green-500 text-slate-950 p-2 rounded-xl shadow-xl">
                <Fingerprint size={20} />
              </div>
            </div>

            <div className="space-y-2 mb-8">
              <div className="text-xs text-slate-500 font-mono">SESSION ID: {sessionId}</div>
              {verifiedAt && (
                <div className="text-xs text-slate-400">
                  สแกนเมื่อ: {new Date(verifiedAt).toLocaleString('th-TH')}
                </div>
              )}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-medium transition-all"
            >
              เริ่มต้นใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }

  // หน้าจอรอสแกน (มี QR Code)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="max-w-md w-full bg-slate-900/40 backdrop-blur-xl p-10 rounded-[3.5rem] border border-white/5 shadow-2xl text-center relative">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-600/20 blur-[80px] -z-10"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-indigo-600/20 blur-[80px] -z-10"></div>

        <div className="mb-10 inline-flex items-center gap-3 px-5 py-2 bg-blue-600/10 border border-blue-500/20 rounded-full">
          <Smartphone size={16} className="text-blue-400" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">Cross-Device Authentication</span>
        </div>

        <h1 className="text-3xl font-extrabold mb-3 tracking-tight">AI 3D Face ID</h1>
        <p className="text-slate-500 mb-12 text-sm max-w-[280px] mx-auto leading-relaxed">
          กรุณาใช้กล้องมือถือสแกนคิวอาร์โค้ดด้านล่าง เพื่อเริ่มต้นการสแกนใบหน้าแบบ 3 มิติ
        </p>
        
        <div className="relative group mb-12">
          <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
          <div className="relative bg-white p-6 rounded-[2.5rem] inline-block shadow-2xl ring-1 ring-white/10 overflow-hidden">
            {baseUrl && (
              <QRCodeSVG 
                value={`${baseUrl}/verify/${sessionId}`} 
                size={220}
                fgColor="#0f172a"
                level="H"
                includeMargin={false}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 to-transparent pointer-events-none"></div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 text-blue-400 text-xs font-mono tracking-wider">
          <Loader2 className="animate-spin" size={16} />
          <span className="uppercase">Waiting for Mobile connection...</span>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
              <ShieldCheck size={16}/>
            </div>
            <span className="text-[9px] uppercase tracking-tighter text-slate-500">Secure AES-256</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
              <Fingerprint size={16}/>
            </div>
            <span className="text-[9px] uppercase tracking-tighter text-slate-500">AI 3D Mapping</span>
          </div>
        </div>
      </div>
      
      <p className="mt-10 text-slate-600 text-[10px] uppercase tracking-[0.3em] font-medium">
        Powered by Google MediaPipe & Supabase
      </p>
    </div>
  );
}