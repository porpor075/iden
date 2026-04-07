'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Smartphone, Loader2 } from 'lucide-react';

export default function DesktopPage() {
  const [sessionId] = useState(`sess_${Math.random().toString(36).substring(2, 9)}`);
  const [status, setStatus] = useState('waiting'); // waiting, verified
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
    
    // สร้าง Session ใน Supabase
    supabase.from('sessions').insert([{ id: sessionId, is_verified: false }]).then();

    // รอฟังผล Real-time
    const channel = supabase
      .channel('session_updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, 
        (payload) => {
          if (payload.new.is_verified) setStatus('verified');
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  if (status === 'verified') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 text-green-800">
        <ShieldCheck size={100} className="mb-4 animate-bounce" />
        <h1 className="text-4xl font-bold">ยืนยันตัวตนสำเร็จ!</h1>
        <p className="text-xl">ยินดีต้อนรับเข้าสู่ระบบ</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-3xl shadow-2xl text-center border border-slate-700">
        <h1 className="text-2xl font-bold mb-2">Cross-Device Face ID</h1>
        <p className="text-slate-400 mb-8 text-sm">สแกนเพื่อใช้กล้องมือถือ (Infrared/3D) ยืนยันตัวตน</p>
        
        <div className="bg-white p-4 rounded-2xl inline-block mb-8 shadow-inner">
          {baseUrl && <QRCodeSVG value={`${baseUrl}/verify/${sessionId}`} size={200} />}
        </div>

        <div className="flex items-center justify-center gap-2 text-blue-400 font-medium animate-pulse">
          <Loader2 className="animate-spin" size={20} />
          <span>กำลังรอการเชื่อมต่อจากมือถือ...</span>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-700 flex items-center justify-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1"><Smartphone size={14}/> Mobile Cam</div>
          <div className="flex items-center gap-1"><ShieldCheck size={14}/> Secure Link</div>
        </div>
      </div>
    </div>
  );
}