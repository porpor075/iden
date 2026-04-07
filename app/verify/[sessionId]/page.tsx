'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Fingerprint, CheckCircle2, AlertCircle } from 'lucide-react';

export default function MobileVerifyPage() {
  const { sessionId } = useParams();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleNativeVerify = async () => {
    setLoading(true);
    setError('');
    
    try {
      // เรียกใช้ WebAuthn API (Face ID / Touch ID / Biometric)
      // บนมือถือมันจะเด้งระบบสแกนของเครื่องขึ้นมาทันที (ใช้ IR/3D จริง)
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array([1, 2, 3, 4]),
          allowCredentials: [],
          userVerification: 'required',
        }
      });

      if (credential) {
        // อัปเดตสถานะใน Supabase
        const { error: updErr } = await supabase
          .from('sessions')
          .update({ is_verified: true })
          .eq('id', sessionId);

        if (updErr) throw updErr;
        setDone(true);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6 text-center">
        <CheckCircle2 size={80} className="text-green-400 mb-4" />
        <h1 className="text-2xl font-bold">สำเร็จ!</h1>
        <p className="text-slate-400">คุณสามารถปิดหน้านี้ และกลับไปที่หน้าจอคอมพิวเตอร์ได้เลย</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
      <div className="w-full max-w-sm bg-slate-800 p-8 rounded-3xl text-center border border-slate-700 shadow-xl">
        <Fingerprint size={60} className="mx-auto mb-6 text-blue-400" />
        <h1 className="text-xl font-bold mb-4">Biometric Verification</h1>
        <p className="text-slate-400 mb-8 text-sm">
          กดปุ่มด้านล่างเพื่อยืนยันตัวตนด้วยระบบสแกนใบหน้าของมือถือ
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          onClick={handleNativeVerify}
          disabled={loading}
          className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-600/20"
        >
          {loading ? 'กำลังประมวลผล...' : 'สแกนเพื่อยืนยันตัวตน'}
        </button>
      </div>
    </div>
  );
}