'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { 
  ShieldCheck, Smartphone, Loader2, CheckCircle2, 
  User, Fingerprint, Search, UserPlus, Users, 
  History, ArrowLeft, RefreshCcw, Camera
} from 'lucide-react';

type AppUser = {
  user_id: string;
  full_name: string;
  baseline_image: string;
  created_at: string;
};

export default function DesktopPage() {
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState<'waiting' | 'verified'>('waiting');
  const [baselineImage, setBaselineImage] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
  };

  const startNewEnrollment = () => {
    const newId = prompt('กรุณาระบุ User ID ใหม่ (เช่น 001):');
    if (!newId) return;
    
    // เช็กว่าซ้ำไหม
    if (users.find(u => u.user_id === newId)) {
      alert('User ID นี้มีในระบบแล้ว!');
      return;
    }

    setupSession(newId, true);
  };

  const startVerification = (user: AppUser) => {
    setBaselineImage(user.baseline_image);
    setupSession(user.user_id, false);
  };

  const setupSession = async (id: string, isNew: boolean) => {
    const newSessId = `sess_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessId);
    setSelectedUserId(id);
    setIsNewUser(isNew);
    setStatus('waiting');
    setCapturedImage(null);
    setView('session');

    // สร้าง Session ใน Database
    await supabase.from('sessions').insert([{ id: newSessId, user_id: id, is_verified: false }]);

    // ฟังผล Real-time
    const channel = supabase
      .channel(`session-${newSessId}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${newSessId}` }, 
        async (payload) => {
          if (payload.new.is_verified) {
            const { data } = await supabase.from('sessions').select('*').eq('id', newSessId).single();
            if (data) {
              setCapturedImage(data.face_image);
              if (isNew) {
                await supabase.from('users').insert([{ user_id: id, baseline_image: data.face_image }]);
                fetchUsers();
              }
              setStatus('verified');
            }
          }
        }
      ).subscribe();
  };

  // --- UI Views ---

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
        <div className="max-w-6xl mx-auto">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
                <Users className="text-blue-500" size={40} />
                User Management
              </h1>
              <p className="text-slate-500 font-medium">จัดการและตรวจสอบใบหน้าผู้ใช้งานในระบบทั้งหมด</p>
            </div>
            <button 
              onClick={startNewEnrollment}
              className="flex items-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <UserPlus size={20} /> ลงทะเบียนผู้ใช้ใหม่
            </button>
          </div>

          {/* User Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {users.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-slate-900/50 rounded-[3rem] border border-dashed border-white/10">
                <User size={48} className="mx-auto mb-4 text-slate-700" />
                <p className="text-slate-500">ยังไม่มีผู้ใช้ในระบบ กรุณากดลงทะเบียนใหม่</p>
              </div>
            ) : (
              users.map((user) => (
                <div 
                  key={user.user_id}
                  className="group bg-slate-900/80 border border-white/5 p-6 rounded-[2.5rem] hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/5 cursor-pointer relative overflow-hidden"
                  onClick={() => startVerification(user)}
                >
                  <div className="aspect-square rounded-[1.5rem] overflow-hidden mb-6 bg-slate-800 border border-white/5 shadow-inner">
                    <img src={user.baseline_image} alt={user.user_id} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <h3 className="text-lg font-bold mb-1 truncate">ID: {user.user_id}</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                    Registered: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                  
                  <div className="mt-4 flex items-center gap-2 text-blue-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={14} /> สแกนเพื่อยืนยันตัวตน
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Session View (Waiting for Scan or Success)
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <button 
          onClick={() => setView('dashboard')}
          className="mb-8 flex items-center gap-2 text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} /> กลับไปหน้าจัดการ
        </button>

        {status === 'verified' ? (
          <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-green-500/20 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-400" />
              </div>
              <h2 className="text-3xl font-bold">{isNewUser ? 'Registration Success' : 'Verification Success'}</h2>
              <p className="text-slate-500">User ID: {selectedUserId}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ภาพถ่ายตั้งต้น</span>
                <div className="aspect-square rounded-3xl overflow-hidden border-2 border-white/5 bg-slate-800">
                  <img src={baselineImage || capturedImage || ''} className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">ภาพถ่ายล่าสุด</span>
                <div className="aspect-square rounded-3xl overflow-hidden border-2 border-blue-500/30 bg-slate-800 shadow-[0_0_40px_rgba(59,130,246,0.1)]">
                  <img src={capturedImage || ''} className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setView('dashboard')}
              className="w-full mt-10 py-5 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all"
            >
              เสร็จสิ้นและกลับหน้าหลัก
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/80 p-12 rounded-[3.5rem] border border-white/5 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[100px] -z-10"></div>
            
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full text-blue-400 text-[10px] font-bold tracking-widest uppercase mb-4">
                {isNewUser ? <UserPlus size={14}/> : <ShieldCheck size={14}/>}
                {isNewUser ? 'New Enrollment' : 'Identity Verification'}
              </div>
              <h2 className="text-4xl font-black mb-2 tracking-tight">ID: {selectedUserId}</h2>
              <p className="text-slate-500">ใช้มือถือของคุณสแกนเพื่อเริ่ม {isNewUser ? 'บันทึกใบหน้า' : 'ยืนยันตัวตน'}</p>
            </div>

            <div className="bg-white p-8 rounded-[3rem] inline-block mb-10 shadow-2xl ring-8 ring-blue-600/5">
              {baseUrl && <QRCodeSVG value={`${baseUrl}/verify/${sessionId}`} size={240} />}
            </div>

            <div className="flex items-center justify-center gap-3 text-blue-500 text-xs font-mono animate-pulse uppercase tracking-[0.2em]">
              <Loader2 className="animate-spin" size={16} />
              <span>Awaiting Secure Connection...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}