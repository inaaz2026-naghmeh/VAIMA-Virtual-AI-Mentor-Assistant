import React, { useState } from 'react';
import { 
  Calendar, BarChart2, MessageSquare, Cpu, GraduationCap, 
  TrendingUp, Activity, Award, Filter, Inbox
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { QueryLog, QuizScore, User, Message, TutorialAttempt, Team } from '../types';
import SupervisorAiEngine from './SupervisorAiEngine';

interface SupervisorDashboardProps {
  queryLogs: QueryLog[];
  quizScores: QuizScore[];
  tutorialAttempts: TutorialAttempt[];
  messages: Message[];
  users: User[];
  teams?: Team[];
  currentUserRole?: string;
}

export default function SupervisorDashboard({ 
  queryLogs = [], 
  quizScores = [],
  tutorialAttempts = [],
  messages = [],
  users = [],
  teams = [],
  currentUserRole = 'SUPERVISOR'
}: SupervisorDashboardProps) {
  
  // Tab selector state for Operations Analytics vs AI Engineering Suite
  const [subTab, setSubTab] = useState<'analytics' | 'ai-engine'>('analytics');

  // Date filter states: default to May 20, 2026 to June 5, 2026 to fit the 100% seeded dates
  const [startDate, setStartDate] = useState<string>('2026-05-15');
  const [endDate, setEndDate] = useState<string>('2026-06-05');

  const startDateRef = React.useRef<HTMLInputElement>(null);
  const endDateRef = React.useRef<HTMLInputElement>(null);

  const safeShowPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    try {
      if (ref.current && typeof ref.current.showPicker === 'function') {
        ref.current.showPicker();
      }
    } catch (e) {
      console.warn("showPicker is not supported on this browser context", e);
    }
  };

  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');

  const allOperators = users.filter(u => u.role === 'OPERATOR');
  
  const isTeamFiltered = selectedTeamId !== 'ALL' && teams && teams.length > 0;
  const teamObj = isTeamFiltered ? teams.find(t => t.id === selectedTeamId) : null;
  const teamOperatorIds = teamObj ? teamObj.operatorIds : [];
  const teamSupervisorId = teamObj ? teamObj.supervisorId : null;

  // Filter list of operators down if a team is selected
  const operators = isTeamFiltered
    ? allOperators.filter(op => teamOperatorIds.includes(op.id))
    : allOperators;

  // Pre-filter datasets based on selected active dates and selected team configuration
  const startFilter = new Date(`${startDate}T00:00:00`);
  const endFilter = new Date(`${endDate}T23:59:59`);

  const filteredMessages = messages.filter(m => {
    const d = new Date(m.createdAt);
    const dateMatch = d >= startFilter && d <= endFilter;
    if (!dateMatch) return false;
    if (isTeamFiltered) {
      const isTeamSender = teamOperatorIds.includes(m.senderId) || m.senderId === teamSupervisorId;
      const isTeamTarget = m.targetOperatorId && teamOperatorIds.includes(m.targetOperatorId);
      return isTeamSender || isTeamTarget;
    }
    return true;
  });

  const filteredQueryLogs = queryLogs.filter(q => {
    const d = new Date(q.createdAt);
    const dateMatch = d >= startFilter && d <= endFilter;
    if (!dateMatch) return false;
    if (isTeamFiltered) {
      return teamOperatorIds.includes(q.userId);
    }
    return true;
  });

  const filteredQuizScores = quizScores.filter(s => {
    const d = new Date(s.submittedAt);
    const dateMatch = d >= startFilter && d <= endFilter;
    if (!dateMatch) return false;
    if (isTeamFiltered) {
      return teamOperatorIds.includes(s.submittedBy);
    }
    return true;
  });

  const filteredTutorialAttempts = tutorialAttempts.filter(t => {
    const d = new Date(t.createdAt);
    const dateMatch = d >= startFilter && d <= endFilter;
    if (!dateMatch) return false;
    if (isTeamFiltered) {
      return teamOperatorIds.includes(t.userId);
    }
    return true;
  });

  // Unique stable colors for operators on the lines
  const opColors: Record<string, string> = {
    'u-1': '#06b6d2', // Arash: Cyan
    'u-2': '#f59e0b', // Nima: Amber
    'u-3': '#ec4899', // Operator 3: Pink
    'default': '#8b5cf6' // Violet
  };

  const getOpColor = (id: string) => opColors[id] || opColors.default;

  // --- SECTION 1 CALCULATIONS ---

  // 1. Top 3 Chat Issues asked to supervisor
  const computeTopChatIssues = () => {
    const chatQueries = filteredMessages.filter(m => m.senderRole === 'OPERATOR' && !m.isAlert && !m.quiz && !m.quizScore);
    const counts: Record<string, number> = {};

    chatQueries.forEach(m => {
      const txt = m.content.toLowerCase();
      let matched = false;
      
      if (txt.includes('spindle') || txt.includes('overheat') || txt.includes('hot') || txt.includes('cnc')) {
        counts['Siemens Spindle Overheat & Cooling'] = (counts['Siemens Spindle Overheat & Cooling'] || 0) + 1;
        matched = true;
      }
      if (txt.includes('valve') || txt.includes('vent') || txt.includes('leak') || txt.includes('pressure') || txt.includes('pneumatic')) {
        counts['Pneumatic Pressure Vent Valve Leak'] = (counts['Pneumatic Pressure Vent Valve Leak'] || 0) + 1;
        matched = true;
      }
      if (txt.includes('quiz') || txt.includes('test') || txt.includes('fail') || txt.includes('question')) {
        counts['Core Safety Quiz Failures & Access'] = (counts['Core Safety Quiz Failures & Access'] || 0) + 1;
        matched = true;
      }
      if (txt.includes('checklist') || txt.includes('daily') || txt.includes('task') || txt.includes('done')) {
        counts['Daily Compliance Checklist Reporting'] = (counts['Daily Compliance Checklist Reporting'] || 0) + 1;
        matched = true;
      }
      if (txt.includes('manual') || txt.includes('instruction') || txt.includes('guide') || txt.includes('document')) {
        counts['Instruction Access & PDF Missing'] = (counts['Instruction Access & PDF Missing'] || 0) + 1;
        matched = true;
      }

      if (!matched && m.content.trim()) {
        const title = m.content.length > 35 ? m.content.slice(0, 35) + '...' : m.content;
        counts[title] = (counts[title] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  };

  const topChatIssues = computeTopChatIssues();

  // 2. Top 3 Topics operators asked the Avatar
  const computeTopAvatarTopics = () => {
    const counts: Record<string, number> = {};

    filteredQueryLogs.forEach(q => {
      const txt = q.query.toLowerCase();
      let matched = false;

      if (txt.includes('vent') || txt.includes('valve') || txt.includes('pressure') || txt.includes('manifold') || txt.includes('pipe')) {
        counts['Pneumatic / Vent Valve Pressures'] = (counts['Pneumatic / Vent Valve Pressures'] || 0) + 1;
        matched = true;
      }
      if (txt.includes('spindle') || txt.includes('overheat') || txt.includes('cnc') || txt.includes('motor') || txt.includes('axis')) {
        counts['Siemens CNC Overheat Codes'] = (counts['Siemens CNC Overheat Codes'] || 0) + 1;
        matched = true;
      }
      if (txt.includes('alarm') || txt.includes('smoke') || txt.includes('leaking') || txt.includes('fire') || txt.includes('emergency')) {
        counts['Emergency & Evacuation Boundary Drills'] = (counts['Emergency & Evacuation Boundary Drills'] || 0) + 1;
        matched = true;
      }
      if (txt.includes('calibration') || txt.includes('procedure') || txt.includes('manual') || txt.includes('g32')) {
        counts['Daily Machine Re-Calibrations'] = (counts['Daily Machine Re-Calibrations'] || 0) + 1;
        matched = true;
      }

      if (!matched && q.query.trim()) {
        // Fallback to query keyword mapping
        const words = q.query.toUpperCase().split(/\s+/).filter(w => w.length > 4);
        if (words.length > 0) {
          const kw = `Topic: "${words[0]}" query`;
          counts[kw] = (counts[kw] || 0) + 1;
        } else {
          counts['Interactive Chat Prompting'] = (counts['Interactive Chat Prompting'] || 0) + 1;
        }
      }
    });

    return Object.entries(counts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  };

  const topAvatarTopics = computeTopAvatarTopics();

  // 3. Average quizzes and average grades by each operator
  const operatorStats = operators.map(op => {
    const opScores = filteredQuizScores.filter(s => s.submittedBy === op.id);
    const opTutorials = filteredTutorialAttempts.filter(t => t.userId === op.id);

    const totalQuizzes = opScores.length + opTutorials.length;

    // Grades calculation
    let totalScorePoints = 0;
    let totalPossiblePoints = 0;

    opScores.forEach(s => {
      totalScorePoints += s.score;
      totalPossiblePoints += s.total;
    });

    opTutorials.forEach(t => {
      totalScorePoints += t.score;
      totalPossiblePoints += t.total;
    });

    const averageGrade = totalPossiblePoints > 0 
      ? Math.round((totalScorePoints / totalPossiblePoints) * 100) 
      : 0;

    return {
      id: op.id,
      name: op.name,
      avatar: op.avatar,
      username: op.username,
      totalQuizzes,
      averageGrade
    };
  });


  // --- SECTION 2 GRAPH DATA COMPILATION ---
  const generateChartData = () => {
    // Generate dates list from startDate to endDate
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const dayList: string[] = [];
    
    const curr = new Date(start);
    let protectionLimit = 0;
    while (curr <= end && protectionLimit < 35) {
      dayList.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
      protectionLimit++;
    }

    return dayList.map(dayStr => {
      // Display string
      const [year, month, day] = dayStr.split('-');
      const dispDate = `${month}/${day}`;

      const point: any = { dateStr: dispDate, fullDate: dayStr };

      operators.forEach(op => {
        // 1. Chat questions count
        const dayChats = filteredMessages.filter(m => {
          const mDate = m.createdAt.split('T')[0];
          return mDate === dayStr && m.senderId === op.id && !m.isAlert;
        });

        // 2. Avatar questions count
        const dayAvatar = filteredQueryLogs.filter(q => {
          const qDate = q.createdAt.split('T')[0];
          return qDate === dayStr && q.userId === op.id;
        });

        // 3. Quizzes count on day (Scores + Tutorials)
        const dayScores = filteredQuizScores.filter(s => s.submittedAt.split('T')[0] === dayStr && s.submittedBy === op.id);
        const dayTuts = filteredTutorialAttempts.filter(t => t.createdAt.split('T')[0] === dayStr && t.userId === op.id);
        const dayQuizzesCount = dayScores.length + dayTuts.length;

        // 4. Average Grade on day
        let sumScore = 0;
        let sumTotal = 0;
        dayScores.forEach(s => { sumScore += s.score; sumTotal += s.total; });
        dayTuts.forEach(t => { sumScore += t.score; sumTotal += t.total; });
        const avgGradeOnDay = sumTotal > 0 ? Math.round((sumScore / sumTotal) * 100) : null;

        point[`${op.name}_chats`] = dayChats.length;
        point[`${op.name}_avatar`] = dayAvatar.length;
        point[`${op.name}_quizzes`] = dayQuizzesCount;
        if (avgGradeOnDay !== null) {
          point[`${op.name}_grade`] = avgGradeOnDay;
        }
      });

      return point;
    });
  };

  const chartData = generateChartData();

  return (
    <div id="analytics-dashboard-root" className="space-y-6">
      
      {/* SECTION TABS FOR SUPERVISOR DASHBOARD */}
      <div className="flex bg-[#111]/80 p-1.5 rounded-xl border border-[#262626] max-w-md w-full sm:w-auto">
        <button
          onClick={() => setSubTab('analytics')}
          className={`flex-1 text-center py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all duration-150 cursor-pointer select-none ${
            subTab === 'analytics'
              ? 'bg-amber-500 text-black font-bold shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
          }`}
        >
          Operations Analytics
        </button>
        <button
          onClick={() => setSubTab('ai-engine')}
          className={`flex-1 text-center py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all duration-150 cursor-pointer select-none ${
            subTab === 'ai-engine'
              ? 'bg-amber-500 text-black font-bold shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
          }`}
        >
          AI Quality Port
        </button>
      </div>

      {subTab === 'ai-engine' ? (
        <SupervisorAiEngine currentUser={users.find(u => u.role === 'SUPERVISOR' || u.role === 'MANAGER')} />
      ) : (
        <>
          {/* FILTER PANEL */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-amber-500 animate-pulse" />
          <div>
            <h3 className="font-sans font-bold text-xs text-[#ededed] uppercase tracking-wider">
              Shift Date filter
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono">
              Apply exact timespans to filter summaries and dynamic lines
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentUserRole === 'MANAGER' && teams && teams.length > 0 && (
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#262626] px-3 py-1.5 rounded-lg">
              <span className="font-mono text-[9px] uppercase text-[#888]">Team:</span>
              <select
                id="analytics-team-filter"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none border-none cursor-pointer pr-1"
              >
                <option value="ALL">ALL TEAMS</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id} className="bg-[#111] text-white">{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div 
            onClick={() => safeShowPicker(startDateRef)}
            className="flex items-center gap-2 bg-[#0a0a0a] border border-[#262626] px-3 py-1.5 rounded-lg cursor-pointer hover:border-amber-500/40 duration-150 select-none"
          >
            <span className="font-mono text-[9px] uppercase text-[#888]">From:</span>
            <input 
              id="analytics-start-date"
              ref={startDateRef}
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-xs text-white focus:outline-none border-none cursor-pointer"
            />
          </div>

          <div 
            onClick={() => safeShowPicker(endDateRef)}
            className="flex items-center gap-2 bg-[#0a0a0a] border border-[#262626] px-3 py-1.5 rounded-lg cursor-pointer hover:border-amber-500/40 duration-150 select-none"
          >
            <span className="font-mono text-[9px] uppercase text-[#888]">To:</span>
            <input 
              id="analytics-end-date"
              ref={endDateRef}
              type="date"
              value={endDate}
              onChange={(e) => {
                const val = e.target.value;
                setEndDate(val);
                setStartDate(prev => prev > val ? val : prev);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-xs text-white focus:outline-none border-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            <button 
              onClick={() => { setStartDate('2026-05-20'); setEndDate('2026-05-27'); }} 
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-[#222] text-[#888] hover:text-amber-500 text-[10px] font-mono rounded transition-all cursor-pointer"
            >
              Past week
            </button>
            <button 
              onClick={() => { setStartDate('2026-05-01'); setEndDate('2026-06-01'); }} 
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-[#222] text-[#888] hover:text-amber-500 text-[10px] font-mono rounded transition-all cursor-pointer"
            >
              All May
            </button>
          </div>
        </div>
      </div>

      {/* --- SECTION 1: CRITICAL SUMMARIES GRID --- */}
      <div>
        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-[#222]">
          <BarChart2 className="w-4 h-4 text-amber-500" />
          <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-300">
            Section 1: Operator Ask Summaries & Compliance Ledger
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 1. TOP 3 CHAT ISSUES */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <h4 className="font-sans font-bold text-xs uppercase text-[#ededed] tracking-wide">
                  Top 3 Chat Issues asked in chat
                </h4>
              </div>

              {topChatIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
                  <Inbox className="w-8 h-8 text-[#333] mb-2" />
                  <span className="text-xs italic font-sans">No chat messages sent by operators in range.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {topChatIssues.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-lg border border-[#222]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-cyan-950/40 text-cyan-400 text-xs font-mono font-bold flex items-center justify-center border border-cyan-900/30 shrink-0">
                          {index + 1}
                        </span>
                        <p className="font-sans text-xs text-[#ededed] truncate font-medium">
                          {item.issue}
                        </p>
                      </div>
                      <span className="font-mono text-2xs font-bold text-cyan-400 shrink-0 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-900/30">
                        {item.count} queries
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[9.5px] text-zinc-500 font-mono mt-4">
              * Extracted dynamically from human operator message databases
            </p>
          </div>

          {/* 2. TOP 3 AVATAR TOPICS */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
                <Cpu className="w-4 h-4 text-amber-500" />
                <h4 className="font-sans font-bold text-xs uppercase text-[#ededed] tracking-wide">
                  Top 3 Topics Asked the AVATAR
                </h4>
              </div>

              {topAvatarTopics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
                  <Inbox className="w-8 h-8 text-[#333] mb-2" />
                  <span className="text-xs italic font-sans">No Live Avatar interaction logs found.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {topAvatarTopics.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-lg border border-[#222]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-amber-950/40 text-amber-500 text-xs font-mono font-bold flex items-center justify-center border border-amber-900/30 shrink-0">
                          {index + 1}
                        </span>
                        <p className="font-sans text-xs text-[#ededed] truncate font-medium">
                          {item.topic}
                        </p>
                      </div>
                      <span className="font-mono text-2xs font-bold text-amber-500 shrink-0 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/30">
                        {item.count} hits
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[9.5px] text-zinc-500 font-mono mt-4">
              * Sourced recursively from AI RAG Cognitive Search queries
            </p>
          </div>

          {/* 3. AVERAGE QUIZZES & GRADES */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4 border-b border-[#222] pb-2">
              <GraduationCap className="w-4 h-4 text-violet-400" />
              <h4 className="font-sans font-bold text-xs uppercase text-[#ededed] tracking-wide">
                Operator Quizzes & Grades averages
              </h4>
            </div>

            <div className="space-y-4">
              {operatorStats.map((item) => (
                <div key={item.id} className="bg-[#0a0a0a] p-3 rounded-lg border border-[#222] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={item.avatar} 
                      alt={item.name} 
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-md object-cover border border-[#222]" 
                    />
                    <div className="min-w-0">
                      <p className="font-sans text-xs text-[#ededed] font-bold truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">
                        @{item.username}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-zinc-500 font-mono block">Averages</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 bg-[#151515] border border-[#222] text-[10px] font-mono text-[#ededed] rounded">
                        {item.totalQuizzes} quizzes
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        item.averageGrade >= 80 
                          ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/40' 
                          : item.averageGrade >= 50
                            ? 'bg-amber-950/20 text-amber-500 border border-amber-900/40'
                            : 'bg-rose-950/20 text-rose-450 border border-rose-900/40'
                      }`}>
                        {item.averageGrade}% grade
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {operators.length === 0 && (
                <div className="text-center py-6 text-xs text-zinc-500 italic">No operators enrolled.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* --- SECTION 2: HIGH-FIDELITY TREND LINES --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#222]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-300">
              Section 2: High-Fidelity Trend Lines & Volumes over time
            </span>
          </div>
          <span className="text-[9px] text-[#888] font-mono uppercase bg-[#161616] border border-[#262626] px-2 py-0.5 rounded">
            Filtered Dates: {startDate} to {endDate}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CHART 1: QUESTIONS IN CHAT */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-sans font-bold text-[#ededed] block">
                1. Operator Inquiries in Supervisor Chat along time
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-cyan-950/10 border border-cyan-900/30 text-cyan-400 rounded font-mono uppercase">
                Lines counts / day
              </span>
            </div>
            <div className="w-full h-56 bg-[#0a0a0a] rounded-lg p-2 border border-[#222]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d1d1d" />
                  <XAxis dataKey="dateStr" stroke="#555" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#555" allowDecimals={false} tick={{ fontSize: 9 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f0f0f', borderColor: '#262626', fontSize: 11 }}
                    labelStyle={{ color: '#aaa', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {operators.map(op => (
                    <Line 
                      key={op.id}
                      type="monotone" 
                      dataKey={`${op.name}_chats`} 
                      name={op.name}
                      stroke={getOpColor(op.id)} 
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 2: QUESTIONS IN AVATAR */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-sans font-bold text-[#ededed] block">
                2. Operator Queries in AI Live Avatar section along time
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-amber-950/10 border border-amber-900/30 text-amber-500 rounded font-mono uppercase">
                RAG hits count
              </span>
            </div>
            <div className="w-full h-56 bg-[#0a0a0a] rounded-lg p-2 border border-[#222]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d1d1d" />
                  <XAxis dataKey="dateStr" stroke="#555" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#555" allowDecimals={false} tick={{ fontSize: 9 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f0f0f', borderColor: '#262626', fontSize: 11 }}
                    labelStyle={{ color: '#aaa', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {operators.map(op => (
                    <Line 
                      key={op.id}
                      type="monotone" 
                      dataKey={`${op.name}_avatar`} 
                      name={op.name}
                      stroke={getOpColor(op.id)} 
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 3: AVERAGE NUMBER OF QUIZZES */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-sans font-bold text-[#ededed] block">
                3. Total Completed Quizzes & Tutorials along time
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-purple-950/10 border border-purple-900/30 text-purple-400 rounded font-mono uppercase">
                Active submissions / operator
              </span>
            </div>
            <div className="w-full h-56 bg-[#0a0a0a] rounded-lg p-2 border border-[#222]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d1d1d" />
                  <XAxis dataKey="dateStr" stroke="#555" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#555" allowDecimals={false} tick={{ fontSize: 9 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f0f0f', borderColor: '#262626', fontSize: 11 }}
                    labelStyle={{ color: '#aaa', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {operators.map(op => (
                    <Line 
                      key={op.id}
                      type="monotone" 
                      dataKey={`${op.name}_quizzes`} 
                      name={op.name}
                      stroke={getOpColor(op.id)} 
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 4: AVERAGE QUIZ GRADE */}
          <div className="bg-[#111] border border-[#262626] rounded-xl p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-sans font-bold text-[#ededed] block">
                4. Average Quiz Grade percentage trend along time
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/10 border border-emerald-900/30 text-emerald-400 rounded font-mono uppercase">
                Core Grade % (0 - 100)
              </span>
            </div>
            <div className="w-full h-56 bg-[#0a0a0a] rounded-lg p-2 border border-[#222]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d1d1d" />
                  <XAxis dataKey="dateStr" stroke="#555" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#555" domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f0f0f', borderColor: '#262626', fontSize: 11 }}
                    labelStyle={{ color: '#aaa', fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {operators.map(op => (
                    <Line 
                      key={op.id}
                      type="monotone" 
                      connectNulls
                      dataKey={`${op.name}_grade`} 
                      name={op.name}
                      stroke={getOpColor(op.id)} 
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

        </>
      )}

    </div>
  );
}
