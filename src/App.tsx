import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Mail, 
  Video, 
  BarChart3, 
  Settings, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  User,
  Zap,
  Lock,
  Eye,
  Flag,
  Info,
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2
} from 'lucide-react';
import { cn } from './lib/utils';
import { generatePhishingEmail, analyzeSimulationResponse, generatePhoneSimulation, playAudio, generateDeepfakeAudio, quickSecurityChat } from './services/geminiService';
import Markdown from 'react-markdown';

// --- Types ---
type Role = 'employee' | 'admin';
type View = 'dashboard' | 'email-sim' | 'deepfake-sim' | 'phone-sim' | 'analytics' | 'reports' | 'admin-dashboard' | 'admin-campaigns' | 'admin-departments';

interface PhishingEmail {
  subject: string;
  senderName: string;
  senderEmail: string;
  body: string;
  redFlags: string[];
  explanation: string;
}

interface PhoneSim {
  scenario: string;
  attackerScript: string;
  redFlags: string[];
  explanation: string;
  audioBase64: string;
}

interface Report {
  id: number;
  is_correct: boolean;
  response_time: number;
  feedback: string;
  created_at: string;
  sim_type: string;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  dept_name: string;
  sim_type: string;
  launched_at: string;
  response_count: number;
}

interface Department {
  id: number;
  name: string;
  risk_score: number;
  employee_count: number;
  avg_score: number;
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active: boolean, onClick: () => void, badge?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200",
      active 
        ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/20" 
        : "text-zinc-400 hover:text-white hover:bg-white/5"
    )}
  >
    <div className="flex items-center gap-3">
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </div>
    {badge && (
      <span className="text-[10px] font-bold bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded uppercase">
        {badge}
      </span>
    )}
  </button>
);

const StatCard = ({ label, value, icon: Icon, trend }: { label: string, value: string | number, icon: any, trend?: string }) => (
  <div className="p-6 rounded-2xl bg-brand-surface border border-brand-border group hover:border-brand-primary/30 transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 rounded-lg bg-white/5 group-hover:bg-brand-primary/10 transition-colors">
        <Icon size={24} className="text-zinc-400 group-hover:text-brand-primary" />
      </div>
      {trend && (
        <span className="text-xs font-medium text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-full">
          {trend}
        </span>
      )}
    </div>
    <div className="text-2xl font-bold font-display mb-1">{value}</div>
    <div className="text-sm text-zinc-500">{label}</div>
  </div>
);

const LearningPath = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xl font-bold font-display">Your Learning Path</h3>
      <span className="text-sm text-brand-primary font-mono">65% Complete</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[
        { label: 'Foundations', status: 'completed', icon: CheckCircle2 },
        { label: 'Email Defense', status: 'active', icon: Mail },
        { label: 'Voice Verification', status: 'locked', icon: Lock },
        { label: 'Deepfake Advanced', status: 'locked', icon: Lock },
      ].map((step, i) => (
        <div 
          key={step.label}
          className={cn(
            "p-4 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all",
            step.status === 'completed' ? "bg-brand-primary/10 border-brand-primary/30 text-brand-primary" :
            step.status === 'active' ? "bg-white/5 border-brand-primary/50 shadow-[0_0_15px_rgba(0,255,65,0.2)]" :
            "bg-white/5 border-white/5 opacity-40"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            step.status === 'active' ? "bg-brand-primary text-black" : "bg-white/10"
          )}>
            <step.icon size={20} />
          </div>
          <div className="text-xs font-bold uppercase tracking-tighter">{step.label}</div>
        </div>
      ))}
    </div>
  </div>
);

export default function App() {
  const [role, setRole] = useState<Role>('employee');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [emailSim, setEmailSim] = useState<PhishingEmail | null>(null);
  const [phoneSim, setPhoneSim] = useState<PhoneSim | null>(null);
  const [deepfakeAudio, setDeepfakeAudio] = useState<string | null>(null);
  const [deepfakeSolution, setDeepfakeSolution] = useState<'authentic' | 'synthetic' | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<any>(null);
  const [stats, setStats] = useState<any>({ total_simulations: 0, correct_count: 0, avg_response_time: 0 });
  const [reports, setReports] = useState<Report[]>([]);
  
  // Admin States
  const [adminStats, setAdminStats] = useState<any>({ total_sims: 0, total_reports: 0, total_compromises: 0 });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (role === 'employee') {
      fetchStats();
      fetchReports();
    } else {
      fetchAdminData();
    }
  }, [role]);

  const fetchAdminData = async () => {
    try {
      const [ovRes, campRes, deptRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/campaigns'),
        fetch('/api/admin/departments')
      ]);
      setAdminStats(await ovRes.json());
      setCampaigns(await campRes.json());
      setDepartments(await deptRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(data);
    } catch (e) {
      console.error(e);
    }
  };

  const startDeepfakeChallenge = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const text = "This is a highly confidential message from the executive office. We need you to authorize the transfer immediately to avoid any legal complications.";
      const audio = await generateDeepfakeAudio(text);
      setDeepfakeAudio(audio || null);
      setDeepfakeSolution('synthetic'); // Currently always synthetic for the demo
      setCurrentView('deepfake-sim');
    } catch (e) {
      console.error(e);
      alert("Failed to generate deepfake challenge. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeepfakeGuess = async (guess: 'authentic' | 'synthetic') => {
    if (!deepfakeSolution) return;
    
    const isCorrect = guess === deepfakeSolution;
    const feedbackMsg = isCorrect 
      ? "Correct! You identified the synthetic patterns in the voice. Notice the slight lack of natural breathing and the consistent pitch." 
      : "Incorrect. This was an AI-generated clone. Modern deepfakes can be extremely convincing, but often lack the subtle emotional variance of human speech.";
    
    const result = {
      score: isCorrect ? 100 : 0,
      feedback: feedbackMsg,
      correctFlags: isCorrect ? ["AI Voice Pattern"] : [],
      missedFlags: isCorrect ? [] : ["Synthetic Pitch Consistency"]
    };
    
    setFeedback(result);
    
    // Save to DB
    await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        simulation_id: 3, // Deepfake Lab ID
        is_correct: isCorrect,
        response_time: 15000,
        feedback: feedbackMsg
      })
    });
    fetchStats();
    fetchReports();
  };

  const handlePlayDeepfake = () => {
    if (deepfakeAudio) {
      const audio = playAudio(deepfakeAudio);
      if (audio) {
        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
      }
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatMessage.trim() || isChatLoading) return;
    
    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);
    
    try {
      const aiResponse = await quickSecurityChat(userMsg);
      setChatHistory(prev => [...prev, { role: 'ai', text: aiResponse || 'No response' }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatLoading(false);
    }
  };

  const startEmailSimulation = async () => {
    setLoading(true);
    setFeedback(null);
    setSelectedFlags([]);
    try {
      const email = await generatePhishingEmail(Math.floor(Math.random() * 3) + 1);
      setEmailSim(email);
      setCurrentView('email-sim');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startPhoneSimulation = async () => {
    setLoading(true);
    setFeedback(null);
    setSelectedFlags([]);
    try {
      const sim = await generatePhoneSimulation(2);
      setPhoneSim(sim);
      setCurrentView('phone-sim');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = () => {
    if (phoneSim?.audioBase64) {
      const audio = playAudio(phoneSim.audioBase64);
      if (audio) {
        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
      }
    }
  };

  const submitAnalysis = async () => {
    const currentSim = currentView === 'email-sim' ? emailSim : phoneSim;
    if (!currentSim) return;
    
    setLoading(true);
    try {
      const result = await analyzeSimulationResponse(JSON.stringify(currentSim), selectedFlags);
      setFeedback(result);
      
      // Save to DB
      await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation_id: currentView === 'email-sim' ? 1 : 2,
          is_correct: result.score > 70,
          response_time: 45000, 
          feedback: result.feedback
        })
      });
      fetchStats();
      fetchReports();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-brand-bg selection:bg-brand-primary/30">
      {/* Sidebar */}
      <aside className="w-72 bg-brand-surface border-r border-brand-border flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center shadow-[0_0_20px_rgba(0,255,65,0.3)]">
            <Shield className="text-black" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tighter">PHISHERMAN</h1>
            <div className="text-[10px] font-bold text-brand-primary tracking-widest uppercase">Active Defense SOC</div>
          </div>
        </div>

        <div className="mb-8 p-1 bg-black/40 rounded-lg flex">
          <button 
            onClick={() => { setRole('employee'); setCurrentView('dashboard'); }}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all",
              role === 'employee' ? "bg-brand-primary text-black" : "text-zinc-500 hover:text-white"
            )}
          >
            Employee
          </button>
          <button 
            onClick={() => { setRole('admin'); setCurrentView('admin-dashboard'); }}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all",
              role === 'admin' ? "bg-brand-primary text-black" : "text-zinc-500 hover:text-white"
            )}
          >
            Admin/SOC
          </button>
        </div>
        <div className="px-2 mb-4">
          <p className="text-[10px] text-zinc-500 leading-tight">
            {role === 'employee' 
              ? "Training mode: Neutralize AI threats to build your security score." 
              : "Operations mode: Launch campaigns and monitor organizational risk."}
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          {role === 'employee' ? (
            <>
              <SidebarItem 
                icon={Shield} 
                label="Dashboard" 
                active={currentView === 'dashboard'} 
                onClick={() => setCurrentView('dashboard')} 
              />
              <SidebarItem 
                icon={Mail} 
                label="Email Sim" 
                active={currentView === 'email-sim'} 
                onClick={() => {
                  setCurrentView('email-sim');
                  if (!emailSim) startEmailSimulation();
                }} 
                badge="Live"
              />
              <SidebarItem 
                icon={Video} 
                label="Deepfake Lab" 
                active={currentView === 'deepfake-sim'} 
                onClick={() => {
                  setCurrentView('deepfake-sim');
                  if (!deepfakeAudio) startDeepfakeChallenge();
                }} 
                badge="New"
              />
              <SidebarItem 
                icon={Phone} 
                label="Phone Sim" 
                active={currentView === 'phone-sim'} 
                onClick={() => {
                  setCurrentView('phone-sim');
                  if (!phoneSim) startPhoneSimulation();
                }} 
                badge="Beta"
              />
              <SidebarItem 
                icon={BarChart3} 
                label="Analytics" 
                active={currentView === 'analytics'} 
                onClick={() => setCurrentView('analytics')} 
              />
              <SidebarItem 
                icon={Flag} 
                label="Reports" 
                active={currentView === 'reports'} 
                onClick={() => {
                  setCurrentView('reports');
                  fetchReports();
                }} 
              />
            </>
          ) : (
            <>
              <SidebarItem 
                icon={BarChart3} 
                label="SOC Overview" 
                active={currentView === 'admin-dashboard'} 
                onClick={() => setCurrentView('admin-dashboard')} 
              />
              <SidebarItem 
                icon={Zap} 
                label="Campaigns" 
                active={currentView === 'admin-campaigns'} 
                onClick={() => setCurrentView('admin-campaigns')} 
              />
              <SidebarItem 
                icon={User} 
                label="Departments" 
                active={currentView === 'admin-departments'} 
                onClick={() => setCurrentView('admin-departments')} 
              />
            </>
          )}
        </nav>

        <div className="mb-6 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-400 uppercase">Live Fire Mode</span>
            <div className="w-8 h-4 bg-red-500/20 rounded-full relative">
              <div className="absolute right-1 top-1 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_red]"></div>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500">Random AI attacks will be sent to your inbox.</p>
        </div>

        <div className="mt-auto p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center">
              <User size={16} className="text-brand-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Cyber Guard</div>
              <div className="text-xs text-zinc-500">Level 4 Analyst</div>
            </div>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-brand-primary w-2/3 shadow-[0_0_10px_rgba(0,255,65,0.5)]"></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative cyber-grid">
        <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-brand-bg/80 backdrop-blur-md border-bottom border-brand-border">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold capitalize">{currentView.replace('-', ' ')}</h2>
            <div className="h-4 w-px bg-brand-border"></div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
              System Online
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <AlertTriangle size={20} />
            </button>
            <div className="w-px h-6 bg-brand-border"></div>
            <button className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-black font-bold rounded-lg hover:bg-brand-primary/90 transition-all">
              <Zap size={16} />
              Quick Scan
            </button>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {currentView === 'admin-dashboard' && (
              <motion.div
                key="admin-dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold font-display">SOC Command Center</h2>
                    <p className="text-zinc-400">Real-time organizational vulnerability monitoring.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard 
                    label="Total Simulations" 
                    value={adminStats.total_sims || 0} 
                    icon={Shield} 
                  />
                  <StatCard 
                    label="Successful Reports" 
                    value={adminStats.total_reports || 0} 
                    icon={CheckCircle2} 
                  />
                  <StatCard 
                    label="Compromises" 
                    value={adminStats.total_compromises || 0} 
                    icon={AlertTriangle} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border">
                    <h3 className="text-xl font-bold font-display mb-6">Departmental Risk Heatmap</h3>
                    <div className="space-y-6">
                      {departments.map((dept) => (
                        <div key={dept.id}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-400">{dept.name}</span>
                            <span className={cn(
                              "font-bold",
                              dept.avg_score > 80 ? "text-brand-primary" : dept.avg_score > 60 ? "text-yellow-500" : "text-red-500"
                            )}>{Math.round(dept.avg_score)}% Security Score</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${dept.avg_score}%` }}
                              className={cn(
                                "h-full rounded-full",
                                dept.avg_score > 80 ? "bg-brand-primary" : dept.avg_score > 60 ? "bg-yellow-500" : "bg-red-500"
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border">
                    <h3 className="text-xl font-bold font-display mb-6">Recent Campaigns</h3>
                    <div className="space-y-4">
                      {campaigns.slice(0, 5).map((camp) => (
                        <div key={camp.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-sm">{camp.name}</div>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{camp.dept_name} • {camp.sim_type}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-brand-primary">{camp.response_count} Responses</div>
                            <div className="text-[10px] text-zinc-500">{new Date(camp.launched_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentView === 'admin-campaigns' && (
              <motion.div
                key="admin-campaigns"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold font-display">Campaign Manager</h2>
                    <p className="text-zinc-400">Launch and manage live-fire security simulations.</p>
                  </div>
                  <button 
                    onClick={() => {
                      // Logic to launch a new campaign
                      const name = `Campaign ${campaigns.length + 1}`;
                      const dept = departments[Math.floor(Math.random() * departments.length)];
                      const type = ['email', 'audio', 'deepfake'][Math.floor(Math.random() * 3)];
                      
                      fetch('/api/admin/campaigns', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, target_dept_id: dept.id, sim_type: type })
                      }).then(() => fetchAdminData());
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-black font-bold rounded-xl hover:bg-brand-primary/90 transition-all"
                  >
                    <Zap size={18} />
                    Launch New Campaign
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {campaigns.map((camp) => (
                    <div key={camp.id} className="p-6 rounded-3xl bg-brand-surface border border-brand-border flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                          {camp.sim_type === 'email' ? <Mail size={24} /> : camp.sim_type === 'audio' ? <Phone size={24} /> : <Video size={24} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{camp.name}</h4>
                          <div className="flex items-center gap-3 text-sm text-zinc-500">
                            <span className="flex items-center gap-1"><User size={14} /> {camp.dept_name}</span>
                            <span>•</span>
                            <span>{new Date(camp.launched_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-center">
                          <div className="text-2xl font-bold font-display">{camp.response_count}</div>
                          <div className="text-[10px] text-zinc-500 uppercase">Responses</div>
                        </div>
                        <div className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase">
                          {camp.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {currentView === 'admin-departments' && (
              <motion.div
                key="admin-departments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold font-display">Organizational Structure</h2>
                    <p className="text-zinc-400">Manage departments and monitor their security posture.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {departments.map((dept) => (
                    <div key={dept.id} className="p-6 rounded-3xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 transition-all group">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-brand-primary/10 transition-colors">
                          <User size={24} className="text-zinc-400 group-hover:text-brand-primary" />
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                          dept.avg_score > 80 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {dept.avg_score > 80 ? 'Low Risk' : 'High Risk'}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold mb-1">{dept.name}</h3>
                      <p className="text-xs text-zinc-500 mb-6">{dept.employee_count} Employees Enrolled</p>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          <span>Security Score</span>
                          <span>{Math.round(dept.avg_score)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              dept.avg_score > 80 ? "bg-brand-primary" : "bg-red-500"
                            )}
                            style={{ width: `${dept.avg_score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {currentView === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Hero Section */}
                <div className="p-8 rounded-3xl bg-gradient-to-br from-brand-primary/20 to-transparent border border-brand-primary/20 relative overflow-hidden">
                  <div className="relative z-10">
                    <h2 className="text-4xl font-bold font-display mb-2">Active Defense Training</h2>
                    <p className="text-zinc-400 max-w-xl mb-6">
                      Forget the videos. Phisherman uses real-time AI to simulate actual attacks. 
                      Your mission: Identify, analyze, and neutralize digital deception.
                    </p>
                    <div className="flex gap-4">
                      <button 
                        onClick={startEmailSimulation}
                        className="px-6 py-3 bg-brand-primary text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all"
                      >
                        Resume Training
                      </button>
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium">
                        <Shield size={16} className="text-brand-primary" />
                        Compliance Level: <span className="text-brand-primary ml-1">Gold Standard</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Shield size={240} />
                  </div>
                </div>

                <LearningPath />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <StatCard 
                        label="Total Simulations" 
                        value={stats.total_simulations || 0} 
                        icon={Shield} 
                        trend="+12%" 
                      />
                      <StatCard 
                        label="Detection Rate" 
                        value={`${Math.round((stats.correct_count / stats.total_simulations) * 100) || 0}%`} 
                        icon={CheckCircle2} 
                        trend="+5%" 
                      />
                      <StatCard 
                        label="Avg. Response Time" 
                        value={`${Math.round(stats.avg_response_time / 1000) || 0}s`} 
                        icon={Zap} 
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Mail size={120} />
                        </div>
                        <div className="relative z-10">
                          <h3 className="text-2xl font-bold font-display mb-4">Phishing Simulator</h3>
                          <p className="text-zinc-400 mb-8 max-w-md">
                            Test your ability to spot sophisticated phishing attempts generated by our AI agents. 
                            Real scenarios, real threats, safe environment.
                          </p>
                          <button 
                            onClick={startEmailSimulation}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-brand-primary hover:text-black transition-all disabled:opacity-50"
                          >
                            {loading ? 'Generating...' : 'Start Simulation'}
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Video size={120} />
                        </div>
                        <div className="relative z-10">
                          <h3 className="text-2xl font-bold font-display mb-4">Deepfake Lab</h3>
                          <p className="text-zinc-400 mb-8 max-w-md">
                            Analyze AI-generated audio and video to identify subtle inconsistencies. 
                            Learn to verify identity in the age of synthetic media.
                          </p>
                          <button 
                            onClick={startDeepfakeChallenge}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-3 border border-white/20 text-white font-bold rounded-xl hover:bg-white hover:text-black transition-all disabled:opacity-50"
                          >
                            {loading ? 'Preparing Lab...' : 'Enter Lab'}
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security AI Assistant Chat */}
                  <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border flex flex-col h-[600px]">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center">
                        <Zap size={18} className="text-brand-primary" />
                      </div>
                      <h3 className="font-bold font-display">Security AI Assistant</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                      {chatHistory.length === 0 && (
                        <div className="text-center py-10">
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                            <Info size={24} className="text-zinc-600" />
                          </div>
                          <p className="text-xs text-zinc-500">Ask me anything about cybersecurity threats or best practices.</p>
                        </div>
                      )}
                      {chatHistory.map((msg, i) => (
                        <div key={i} className={cn(
                          "p-3 rounded-2xl text-sm max-w-[85%]",
                          msg.role === 'user' 
                            ? "bg-brand-primary/10 border border-brand-primary/20 ml-auto text-brand-primary" 
                            : "bg-white/5 border border-white/10 mr-auto text-zinc-300"
                        )}>
                          {msg.text}
                        </div>
                      ))}
                      {isChatLoading && (
                        <div className="bg-white/5 border border-white/10 p-3 rounded-2xl mr-auto max-w-[85%] flex gap-1">
                          <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce"></span>
                          <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                          <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <input 
                        type="text" 
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                        placeholder="Ask a question..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary/50 transition-colors pr-12"
                      />
                      <button 
                        onClick={handleSendChatMessage}
                        disabled={isChatLoading || !chatMessage.trim()}
                        className="absolute right-2 top-2 p-1.5 bg-brand-primary text-black rounded-lg hover:bg-brand-primary/90 transition-all disabled:opacity-50"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    <div className="mt-3 text-[10px] text-zinc-600 text-center">
                      Powered by Gemini 2.5 Flash Lite for low-latency intelligence.
                    </div>
                  </div>
                </div>

                <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold font-display">Recent Activity</h3>
                    <button className="text-sm text-brand-primary hover:underline">View All</button>
                  </div>
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <CheckCircle2 size={20} />
                          </div>
                          <div>
                            <div className="font-medium">Successful Detection</div>
                            <div className="text-xs text-zinc-500">Urgent Payroll Update Email • 2 hours ago</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-brand-primary">+150 XP</div>
                          <div className="text-xs text-zinc-500">Sophistication: High</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {currentView === 'email-sim' && (
              <motion.div
                key="email-sim"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Email Viewer */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="rounded-3xl bg-brand-surface border border-brand-border overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-brand-border bg-white/5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                            <User size={20} />
                          </div>
                          <div>
                            <div className="font-bold">{emailSim?.senderName || 'Sender Name'}</div>
                            <div className="text-xs text-zinc-500">{emailSim?.senderEmail || 'sender@example.com'}</div>
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500">Today, 10:42 AM</div>
                      </div>
                      <h2 className="text-xl font-bold">{emailSim?.subject || 'Subject Line'}</h2>
                    </div>
                    <div className="p-8 min-h-[400px] prose prose-invert max-w-none">
                      {emailSim ? (
                        <Markdown>{emailSim.body}</Markdown>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4">
                          <Mail size={48} className="animate-bounce" />
                          <p>Generating sophisticated phishing attempt...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex gap-4">
                    <Info className="text-blue-400 shrink-0" size={24} />
                    <p className="text-sm text-blue-100/80">
                      <strong>Instructions:</strong> Review the email above carefully. Click on elements that seem suspicious or select common red flags from the panel on the right.
                    </p>
                  </div>
                </div>

                {/* Analysis Panel */}
                <div className="space-y-6">
                  <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border">
                    <h3 className="text-lg font-bold font-display mb-6 flex items-center gap-2">
                      <Flag size={20} className="text-brand-primary" />
                      Identify Red Flags
                    </h3>
                    
                    <div className="space-y-3 mb-8">
                      {[
                        'Suspicious Sender Address',
                        'Urgent or Threatening Language',
                        'Generic Greeting',
                        'Suspicious Links/Attachments',
                        'Poor Grammar/Spelling',
                        'Requests Sensitive Info'
                      ].map((flag) => (
                        <button
                          key={flag}
                          onClick={() => {
                            setSelectedFlags(prev => 
                              prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
                            );
                          }}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-xl border transition-all text-sm",
                            selectedFlags.includes(flag)
                              ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                              : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/30"
                          )}
                        >
                          {flag}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={submitAnalysis}
                      disabled={loading || !emailSim || selectedFlags.length === 0}
                      className="w-full py-4 bg-brand-primary text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all disabled:opacity-50"
                    >
                      {loading ? 'Analyzing...' : 'Submit Analysis'}
                    </button>
                  </div>

                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-6 rounded-3xl border",
                        feedback.score > 70 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                      )}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold">Results</h4>
                        <div className={cn(
                          "text-2xl font-bold font-display",
                          feedback.score > 70 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {feedback.score}%
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300 mb-4">{feedback.feedback}</p>
                      
                      <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Correctly Identified</div>
                        <div className="flex flex-wrap gap-2">
                          {feedback.correctFlags.map((f: string) => (
                            <span key={f} className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">{f}</span>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={startEmailSimulation}
                        className="w-full mt-6 py-2 text-sm font-bold text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all"
                      >
                        Try Another
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {currentView === 'deepfake-sim' && (
              <motion.div
                key="deepfake-sim"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold font-display">Deepfake Lab</h2>
                    <p className="text-zinc-400">Analyze synthetic media and verify identity.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="px-4 py-2 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-sm font-bold">
                      Mode: Advanced Detection
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border relative overflow-hidden">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                          <Lock size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Voice Verification Challenge</h3>
                          <p className="text-sm text-zinc-500">Listen to the audio clip and identify if it's a synthetic clone.</p>
                        </div>
                      </div>

                      <div className="bg-black/40 rounded-2xl p-8 border border-white/5 mb-8">
                        <div className="flex items-center justify-center h-32 mb-6">
                          <div className="flex items-end gap-1 h-12">
                            {[...Array(20)].map((_, i) => (
                              <motion.div
                                key={i}
                                animate={isPlaying ? { height: [10, Math.random() * 40 + 10, 10] } : { height: 10 }}
                                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                                className={cn(
                                  "w-1 rounded-full transition-colors",
                                  isPlaying ? "bg-brand-primary" : "bg-zinc-700"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-center gap-6">
                          <button 
                            onClick={handlePlayDeepfake}
                            disabled={!deepfakeAudio}
                            className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center text-black hover:scale-110 transition-transform shadow-[0_0_30px_rgba(0,255,65,0.4)] disabled:opacity-50"
                          >
                            <Zap size={32} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => handleDeepfakeGuess('authentic')}
                          disabled={feedback !== null}
                          className={cn(
                            "p-6 rounded-2xl border transition-all group",
                            feedback?.score === 100 && deepfakeSolution === 'authentic' ? "bg-emerald-500/20 border-emerald-500" :
                            feedback?.score === 0 && deepfakeSolution === 'authentic' ? "bg-red-500/20 border-red-500" :
                            "border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                          )}
                        >
                          <CheckCircle2 className={cn(
                            "mb-3",
                            feedback ? (deepfakeSolution === 'authentic' ? "text-emerald-500" : "text-red-500") : "text-zinc-500 group-hover:text-emerald-500"
                          )} />
                          <div className="font-bold">Authentic</div>
                          <div className="text-xs text-zinc-500">Verified human speech</div>
                        </button>
                        <button 
                          onClick={() => handleDeepfakeGuess('synthetic')}
                          disabled={feedback !== null}
                          className={cn(
                            "p-6 rounded-2xl border transition-all group",
                            feedback?.score === 100 && deepfakeSolution === 'synthetic' ? "bg-emerald-500/20 border-emerald-500" :
                            feedback?.score === 0 && deepfakeSolution === 'synthetic' ? "bg-red-500/20 border-red-500" :
                            "border-white/10 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30"
                          )}
                        >
                          <AlertTriangle className={cn(
                            "mb-3",
                            feedback ? (deepfakeSolution === 'synthetic' ? "text-emerald-500" : "text-red-500") : "text-zinc-500 group-hover:text-red-500"
                          )} />
                          <div className="font-bold">Synthetic</div>
                          <div className="text-xs text-zinc-500">AI-generated clone</div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl bg-brand-surface border border-brand-border">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <Info size={18} className="text-brand-primary" />
                        Detection Tips
                      </h4>
                      <ul className="space-y-4 text-sm text-zinc-400">
                        <li className="flex gap-3">
                          <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center shrink-0">1</div>
                          Listen for unnatural pauses or robotic inflections.
                        </li>
                        <li className="flex gap-3">
                          <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center shrink-0">2</div>
                          Check for background noise inconsistencies.
                        </li>
                        <li className="flex gap-3">
                          <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center shrink-0">3</div>
                          Verify the context—is the request unusual?
                        </li>
                      </ul>
                    </div>

                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-6 rounded-3xl border",
                          feedback.score > 70 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                        )}
                      >
                        <h4 className="font-bold mb-2">Analysis Result</h4>
                        <p className="text-sm text-zinc-300 mb-4">{feedback.feedback}</p>
                        <button 
                          onClick={startDeepfakeChallenge}
                          className="w-full py-2 text-sm font-bold text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all"
                        >
                          New Challenge
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            {currentView === 'phone-sim' && (
              <motion.div
                key="phone-sim"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl mx-auto"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Phone Interface */}
                  <div className="relative aspect-[9/19] max-w-[320px] mx-auto bg-zinc-900 rounded-[3rem] border-[8px] border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
                    <div className="h-6 w-32 bg-zinc-800 rounded-b-2xl mx-auto mb-8"></div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
                        <User size={48} className="text-zinc-600" />
                      </div>
                      <h3 className="text-2xl font-bold mb-1">Unknown Caller</h3>
                      <p className="text-zinc-500 text-sm mb-8">Potential Spam: +1 (555) 0192</p>
                      
                      {isCalling ? (
                        <div className="space-y-8 w-full">
                          <div className="text-brand-primary font-mono animate-pulse">00:0{callDuration}</div>
                          <div className="flex justify-center gap-8">
                            <div className="flex flex-col items-center gap-2">
                              <button className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                <MicOff size={20} />
                              </button>
                              <span className="text-[10px] text-zinc-500">Mute</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <button onClick={handlePlayAudio} className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary">
                                <Volume2 size={20} />
                              </button>
                              <span className="text-[10px] text-zinc-500">Speaker</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setIsCalling(false)}
                            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-red-500/20"
                          >
                            <PhoneOff size={24} className="rotate-[135deg]" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setIsCalling(true);
                            setCallDuration(0);
                            handlePlayAudio();
                          }}
                          className="w-16 h-16 rounded-full bg-brand-primary flex items-center justify-center text-black mx-auto shadow-lg shadow-brand-primary/20 animate-bounce"
                        >
                          <Phone size={24} />
                        </button>
                      )}
                    </div>

                    <div className="p-8 bg-zinc-800/50 backdrop-blur-md">
                      <div className="grid grid-cols-3 gap-4">
                        {[1,2,3,4,5,6,7,8,9,'*',0,'#'].map(n => (
                          <div key={n} className="aspect-square rounded-full bg-white/5 flex items-center justify-center text-lg font-medium">
                            {n}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Analysis Panel */}
                  <div className="space-y-6">
                    <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border">
                      <h3 className="text-xl font-bold font-display mb-4">Vishing Analysis</h3>
                      <p className="text-zinc-400 text-sm mb-8">
                        The AI has generated a social engineering script. Listen to the caller and identify the red flags.
                      </p>

                      {!phoneSim && (
                        <button 
                          onClick={startPhoneSimulation}
                          disabled={loading}
                          className="w-full py-4 bg-brand-primary text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all"
                        >
                          {loading ? 'Generating Scenario...' : 'Load New Scenario'}
                        </button>
                      )}

                      {phoneSim && (
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-xs font-bold text-brand-primary uppercase mb-1">Scenario</div>
                            <div className="text-sm">{phoneSim.scenario}</div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs font-bold text-zinc-500 uppercase">Select Identified Flags</div>
                            {['Urgency/Panic', 'Request for Password', 'Unusual Caller ID', 'Background Noise', 'Technical Jargon', 'Vague Identity'].map(flag => (
                              <button
                                key={flag}
                                onClick={() => {
                                  setSelectedFlags(prev => 
                                    prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
                                  );
                                }}
                                className={cn(
                                  "w-full text-left px-4 py-3 rounded-xl border transition-all text-sm",
                                  selectedFlags.includes(flag)
                                    ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                                    : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/30"
                                )}
                              >
                                {flag}
                              </button>
                            ))}
                          </div>

                          <button 
                            onClick={submitAnalysis} // Reuse analysis for now
                            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-brand-primary transition-all"
                          >
                            Submit Analysis
                          </button>
                        </div>
                      )}
                    </div>

                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 rounded-3xl bg-brand-primary/10 border border-brand-primary/20"
                      >
                        <h4 className="font-bold mb-2">AI Feedback</h4>
                        <p className="text-sm text-zinc-300">{feedback.feedback}</p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            {currentView === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold font-display">Security Analytics</h2>
                    <p className="text-zinc-400">Detailed performance metrics and threat intelligence.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border">
                    <h3 className="text-xl font-bold font-display mb-6">Detection Accuracy</h3>
                    <div className="h-64 flex items-end justify-between gap-4 px-4">
                      {[65, 40, 85, 50, 90, 75, 95].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            className="w-full bg-brand-primary/20 border-t-2 border-brand-primary rounded-t-lg"
                          />
                          <span className="text-[10px] text-zinc-500 font-mono">Day {i+1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border">
                    <h3 className="text-xl font-bold font-display mb-6">Threat Distribution</h3>
                    <div className="space-y-6">
                      {[
                        { label: 'Spear Phishing', value: 45, color: 'bg-brand-primary' },
                        { label: 'Voice Clones', value: 30, color: 'bg-blue-500' },
                        { label: 'Credential Harvesting', value: 15, color: 'bg-purple-500' },
                        { label: 'Social Engineering', value: 10, color: 'bg-zinc-500' }
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-400">{item.label}</span>
                            <span className="font-bold">{item.value}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.value}%` }}
                              className={cn("h-full rounded-full", item.color)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-8 rounded-3xl bg-brand-surface border border-brand-border">
                  <h3 className="text-xl font-bold font-display mb-6">Organization Benchmarking</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-brand-border">
                          <th className="pb-4">Department</th>
                          <th className="pb-4">Risk Score</th>
                          <th className="pb-4">Avg. Time</th>
                          <th className="pb-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {[
                          { dept: 'Engineering', score: 92, time: '12s', status: 'Low Risk' },
                          { dept: 'Marketing', score: 64, time: '45s', status: 'High Risk' },
                          { dept: 'Finance', score: 88, time: '18s', status: 'Medium Risk' },
                          { dept: 'HR', score: 72, time: '32s', status: 'Medium Risk' }
                        ].map((row) => (
                          <tr key={row.dept} className="border-b border-brand-border/50 hover:bg-white/5 transition-colors">
                            <td className="py-4 font-medium">{row.dept}</td>
                            <td className="py-4">
                              <span className={cn(
                                "font-bold",
                                row.score > 80 ? "text-brand-primary" : row.score > 70 ? "text-yellow-500" : "text-red-500"
                              )}>{row.score}%</span>
                            </td>
                            <td className="py-4 text-zinc-400 font-mono">{row.time}</td>
                            <td className="py-4">
                              <span className={cn(
                                "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                row.status === 'Low Risk' ? "bg-emerald-500/10 text-emerald-500" : 
                                row.status === 'Medium Risk' ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"
                              )}>{row.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
            {currentView === 'reports' && (
              <motion.div
                key="reports"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold font-display">Training Reports</h2>
                    <p className="text-zinc-400">Detailed history of your simulation performance.</p>
                  </div>
                  <button 
                    onClick={fetchReports}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-colors"
                  >
                    <Zap size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {reports.length === 0 ? (
                    <div className="p-12 text-center bg-brand-surface border border-brand-border rounded-3xl">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                        <Flag size={32} className="text-zinc-600" />
                      </div>
                      <p className="text-zinc-500">No simulation reports found. Complete your first training to see results here.</p>
                    </div>
                  ) : (
                    reports.map((report) => (
                      <div key={report.id} className="p-6 rounded-3xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 transition-all group">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center",
                              report.is_correct ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                            )}>
                              {report.is_correct ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold capitalize">{report.sim_type} Simulation</span>
                                <span className="text-[10px] text-zinc-500 font-mono">{new Date(report.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-zinc-400 line-clamp-1">{report.feedback}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "text-lg font-bold font-display",
                              report.is_correct ? "text-emerald-500" : "text-red-500"
                            )}>
                              {report.is_correct ? 'PASSED' : 'FAILED'}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">Time: {Math.round(report.response_time / 1000)}s</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
