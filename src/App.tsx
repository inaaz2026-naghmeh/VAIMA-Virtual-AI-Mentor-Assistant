import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, ShieldCheck, Truck, Cpu, RefreshCw, 
  BookOpen, Sparkles, MessageSquare, GraduationCap, BarChart2, ShieldAlert,
  Users
} from 'lucide-react';

// Type imports
import { User, Message, DocumentMetadata, Quiz, ShiftHandoff, QueryLog, TutorialAttempt, Team } from './types';

// Component imports
import UserProfileSelection from './components/UserProfileSelection';
import OperatorExpert from './components/OperatorExpert';
import OperatorChat from './components/OperatorChat';
import OperatorTutorials from './components/OperatorTutorials';
import SupervisorUpload from './components/SupervisorUpload';
import SupervisorTraining from './components/SupervisorTraining';
import SupervisorDashboard from './components/SupervisorDashboard';
import SupervisorChat from './components/SupervisorChat';
import UserProfile from './components/UserProfile';
import ManagerTeams from './components/ManagerTeams';

export default function App() {
  // Sync DB structures
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizScores, setQuizScores] = useState<any[]>([]);
  const [shiftHandoffs, setShiftHandoffs] = useState<ShiftHandoff[]>([]);
  const [queryLogs, setQueryLogs] = useState<QueryLog[]>([]);
  const [tutorialAttempts, setTutorialAttempts] = useState<TutorialAttempt[]>([]);

  // Local navigation tabs
  const [activeTab, setActiveTab] = useState<string>('expert');
  const [syncing, setSyncing] = useState(false);

  // Parse session from localStorage on initialization - Bypassed per request to always reload on login page
  useEffect(() => {
    localStorage.removeItem('active_user_session');
    setCurrentUser(null);
  }, []);

  // Safe wrapper to persist active session
  const handleSetCurrentUser = (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('active_user_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('active_user_session');
    }
  };

  // Sync state with local DB
  const syncDatabaseState = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/db');
      const data = await res.json();
      
      setUsers(data.users || []);
      setTeams(data.teams || []);
      setDocuments(data.documents || []);
      setMessages(data.messages || []);
      setQuizzes(data.quizzes || []);
      setQuizScores(data.quizScores || []);
      setShiftHandoffs(data.shiftHandoffs || []);
      setQueryLogs(data.queryLogs || []);
      setTutorialAttempts(data.tutorialAttempts || []);

      // If already logged in, sync currentUser object with refreshed data
      if (currentUser) {
        const refreshedUser = data.users?.find((u: any) => u.id === currentUser.id);
        if (refreshedUser) {
          setCurrentUser(refreshedUser);
        }
      }
    } catch (e) {
      console.error("Database sync failure", e);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    syncDatabaseState();
  }, []);

  // Sync state periodically (every 10s) to keep messages & online lists accurate
  useEffect(() => {
    if (!currentUser) return;
    const pollInterval = setInterval(() => {
      syncDatabaseState();
    }, 10000);
    return () => clearInterval(pollInterval);
  }, [currentUser?.id]);

  // Send periodic heartbeat pings (every 10s) to assert online status on server
  useEffect(() => {
    if (!currentUser) return;

    const sendHeartbeat = async () => {
      try {
        await fetch(`/api/users/${currentUser.id}/heartbeat`, { method: 'POST' });
      } catch (err) {
        console.error("Heartbeat sync failed", err);
      }
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 10000);
    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [currentUser?.id]);

  // Watch for role swaps and shift tab appropriately
  const prevUserRef = useRef<{ id: string; role: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      const prev = prevUserRef.current;
      if (!prev || prev.id !== currentUser.id || prev.role !== currentUser.role) {
        if (currentUser.role === 'SUPERVISOR' || currentUser.role === 'MANAGER') {
          setActiveTab(currentUser.role === 'MANAGER' ? 'teams' : 'dashboard');
        } else {
          setActiveTab('expert'); // operators default to AI Live Avatar
        }
        prevUserRef.current = { id: currentUser.id, role: currentUser.role };
      }
    } else {
      prevUserRef.current = null;
    }
  }, [currentUser?.id, currentUser?.role]);

  // Reset database state action helper
  const handleResetDatabase = async () => {
    if (!window.confirm("CONFIRM DATABASE HARD-RESET: Wipe all uploaded documents, active safety alerts, and chat logs?")) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/db/reset', { method: 'POST' });
      const data = await res.json();
      alert("Indexed database state reset successfully. Standard manuals re-loaded.");
      
      setUsers(data.data.users || []);
      setDocuments(data.data.documents || []);
      setMessages(data.data.messages || []);
      setQuizzes(data.data.quizzes || []);
      setQuizScores(data.data.quizScores || []);
      setShiftHandoffs(data.data.shiftHandoffs || []);
      setQueryLogs(data.data.queryLogs || []);
      setTutorialAttempts(data.data.tutorialAttempts || []);
      
      // Reset session state so they re-select/re-logon
      handleSetCurrentUser(null);
    } catch (e) {
      console.error(e);
      alert("Error resetting databases.");
    } finally {
      setSyncing(false);
    }
  };

  // Chat broadcast message dispatcher from client
  const handleSendMessage = async (text: string, targetOperatorId?: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderRole: currentUser.role,
          content: text,
          targetOperatorId
        })
      });
      const newMsg = await res.json();
      
      // Update local message list instantly for smooth latency
      setMessages(prev => [...prev, newMsg]);
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Safety Quiz selection
  const handleSubmitQuizScore = async (quizId: string, quizTitle: string, answers: number[], score: number, total: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/quizzes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          quizTitle,
          answers,
          submittedBy: currentUser.id,
          score,
          total
        })
      });
      
      // Refresh DB state (for compliance lists updates)
      syncDatabaseState();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter messages based on document access levels
  const hasCriticalAlarm = queryLogs.some(q => q.isEmergency);

  // Render correct tab page views
  const renderTabContent = () => {
    if (!currentUser) return null;

    if (activeTab === 'profile') {
      return (
        <UserProfile 
          currentUser={currentUser} 
          onUpdateSuccess={(updatedUser) => {
            handleSetCurrentUser(updatedUser);
            syncDatabaseState();
          }}
          onBackToApp={() => {
            if (currentUser.role === 'SUPERVISOR' || currentUser.role === 'MANAGER') {
              setActiveTab(currentUser.role === 'MANAGER' ? 'teams' : 'dashboard');
            } else {
              setActiveTab('expert');
            }
          }}
        />
      );
    }

    if (currentUser.role === 'OPERATOR') {
      switch (activeTab) {
        case 'expert':
          return (
            <OperatorExpert 
              currentUser={currentUser} 
              onNewMessageLogged={syncDatabaseState} 
              documents={documents}
              onDocumentUploaded={syncDatabaseState}
            />
          );
        case 'chat':
          return (
            <OperatorChat 
              currentUserId={currentUser.id}
              currentUserRole={currentUser.role}
              currentUserChecklist={currentUser.checklist}
              messages={messages}
              onSendMessage={handleSendMessage}
              onSubmitQuizAnswers={handleSubmitQuizScore}
            />
          );
        case 'tutorials':
          return (
            <OperatorTutorials 
              currentUserId={currentUser.id}
              assignedTutorialDocIds={currentUser.assignedTutorialDocIds}
              assignedDocumentIds={currentUser.assignedDocumentIds}
              documents={documents}
              tutorialAttempts={tutorialAttempts}
              onNewAttemptSubmitted={syncDatabaseState}
            />
          );
        default:
          return null;
      }
    } else { // SUPERVISOR or MANAGER ROLE Active
      switch (activeTab) {
        case 'teams':
          if (currentUser.role === 'MANAGER' || currentUser.role === 'SUPERVISOR') {
            return (
              <ManagerTeams 
                users={users} 
                teams={teams} 
                onTeamsUpdated={syncDatabaseState}
              />
            );
          }
          return null;
        case 'dashboard':
          return (
            <SupervisorDashboard 
              queryLogs={queryLogs} 
              quizScores={quizScores} 
              tutorialAttempts={tutorialAttempts}
              messages={messages}
              users={users}
              teams={teams}
              currentUserRole={currentUser.role}
            />
          );
        case 'upload':
          return (
            <SupervisorUpload 
              documents={documents} 
              users={users}
              onUploadSuccess={syncDatabaseState}
              teams={teams}
              currentUserRole={currentUser.role}
            />
          );
        case 'training':
          return (
            <SupervisorTraining 
              documents={documents} 
              users={users}
              onSyncSuccess={syncDatabaseState}
              teams={teams}
              currentUserRole={currentUser.role}
            />
          );
        case 'chat':
          return (
            <SupervisorChat 
              currentUserId={currentUser.id}
              messages={messages}
              users={users}
              onSendMessage={handleSendMessage}
              teams={teams}
              currentUserRole={currentUser.role}
            />
          );
        default:
          return null;
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col font-sans">
      
      {/* 1. TOP ANNOUNCEMENT & UTILITIES BANNER */}
      <header className="bg-[#111] border-b border-[#262626] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-50 shadow-2xl">
        <div className="flex items-center gap-3">
          <Terminal className="text-amber-500 w-8 h-8 animate-pulse shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-sans font-bold text-lg text-[#ededed] tracking-tight select-none">
                VAIMA - The Industrial Assistant
              </h1>
              <span className="bg-amber-950/20 border border-amber-900/40 text-amber-500 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Enterprise v2.4
              </span>
            </div>
            {currentUser?.role !== 'OPERATOR' && (
              <p className="text-[11px] text-[#888] uppercase tracking-widest font-mono mt-0.5">
                Industrial Knowledge Management System
              </p>
            )}
          </div>
        </div>

        {/* Sync Controls & Database resets */}
        {currentUser?.role !== 'OPERATOR' && (
          <div className="flex items-center gap-3.5">
            <button
              id="btn-sync-db-state"
              onClick={syncDatabaseState}
              className="flex items-center gap-1.5 font-mono text-slate-400 hover:text-white text-xs bg-[#0a0a0a] hover:bg-[#141414] px-3 py-1.5 rounded border border-[#262626] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-amber-500' : ''}`} />
              {syncing ? "Syncing..." : "Sync Systems"}
            </button>

            <button
              id="btn-wipe-db-state"
              onClick={handleResetDatabase}
              className="flex items-center gap-1.5 font-mono text-rose-450 hover:text-rose-400 text-xs bg-[#0a0a0a] hover:bg-rose-950/20 px-3 py-1.5 rounded border border-[#262626] hover:border-rose-900/40 transition-all cursor-pointer"
            >
              Reset Database
            </button>
          </div>
        )}
      </header>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* PROFILE PORTAL PANEL */}
        {!currentUser && (
          <UserProfileSelection 
            users={users} 
            currentUser={currentUser} 
            onSelectUser={handleSetCurrentUser} 
            onRefreshUsers={syncDatabaseState}
          />
        )}

        {currentUser && (
          <div className="flex flex-col gap-5">
            {/* WORKFLOW TABS SELECTORS */}
            <div className="flex items-center justify-between bg-[#111] p-2.5 rounded-xl border border-[#262626] shadow-xl overflow-x-auto">
              <div className="flex items-center gap-2 shrink-0">
                {currentUser.role === 'OPERATOR' ? (
                  <>
                    <button
                      id="tab-operator-expert"
                      onClick={() => setActiveTab('expert')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide transition-all duration-300 cursor-pointer ${
                        activeTab === 'expert'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      <Cpu className="w-4 h-4" />
                      Expert Assistant
                    </button>
                    <button
                      id="tab-operator-chat"
                      onClick={() => setActiveTab('chat')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide transition-all duration-300 cursor-pointer relative ${
                        activeTab === 'chat'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chats & Issues
                      {/* Interactive alert counters for operator pending quizzes */}
                      {quizzes.filter(q => q.status === 'PENDING').length > 0 && (
                        <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-ping shrink-0" />
                      )}
                    </button>
                    <button
                      id="tab-operator-tutorials"
                      onClick={() => setActiveTab('tutorials')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide transition-all duration-300 cursor-pointer ${
                        activeTab === 'tutorials'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      Tutorials
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      id="tab-super-dashboard"
                      onClick={() => setActiveTab('dashboard')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide transition-all duration-300 cursor-pointer ${
                        activeTab === 'dashboard'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      <BarChart2 className="w-4 h-4" />
                      Analytics
                    </button>
                    {(currentUser.role === 'MANAGER' || currentUser.role === 'SUPERVISOR') && (
                      <button
                        id="tab-mgr-teams"
                        onClick={() => setActiveTab('teams')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide transition-all duration-300 cursor-pointer ${
                          activeTab === 'teams'
                            ? 'bg-amber-500 text-black font-bold shadow'
                            : 'text-[#888] hover:text-white'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        Teams
                      </button>
                    )}
                    <button
                      id="tab-super-upload"
                      onClick={() => setActiveTab('upload')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide transition-all duration-300 cursor-pointer ${
                        activeTab === 'upload'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      Uploads
                    </button>
                    <button
                      id="tab-super-training"
                      onClick={() => setActiveTab('training')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide transition-all duration-300 cursor-pointer ${
                        activeTab === 'training'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      Quizzes
                    </button>
                    <button
                      id="tab-super-chat"
                      onClick={() => setActiveTab('chat')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide transition-all duration-300 cursor-pointer ${
                        activeTab === 'chat'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-[#888] hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chats
                    </button>
                  </>
                )}
              </div>

              {/* Status information badge */}
              <div className="flex items-center gap-3 shrink-0">
                {hasCriticalAlarm && (
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-red-400 bg-red-950/40 border border-red-900 px-2.5 py-1 rounded animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500 animate-bounce" />
                    SAFETY VENT CRITICAL
                  </span>
                )}
                <span className="text-[#888] font-mono text-[10px] uppercase hidden md:inline-flex items-center gap-1.5">
                  Session: <strong className="text-amber-500 font-semibold">{currentUser.name} ({currentUser.role})</strong>
                </span>
                <button
                  id="btn-profile-toggle"
                  onClick={() => setActiveTab('profile')}
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded transition-all cursor-pointer border ${
                    activeTab === 'profile'
                      ? 'text-black bg-amber-500 border-amber-400 shadow-md'
                      : 'text-amber-500 hover:text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 border-amber-950/30'
                  }`}
                >
                  Profile
                </button>
                <button
                  id="btn-logout"
                  onClick={() => handleSetCurrentUser(null)}
                  className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-rose-450 hover:text-rose-400 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-900/30 hover:border-rose-900/50 rounded transition-all cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </div>

            {/* TAB VIEW CONTENT CONTAINER */}
            <div className="relative animate-fade-in duration-300">
              {renderTabContent()}
            </div>
          </div>
        )}
      </main>

      {/* 3. CORE FOOTER */}
      <footer className="border-t border-[#262626] bg-[#111] p-4 text-center text-xs text-[#666] font-mono mt-auto flex items-center justify-center gap-2">
        <span>© 2026 VAIMA - The Industrial Assistant</span>
        <span>•</span>
        <span>Hands-free voice diagnostics pipeline active</span>
      </footer>
    </div>
  );
}
