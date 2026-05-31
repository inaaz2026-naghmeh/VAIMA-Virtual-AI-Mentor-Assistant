import React, { useState, useEffect } from 'react';
import { 
  Cpu, Layers, ShieldCheck, History, Play, CheckCircle2, 
  XCircle, RefreshCw, Clock, Database, ChevronRight, HelpCircle, 
  Terminal, ShieldAlert, AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell 
} from 'recharts';
import { AuditLog, EvalRun, User } from '../types';

interface SupervisorAiEngineProps {
  currentUser?: User;
}

export default function SupervisorAiEngine({ currentUser }: SupervisorAiEngineProps) {
  const [prompts, setPrompts] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [evalRuns, setEvalRuns] = useState<EvalRun[]>([]);
  const [isRunningSuite, setIsRunningSuite] = useState(false);
  const [activeTab, setActiveTab] = useState<'eval' | 'audits' | 'registry'>('eval');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchEngineData = async () => {
    try {
      const [pRes, aRes, eRes] = await Promise.all([
        fetch('/api/ai-engine/prompts'),
        fetch('/api/ai-engine/audit-logs'),
        fetch('/api/ai-engine/eval-runs')
      ]);

      const [pData, aData, eData] = await Promise.all([
        pRes.json(),
        aRes.json(),
        eRes.json()
      ]);

      setPrompts(pData);
      setAuditLogs(Array.isArray(aData) ? aData.reverse() : []);
      setEvalRuns(Array.isArray(eData) ? eData.reverse() : []);
    } catch (err) {
      console.error("Failed to load AI Engineering suite telemetry:", err);
    }
  };

  useEffect(() => {
    fetchEngineData();
    const interval = setInterval(fetchEngineData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRunEvaluation = async () => {
    setIsRunningSuite(true);
    try {
      const res = await fetch('/api/ai-engine/eval-suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: currentUser?.id || 'u-3' })
      });
      const data = await res.json();
      if (data.success) {
        setEvalRuns(prev => [data.run, ...prev]);
        setActiveTab('eval');
      } else {
        alert("Evaluation Suite failed: " + (data.error || "Unknown error"));
      }
    } catch (error: any) {
      alert("Network failed during Evaluation run: " + error.message);
    } finally {
      setIsRunningSuite(false);
      fetchEngineData();
    }
  };

  const getMetricColor = (metric: string) => {
    if (metric === 'GROUNDEDNESS') return '#3b82f6'; // Blue
    if (metric === 'SAFETY_ROUTER' || metric === 'PROMPT_INJECTION_DEFENSE') return '#10b981'; // Green
    if (metric === 'HALLUCINATION_PREVENTION') return '#f59e0b'; // Amber
    return '#8b5cf6'; // Violet
  };

  const latestRun = evalRuns[0] || null;

  // Render chart data from latest run
  const chartData = latestRun ? latestRun.results.map(r => ({
    name: r.metricName.replace('_', ' ').slice(0, 15),
    Score: r.score,
    Passed: r.passed ? 100 : 0,
    color: getMetricColor(r.metricName)
  })) : [];

  const filteredLogs = auditLogs.filter(log => {
    const textMatch = 
      log.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.serviceName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'ALL') return textMatch;
    return textMatch && log.status === statusFilter;
  });

  return (
    <div id="ai-engine-deck" className="space-y-6">
      
      {/* 1. HEADER HERO PANEL */}
      <div className="bg-[#111111] border border-[#262626] rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Terminal className="w-48 h-48 text-amber-500" />
        </div>
        
        <div className="z-10 space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-amber-500 animate-spin-slow" />
            <span className="bg-amber-950/20 border border-amber-900/40 text-amber-500 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              AI Framework Suite v2.0
            </span>
          </div>
          <h2 className="font-sans font-black text-2xl text-[#ededed] tracking-tight">
            AI Engineering & Quality Control Workspace
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl font-sans leading-relaxed">
            Verify real-time Retrieval-Augmented Generation (RAG) correctness, audit deep language model latency, inspect defensive prompt safety barriers, and trigger automated Quality Assurance evaluations.
          </p>
        </div>

        <button
          onClick={handleRunEvaluation}
          disabled={isRunningSuite}
          className="relative group flex items-center gap-2 font-mono text-xs uppercase tracking-wider pr-5 pl-4 py-3 rounded-lg text-black bg-amber-500 hover:bg-amber-400 font-bold transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none shadow-lg shrink-0"
        >
          {isRunningSuite ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Evaluating Model...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Perform Calibration Run</span>
            </>
          )}
        </button>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-[#111] border border-[#262626] rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="font-sans text-[10px] uppercase text-zinc-500 font-semibold">Active Models</span>
            <div className="font-mono font-bold text-base text-[#ededed]">Gemini 3.5 Flash</div>
            <p className="text-[10px] text-zinc-600 font-mono">Enforced Structured JSON API</p>
          </div>
          <Cpu className="w-8 h-8 text-blue-500 bg-blue-950/20 p-1.5 rounded-lg border border-blue-900/10" />
        </div>

        <div className="bg-[#111] border border-[#262626] rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="font-sans text-[10px] uppercase text-zinc-500 font-semibold">Prompt Versioning</span>
            <div className="font-mono font-bold text-base text-[#ededed]">3 Templates</div>
            <p className="text-[10px] text-emerald-500 font-mono">All production pinned</p>
          </div>
          <Layers className="w-8 h-8 text-emerald-500 bg-emerald-950/20 p-1.5 rounded-lg border border-emerald-900/10" />
        </div>

        <div className="bg-[#111] border border-[#262626] rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="font-sans text-[10px] uppercase text-zinc-500 font-semibold">Last Grounded Score</span>
            <div className="font-sans font-black text-2xl text-[#ededed]">
              {latestRun ? `${latestRun.avgGroundedness}%` : '85%'}
            </div>
            <p className="text-[10px] text-zinc-500 font-mono">RAG contextual hit index</p>
          </div>
          <ShieldCheck className="w-8 h-8 text-amber-500 bg-amber-950/20 p-1.5 rounded-lg border border-amber-900/10" />
        </div>

        <div className="bg-[#111] border border-[#262626] rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="font-sans text-[10px] uppercase text-zinc-500 font-semibold">Safety Defense</span>
            <div className="font-sans font-black text-2xl text-[#ededed]">
              {latestRun ? `${latestRun.avgSafety}%` : '100%'}
            </div>
            <p className="text-[10px] text-emerald-550 font-mono">Bypasses & Injection checks</p>
          </div>
          <ShieldAlert className="w-8 h-8 text-rose-500 bg-rose-950/20 p-1.5 rounded-lg border border-rose-900/10" />
        </div>

      </div>

      {/* 3. TABS NAVIGATION CONTROL */}
      <div className="flex border-b border-[#262626]">
        <button
          onClick={() => setActiveTab('eval')}
          className={`px-5 py-3 font-mono text-xs uppercase tracking-wider relative duration-150 cursor-pointer ${
            activeTab === 'eval' ? 'text-amber-500 border-b-2 border-amber-500 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Evaluation Suite Result
        </button>
        <button
          onClick={() => setActiveTab('audits')}
          className={`px-5 py-3 font-mono text-xs uppercase tracking-wider relative duration-150 cursor-pointer ${
            activeTab === 'audits' ? 'text-amber-500 border-b-2 border-amber-500 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Transaction Audit Logs ({filteredLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`px-5 py-3 font-mono text-xs uppercase tracking-wider relative duration-150 cursor-pointer ${
            activeTab === 'registry' ? 'text-amber-500 border-b-2 border-amber-500 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          Prompt Template Registry
        </button>
      </div>

      {/* TAB 1: EVALUATION REPORT CARD */}
      {activeTab === 'eval' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LATEST RUN SUMMARY PANEL AND VISUAL CHART */}
          <div className="lg:col-span-4 bg-[#111] border border-[#262626] rounded-xl p-5 space-y-6 shadow-xl">
            <div className="space-y-1">
              <h3 className="font-sans font-bold text-sm text-white">Suite Accuracy Calibration Chart</h3>
              <p className="text-[11px] text-zinc-500 font-mono">Distribution profile generated from latest verification run</p>
            </div>

            {latestRun ? (
              <div className="space-y-4">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="name" stroke="#666" tick={{ fill: '#888', fontSize: 9 }} />
                      <YAxis stroke="#666" domain={[0, 100]} tick={{ fill: '#888', fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: '#222', color: '#fff' }}
                        itemStyle={{ fontSize: 11 }}
                        labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
                      />
                      <Bar dataKey="Score" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="border-t border-[#222] pt-4 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Suite timestamp:</span>
                    <span className="text-zinc-300">{new Date(latestRun.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Evaluator mode:</span>
                    <span className="text-zinc-300 font-semibold text-amber-500">{latestRun.modelEvaluated}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Average correctness:</span>
                    <span className="text-zinc-300">{latestRun.avgCorrectness}%</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Tests status passed:</span>
                    <span className="text-emerald-500 font-bold">{latestRun.passedTestsCount} / {latestRun.totalTests} Passed</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-500/60 animate-pulse" />
                <div className="text-xs text-zinc-450 font-mono">No evaluation calibrators recorded yet.</div>
                <button
                  onClick={handleRunEvaluation}
                  className="text-[10px] font-mono px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded"
                >
                  Configure Suite First Run
                </button>
              </div>
            )}
          </div>

          {/* DETAILED RESULTS FOR THE FIVE CASES */}
          <div className="lg:col-span-8 bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4 shadow-xl">
            <div className="space-y-1">
              <h3 className="font-sans font-bold text-sm text-white">Groundedness and Vulnerability Test Diagnostics</h3>
              <p className="text-[11px] text-zinc-500 font-mono">Case-by-case evaluation logs mapped to the golden set</p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {latestRun ? latestRun.results.map((r, i) => (
                <div key={i} className="bg-[#0c0c0c] border border-[#222] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-[#222]" style={{ color: getMetricColor(r.metricName) }}>
                        {r.metricName}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">Metric Rating: {r.score}/100</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {r.passed ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          PASSED
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-red-400">
                          <XCircle className="w-3.5 h-3.5" />
                          FAILED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-[#ededed] font-sans">
                      <strong className="text-zinc-500 font-mono text-[10px] mr-1 block sm:inline-block">Query Prompt:</strong> 
                      "{r.testQuery}"
                    </div>
                    <div className="bg-[#111] p-2 rounded text-[11px] font-mono text-zinc-400 border border-[#222] break-words whitespace-pre-wrap">
                      <strong className="text-amber-500/80 mr-1">[AI Output]:</strong>
                      {r.actualOutput}
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono leading-relaxed mt-1">
                      <span className="text-zinc-650 mr-1 font-bold">Feedback details:</span> 
                      {r.feedback}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="py-12 text-center text-xs text-zinc-500 font-mono">
                  No execution traces. Click "Perform Calibration Run" to evaluate the LLM pipeline metrics instantly.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: AUDIT LOG TELEMETRY */}
      {activeTab === 'audits' && (
        <div className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4 shadow-xl">
          
          {/* SEARCH AND FILTERS BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#222] pb-4">
            <div className="space-y-1 self-start">
              <h3 className="font-sans font-bold text-sm text-white">Full-Stack LLM Audit Trail</h3>
              <p className="text-[11px] text-zinc-500 font-mono">Comprehensive security trail capturing latency, models, and validation classes</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search queries, role or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0c0c0c] text-xs text-white px-3 py-1.5 rounded border border-[#222] placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 w-full sm:w-48 font-mono"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#0c0c0c] text-xs text-white px-3 py-1.5 rounded border border-[#222] focus:outline-none focus:border-amber-500/50 font-mono cursor-pointer"
              >
                <option value="ALL">ALL TRANS</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FALLBACK">FALLBACK</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
          </div>

          {/* AUDIT TIMELINE TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#222] text-[10px] text-zinc-500 uppercase tracking-wider">
                  <th className="py-2 px-3 font-semibold">Time</th>
                  <th className="py-2 px-3 font-semibold">Operator</th>
                  <th className="py-2 px-3 font-semibold">Service</th>
                  <th className="py-2 px-3 font-semibold">Prompt ID</th>
                  <th className="py-2 px-3 font-semibold">Latency</th>
                  <th className="py-2 px-3 font-semibold">Tokens (I/O)</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                  <th className="py-2 px-3 font-semibold">Validation</th>
                  <th className="py-2 px-3 font-semibold text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c1c1c] text-xs text-zinc-300">
                {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#151515]/50 transition-colors">
                    <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 truncate max-w-[120px]">
                      <span className="font-sans font-medium text-white">{log.userName}</span>
                      <span className="block text-[9px] text-zinc-500 uppercase">{log.userRole}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-zinc-400">
                      {log.serviceName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-blue-400">
                      {log.promptVersion}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        {log.latencyMs}ms
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 text-[10px]">
                      {log.inputTokensEstimate || 150} / {log.outputTokensEstimate || 80}
                    </td>
                    <td className="py-2.5 px-3 text-[10px]">
                      {log.status === 'SUCCESS' && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-900/30">SUCCESS</span>
                      )}
                      {log.status === 'FALLBACK' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/20 text-amber-400 border border-amber-900/30">FALLBACK</span>
                      )}
                      {log.status === 'ERROR' && (
                        <span className="px-1.5 py-0.5 rounded bg-red-950/20 text-red-400 border border-red-900/30">ERROR</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[10px]">
                      {log.validationResult === 'PASSED' ? (
                        <span className="text-emerald-500">PASSED</span>
                      ) : log.validationResult === 'FAILED' ? (
                        <span className="text-red-400 font-bold">ATTACK_BLOCKED</span>
                      ) : (
                        <span className="text-zinc-500">BYPASSED</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-[10px] font-mono px-2 py-0.5 hover:bg-amber-500/10 border border-[#222] hover:border-amber-500/35 rounded text-amber-500 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-500">
                      No logs record match criteria. Ask questions or run quizzes to trigger API traces.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: PROMPT REGISTRY */}
      {activeTab === 'registry' && (
        <div className="bg-[#111] border border-[#262626] rounded-xl p-5 space-y-4 shadow-xl animate-fade-in">
          <div className="space-y-1">
            <h3 className="font-sans font-bold text-sm text-white">Version-Controlled System Prompt Templates</h3>
            <p className="text-[11px] text-zinc-500 font-mono">Immutable production templates deployed to security routers and tutoring pipelines</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prompts ? Object.entries(prompts).map(([key, pObj]: any) => (
              <div key={key} className="bg-[#0c0c0c] border border-[#222] rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-zinc-500 text-[10px] uppercase tracking-wider">{key}</span>
                    <span className="font-mono text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/10 border border-amber-900/30">
                      {pObj.version}
                    </span>
                  </div>
                  <h4 className="font-sans font-bold text-xs text-white uppercase">{pObj.description}</h4>
                  <p className="text-[11px] font-mono text-zinc-400 bg-black/40 p-2.5 rounded border border-[#222] max-h-32 overflow-y-auto leading-relaxed">
                    "{pObj.template}"
                  </p>
                </div>
                <div className="border-t border-[#222] pt-3 text-[10px] text-zinc-500 font-mono flex justify-between items-center">
                  <span>Routing: Gemini Flash</span>
                  <span className="text-emerald-500 italic">Production Active</span>
                </div>
              </div>
            )) : (
              <div className="col-span-3 py-12 text-center text-zinc-500 font-mono">
                Registry unretrieved. Deploy backend variables first.
              </div>
            )}
          </div>
        </div>
      )}

      {/* INSPECT LOG TRACE DETAIL MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] border border-[#262626] rounded-xl p-6 max-w-2xl w-full space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-[#222] pb-3">
              <div className="space-y-1">
                <h4 className="font-sans font-bold text-sm text-white uppercase tracking-tight">
                  Detailed Diagnostic Trace
                </h4>
                <p className="text-[10px] text-zinc-500 font-mono">Request GUID: {selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 cursor-pointer hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-[#0a0a0a] p-3 rounded-lg border border-[#222] space-y-1.5">
                <div className="text-zinc-500">USER PROFILE</div>
                <div className="text-white font-medium">{selectedLog.userName} ({selectedLog.userRole})</div>
                <div className="text-[9px] text-zinc-600 uppercase">Authenticated Session</div>
              </div>
              <div className="bg-[#0a0a0a] p-3 rounded-lg border border-[#222] space-y-1.5">
                <div className="text-zinc-500">PROFILER METRICS</div>
                <div className="text-white font-medium">Latency: {selectedLog.latencyMs}ms</div>
                <div className="text-[10px] text-zinc-400">Tokens: {selectedLog.inputTokensEstimate} IN / {selectedLog.outputTokensEstimate} OUT</div>
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="space-y-1.5">
                <span className="text-zinc-500 block">OPERATOR PROMPT INPUT</span>
                <p className="bg-[#0c0c0c] border border-[#222] p-3 rounded-lg text-white break-words">
                  "{selectedLog.query}"
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-zinc-500 block">MODEL RESPONSE PAYLOAD</span>
                <p className="bg-[#0c0c5c]/10 border border-[#222] p-3 rounded-lg text-amber-500 font-semibold break-words whitespace-pre-wrap">
                  {selectedLog.response || "No response received."}
                </p>
              </div>

              {selectedLog.errorDetails && (
                <div className="space-y-1.5">
                  <span className="text-rose-450 block">DEBUGGER ERROR FOOTPRINT</span>
                  <p className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-lg text-rose-400 break-words font-semibold">
                    {selectedLog.errorDetails}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-[#222] pt-4 flex gap-4 text-[10px] font-mono text-zinc-500 justify-between items-center">
              <span>Timestamp: {new Date(selectedLog.createdAt).toLocaleString()}</span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1 bg-[#222] hover:bg-[#333] text-white rounded transition-colors"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
