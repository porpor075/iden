'use client';
import { useParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Camera, CheckCircle2, AlertCircle, RefreshCcw, Loader2, ShieldCheck } from 'lucide-react';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export default function MobileVerifyPage() {
  const { sessionId } = useParams();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    setupModel();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const setupModel = async () => {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
      faceLandmarkerRef.current = faceLandmarker;
      setModelLoaded(true);
      startCamera();
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถโหลด AI Model ได้ กรุณาตรวจสอบการเชื่อมต่อ');
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 640 },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          processVideo();
        };
      }
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
    }
  };

  const processVideo = () => {
    if (!videoRef.current || !canvasRef.current || !faceLandmarkerRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const drawingUtils = new DrawingUtils(ctx);
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const render = () => {
      if (video.paused || video.ended) return;
      
      const startTimeMs = performance.now();
      const results = faceLandmarkerRef.current!.detectForVideo(video, startTimeMs);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        setFaceInFrame(true);
        // วาด Face Mesh (เส้นใย 3D)
        for (const landmarks of results.faceLandmarks) {
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
            color: "#30B0FF44", lineWidth: 1
          });
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#30B0FF" });
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30B0FF" });
          drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#30B0FF" });
        }
        
        // จำลองความคืบหน้าของการสแกน 3D
        setScanProgress(prev => Math.min(prev + 2, 100));
      } else {
        setFaceInFrame(false);
        setScanProgress(0);
      }

      requestRef.current = requestAnimationFrame(render);
    };
    render();
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current || !faceInFrame) return;
    setLoading(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      const { error: updErr } = await supabase
        .from('sessions')
        .update({ 
          is_verified: true,
          face_image: imageData,
          verified_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updErr) throw updErr;
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'การยืนยันตัวตนล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  // Auto capture เมื่อสแกนครบ 100%
  useEffect(() => {
    if (scanProgress === 100 && !loading && !done) {
      captureAndVerify();
    }
  }, [scanProgress]);

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6 text-center">
        <CheckCircle2 size={80} className="text-green-400 mb-6 animate-pulse" />
        <h1 className="text-3xl font-bold mb-2">ยืนยันตัวตนสำเร็จ</h1>
        <p className="text-slate-400">ระบบสแกนใบหน้าแบบ 3D บันทึกข้อมูลเรียบร้อย<br/>กรุณากลับไปที่หน้าจอคอมพิวเตอร์ของคุณ</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 overflow-hidden">
      <div className="w-full max-w-md relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/50">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-widest uppercase">Biometric 3D</h1>
              <p className="text-[10px] text-blue-400 font-mono">ENCRYPTED SESSION: {sessionId?.toString().substring(0, 8)}</p>
            </div>
          </div>
          {!modelLoaded && <Loader2 className="animate-spin text-blue-500" size={20} />}
        </div>

        {/* Scanner Window */}
        <div className="relative aspect-square w-full rounded-[3rem] overflow-hidden border-2 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
          />
          
          {/* Scanning Progress Ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-64 h-64 border-2 rounded-full transition-all duration-300 ${faceInFrame ? 'border-blue-500 scale-105 opacity-100' : 'border-white/10 scale-100 opacity-40'}`}>
              {faceInFrame && (
                <div 
                  className="absolute inset-0 border-t-4 border-blue-400 rounded-full animate-spin" 
                  style={{ animationDuration: '2s' }}
                />
              )}
            </div>
          </div>

          {/* Instructions Overlay */}
          {!faceInFrame && modelLoaded && (
            <div className="absolute inset-0 flex items-end justify-center pb-12 bg-black/20 backdrop-blur-[2px]">
              <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-xs font-medium animate-pulse">
                กรุณาวางใบหน้าให้ตรงกับกรอบ
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-8 px-4">
          <div className="flex justify-between text-[10px] font-mono mb-2 text-slate-500 tracking-widest uppercase">
            <span>3D Mesh Mapping</span>
            <span>{scanProgress}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs flex items-center gap-3 mx-4">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <button 
          onClick={startCamera}
          className="mt-12 w-full py-4 text-slate-500 hover:text-white transition-all text-xs flex items-center justify-center gap-2 font-mono uppercase tracking-widest"
        >
          <RefreshCcw size={14} /> Re-Initialize Camera
        </button>
      </div>
    </div>
  );
}