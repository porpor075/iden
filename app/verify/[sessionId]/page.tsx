'use client';
import { useParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Camera, CheckCircle2, AlertCircle, RefreshCcw, Loader2 } from 'lucide-react';

export default function MobileVerifyPage() {
  const { sessionId } = useParams();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // เริ่มเปิดกล้องเมื่อเข้าหน้า
  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }, // กล้องหน้า
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
    }
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true);
    setError('');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // วาดภาพจาก Video ลง Canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8); // ได้รูปเป็น Base64

        // ส่งข้อมูลไปอัปเดตใน Supabase
        // เก็บทั้งสถานะผ่าน และรูปภาพของผู้ใช้
        const { error: updErr } = await supabase
          .from('sessions')
          .update({ 
            is_verified: true,
            face_image: imageData, // เก็บรูปภาพ Base64
            verified_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        if (updErr) throw updErr;
        
        // ปิดกล้อง
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setDone(true);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'การยืนยันตัวตนล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 size={48} className="text-green-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">สำเร็จ!</h1>
        <p className="text-slate-400">ระบบบันทึกภาพและยืนยันตัวตนเรียบร้อยแล้ว<br/>คุณสามารถกลับไปที่หน้าจอคอมพิวเตอร์ได้เลย</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden">
        
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="p-2 bg-blue-600/20 rounded-xl">
            <Camera size={20} className="text-blue-400" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Identity Verification</h1>
        </div>

        {/* Video Preview */}
        <div className="relative aspect-square mb-8 rounded-[2rem] overflow-hidden bg-black border border-white/5 ring-1 ring-white/10 group">
          {!stream && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              <Loader2 className="animate-spin" size={32} />
            </div>
          )}
          
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]" // กลับด้านให้เหมือนกระจก
          />
          
          {/* Overlay Guide */}
          <div className="absolute inset-0 pointer-events-none border-[3rem] border-slate-950/40">
            <div className="w-full h-full border-2 border-white/20 rounded-[1.5rem] relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <div className="px-2">
          <button
            onClick={captureAndVerify}
            disabled={loading || !stream}
            className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 mb-4"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                กำลังตรวจสอบ...
              </>
            ) : (
              'ถ่ายภาพยืนยันตัวตน'
            )}
          </button>
          
          <button 
            onClick={startCamera}
            className="w-full py-3 text-slate-400 hover:text-white transition-colors text-sm flex items-center justify-center gap-2"
          >
            <RefreshCcw size={14} /> สลับกล้อง หรือ ลองเปิดกล้องใหม่
          </button>
        </div>
      </div>
      
      {/* Hidden Canvas สำหรับถ่ายรูป */}
      <canvas ref={canvasRef} className="hidden" />
      
      <p className="mt-8 text-slate-500 text-xs text-center px-8">
        ภาพของคุณจะถูกส่งไปยังระบบอย่างปลอดภัย เพื่อใช้ในการยืนยันสิทธิ์การเข้าใช้งาน
      </p>
    </div>
  );
}