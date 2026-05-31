import React, { useState } from 'react';
import { 
  Users, Plus, Trash2, Edit, Check, X, Shield, User, Save, AlertCircle,
  ShieldCheck, Truck, UserCheck, Lock, Mail, UserPlus, ShieldAlert
} from 'lucide-react';
import { User as UserType, Team } from '../types';

interface ManagerTeamsProps {
  users: UserType[];
  teams: Team[];
  onTeamsUpdated: () => void;
}

export default function ManagerTeams({ users, teams = [], onTeamsUpdated }: ManagerTeamsProps) {
  const supervisors = users.filter(u => u.role === 'SUPERVISOR');
  const operators = users.filter(u => u.role === 'OPERATOR');

  // Creation/Editing states
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<string[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  
  // Naming team flow
  const [showNamingForm, setShowNamingForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // --- Create Account Section States ---
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'SUPERVISOR' | 'OPERATOR' | 'MANAGER'>('SUPERVISOR');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regUsername.trim() || !regPassword) {
      setRegError('Please fill in all requested fields to register.');
      return;
    }
    setRegError('');
    setRegSuccess('');
    setRegSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          username: regUsername.trim().toLowerCase(),
          password: regPassword,
          role: regRole
        })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        setRegSuccess(`Profile created successfully for ${data.user.name}!`);
        // Reset states
        setRegName('');
        setRegEmail('');
        setRegUsername('');
        setRegPassword('');
        setRegRole('SUPERVISOR');
        onTeamsUpdated(); // refresh dropdown lists immediately
      } else {
        setRegError(data.error || 'Failed to authorize account profile.');
      }
    } catch (err) {
      console.error(err);
      setRegError('Network state fault during registration attempt.');
    } finally {
      setRegSubmitting(false);
    }
  };

  const toggleOperatorSelection = (id: string) => {
    setSelectedOperatorIds(prev => 
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  };

  const handleStartCreateOrSave = () => {
    if (!selectedSupervisorId) {
      setErrorMsg('Please select a supervisor.');
      return;
    }
    if (selectedOperatorIds.length === 0) {
      setErrorMsg('Please select at least one operator.');
      return;
    }
    setErrorMsg('');
    if (editingTeamId) {
      // Find existing name
      const existing = teams.find(t => t.id === editingTeamId);
      setTeamName(existing ? existing.name : '');
    } else {
      setTeamName('');
    }
    setShowNamingForm(true);
  };

  const handleConfirmTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setErrorMsg('Please specify a team name.');
      return;
    }

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTeamId || undefined,
          name: teamName.trim(),
          supervisorId: selectedSupervisorId,
          operatorIds: selectedOperatorIds
        })
      });

      if (res.ok) {
        // Reset states
        setSelectedSupervisorId('');
        setSelectedOperatorIds([]);
        setEditingTeamId(null);
        setShowNamingForm(false);
        setTeamName('');
        setErrorMsg('');
        onTeamsUpdated();
      } else {
        setErrorMsg('Failed to persist team state.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Connection failure to management API.');
    }
  };

  const handleEditTeam = (team: Team) => {
    setErrorMsg('');
    setEditingTeamId(team.id);
    setSelectedSupervisorId(team.supervisorId);
    setSelectedOperatorIds(team.operatorIds);
    // Scroll smoothly to config panel
    const element = document.getElementById('team-constructor-panel');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to permanently delete this team arrangement?')) return;
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        onTeamsUpdated();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelNaming = () => {
    setShowNamingForm(false);
    setErrorMsg('');
  };

  const handleCancelEditor = () => {
    setEditingTeamId(null);
    setSelectedSupervisorId('');
    setSelectedOperatorIds([]);
    setErrorMsg('');
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div>
        <h2 className="font-sans font-black text-xl text-white tracking-tight uppercase flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-500" />
          Teams Configuration Panel
        </h2>
        <p className="text-xs text-zinc-500 font-mono mt-0.5">
          Establish team links to automatically isolate supervisor channels and operator document feeds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: TEAM BUILDER & CREATE ACCOUNT */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* TEAM BUILDER AND MEMBER SELECTOR */}
          <div id="team-constructor-panel" className="bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <span className="font-mono text-xs uppercase text-[#ededed] font-bold block">
                {editingTeamId ? "Edit Active Team Alignment" : "Construct a New Operational Team"}
              </span>
              {editingTeamId && (
                <button 
                  onClick={handleCancelEditor}
                  className="text-[10px] font-mono text-zinc-400 hover:text-white uppercase flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SUPERVISOR COLUMN (CHOOSE EXACTLY ONE) */}
              <div className="space-y-3">
                <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  Select supervisor
                </label>
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {supervisors.map(superUser => (
                    <button
                      key={superUser.id}
                      onClick={() => {
                        setSelectedSupervisorId(superUser.id);
                        setErrorMsg('');
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        selectedSupervisorId === superUser.id
                          ? 'bg-amber-950/15 border-amber-500 text-amber-500 shadow'
                          : 'bg-[#060606] border-[#222] text-[#888] hover:border-[#333]'
                      }`}
                    >
                      <img 
                        src={superUser.avatar} 
                        alt={superUser.name}
                        className="w-8 h-8 rounded object-cover border border-[#222]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-sans font-bold text-xs truncate text-[#ededed]">
                          {superUser.name}
                        </div>
                        <div className="font-mono text-[9px] text-[#666]">
                          @{superUser.username}
                        </div>
                      </div>
                    </button>
                  ))}
                  {supervisors.length === 0 && (
                    <div className="text-zinc-650 text-[11px] font-mono p-4 text-center">
                      No active Supervisors available.
                    </div>
                  )}
                </div>
              </div>

              {/* OPERATORS COLUMN (CHOOSE MULTIPLE) */}
              <div className="space-y-3">
                <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-500" />
                  Select operators
                </label>
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {operators.map(opUser => {
                    const isSelected = selectedOperatorIds.includes(opUser.id);
                    return (
                      <button
                        key={opUser.id}
                        onClick={() => {
                          toggleOperatorSelection(opUser.id);
                          setErrorMsg('');
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-950/15 border-amber-500 text-amber-500 shadow'
                            : 'bg-[#060606] border-[#222] text-[#888] hover:border-[#333]'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded border-[#333] text-amber-500 focus:ring-0 cursor-pointer pointer-events-none"
                        />
                        <img 
                          src={opUser.avatar} 
                          alt={opUser.name}
                          className="w-8 h-8 rounded object-cover border border-[#222]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-sans font-bold text-xs truncate text-[#ededed]">
                            {opUser.name}
                          </div>
                          <div className="font-mono text-[9px] text-[#666]">
                            @{opUser.username}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {operators.length === 0 && (
                    <div className="text-zinc-650 text-[11px] font-mono p-4 text-center">
                      No active Operators available.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {errorMsg && !showNamingForm && (
              <div className="bg-red-950/20 border border-red-900/40 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* NAMING FORM PANEL ROW */}
            {showNamingForm ? (
              <form onSubmit={handleConfirmTeam} className="border-t border-[#262626] pt-4 space-y-4">
                <div className="bg-zinc-950/40 border border-[#262626] p-4 rounded-lg space-y-3">
                  <label className="block font-mono text-[10px] text-zinc-400 uppercase font-bold">
                    Specify Team Name
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="e.g. Morning Shift Alpha, Line 3 Repair, etc."
                      className="flex-1 px-3 py-2 bg-[#050505] border border-[#262626] focus:border-amber-500 focus:outline-none rounded-lg text-xs font-sans text-white text-semibold"
                    />
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCancelNaming}
                        className="px-3 py-1.5 bg-[#18181b] hover:bg-zinc-900 border border-[#262626] text-white text-xs font-mono uppercase rounded-lg transition-all cursor-pointer font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono uppercase rounded-lg transition-all cursor-pointer font-bold flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        {editingTeamId ? "Save Team" : "Create Team"}
                      </button>
                    </div>
                  </div>
                </div>
                {errorMsg && (
                  <div className="bg-red-950/20 border border-red-900/40 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </form>
            ) : (
              <div className="border-t border-[#262626] pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleStartCreateOrSave}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer font-bold flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  {editingTeamId ? "Save Team Selection" : "create the team"}
                </button>
              </div>
            )}
          </div>

          {/* CREATE ACCOUNT SECTION */}
          <div id="account-creator-panel" className="bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl space-y-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
            
            <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
              <UserPlus className="text-amber-500 w-4 h-4" />
              <span className="font-mono text-xs uppercase text-[#ededed] font-bold block animate-pulse">
                Create Account Profile
              </span>
            </div>

            {regError && (
              <div className="p-3 bg-red-950/20 border border-red-900/40 text-red-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs rounded-lg flex items-center gap-2 font-mono">
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#999] mb-1.5 font-bold">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-3.5 h-3.5 text-[#555]" />
                    <input
                      id="input-reg-name"
                      type="text"
                      placeholder="e.g., Jane Doe"
                      value={regName}
                      onChange={(e) => { setRegName(e.target.value); setRegSuccess(''); setRegError(''); }}
                      className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg pl-9 pr-4 py-2 text-xs text-[#ededed] focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#999] mb-1.5 font-bold">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-3.5 h-3.5 text-[#555]" />
                    <input
                      id="input-reg-email"
                      type="email"
                      placeholder="e.g., jane@co.io"
                      value={regEmail}
                      onChange={(e) => { setRegEmail(e.target.value); setRegSuccess(''); setRegError(''); }}
                      className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg pl-9 pr-4 py-2 text-xs text-[#ededed] focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#999] mb-1.5 font-bold">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-3.5 h-3.5 text-[#555]" />
                    <input
                      id="input-reg-username"
                      type="text"
                      placeholder="e.g., jane_super"
                      value={regUsername}
                      onChange={(e) => { setRegUsername(e.target.value); setRegSuccess(''); setRegError(''); }}
                      className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg pl-9 pr-4 py-2 text-xs text-[#ededed] focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#999] mb-1.5 font-bold">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-3.5 h-3.5 text-[#555]" />
                    <input
                      id="input-reg-password"
                      type="password"
                      placeholder="••••••••••••"
                      value={regPassword}
                      onChange={(e) => { setRegPassword(e.target.value); setRegSuccess(''); setRegError(''); }}
                      className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg pl-9 pr-4 py-2 text-xs text-[#ededed] focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Role selection */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#999] mb-2 font-bold font-semibold">
                  Assigned Operations Group
                </label>
                <div className="grid grid-cols-3 gap-4 font-mono text-xs">
                  <button
                    id="btn-reg-role-supervisor"
                    type="button"
                    onClick={() => { setRegRole('SUPERVISOR'); setRegSuccess(''); setRegError(''); }}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      regRole === 'SUPERVISOR'
                        ? 'bg-[#1e140c] border-amber-500/80 text-amber-500'
                        : 'bg-[#050505] border-[#222] text-[#777] hover:border-[#333]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5 font-bold font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>SUPERVISOR</span>
                    </div>
                    <p className="text-[9px] text-[#666] leading-relaxed">
                      Manuals indexing & quizzes.
                    </p>
                  </button>

                  <button
                    id="btn-reg-role-operator"
                    type="button"
                    onClick={() => { setRegRole('OPERATOR'); setRegSuccess(''); setRegError(''); }}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      regRole === 'OPERATOR'
                        ? 'bg-amber-950/20 border-amber-500/80 text-amber-500'
                        : 'bg-[#050505] border-[#222] text-[#777] hover:border-[#333]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5 font-bold font-semibold">
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      <span>OPERATOR</span>
                    </div>
                    <p className="text-[9px] text-[#666] leading-relaxed">
                      AI assistance & safety guides.
                    </p>
                  </button>

                  <button
                    id="btn-reg-role-manager"
                    type="button"
                    onClick={() => { setRegRole('MANAGER'); setRegSuccess(''); setRegError(''); }}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      regRole === 'MANAGER'
                        ? 'bg-[#121c17] border-emerald-500/80 text-emerald-500'
                        : 'bg-[#050505] border-[#222] text-[#777] hover:border-[#333]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5 font-bold font-semibold">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>MANAGER</span>
                    </div>
                    <p className="text-[9px] text-[#666] leading-relaxed">
                      Teams admin & full override.
                    </p>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="btn-register-submit"
                  type="submit"
                  disabled={regSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-[#222] disabled:text-[#666] text-black font-mono font-bold uppercase text-xs rounded-lg transition-all duration-205 shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer font-bold"
                >
                  <UserPlus className="w-4 h-4 animate-pulse" />
                  {regSubmitting ? 'Registering...' : 'create account'}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* ALIGNED TEAMS REGISTRY LISTING */}
        <div className="lg:col-span-4 space-y-3">
          <span className="font-mono text-[10px] uppercase text-zinc-400 font-bold block">
            Existing Team Alignments ({teams.length})
          </span>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {teams.map(t => {
              const teamSuper = supervisors.find(s => s.id === t.supervisorId);
              const teamOps = operators.filter(o => t.operatorIds.includes(o.id));

              return (
                <div key={t.id} className="bg-[#111] border border-[#262626] p-4 rounded-xl shadow-lg space-y-4">
                  {/* Team Card Header */}
                  <div className="flex items-start justify-between border-b border-[#262626]/60 pb-2">
                    <div>
                      <h4 className="font-sans font-bold text-sm text-white tracking-tight">{t.name}</h4>
                      <span className="font-mono text-[8.5px] text-zinc-500">Created: {new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleEditTeam(t)}
                        title="Edit Team Members"
                        className="p-1 px-1.5 bg-[#18181b] border border-[#262626] hover:border-amber-500 text-zinc-400 hover:text-amber-500 rounded transition-all cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(t.id)}
                        title="Delete Team Link"
                        className="p-1 px-1.5 bg-[#18181b] border border-[#262626] hover:border-rose-950 hover:bg-rose-950/10 text-zinc-450 hover:text-rose-400 rounded transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Supervisor segment */}
                  <div className="space-y-1.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-amber-500 block">Supervisor</span>
                    {teamSuper ? (
                      <div className="flex items-center gap-2 bg-black/40 border border-[#222]/40 rounded-lg p-1.5">
                        <img 
                          src={teamSuper.avatar} 
                          alt={teamSuper.name} 
                          className="w-6.5 h-6.5 rounded object-cover border border-[#2a2a2a]"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-sans font-bold text-xs text-[#ededed] block truncate">{teamSuper.name}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-rose-450 font-mono italic">Supervisor missing or deleted</span>
                    )}
                  </div>

                  {/* Operators segment */}
                  <div className="space-y-1.5">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-amber-500 block">Operators ({teamOps.length})</span>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                      {teamOps.map(op => (
                        <div key={op.id} className="flex items-center gap-2 bg-black/20 border border-zinc-950 rounded-lg p-1.5">
                          <img 
                            src={op.avatar} 
                            alt={op.name} 
                            className="w-5.5 h-5.5 rounded object-cover border border-[#22a]/10"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-sans text-xs text-zinc-300 block truncate">{op.name}</span>
                          </div>
                        </div>
                      ))}
                      {teamOps.length === 0 && (
                        <span className="text-[10px] text-zinc-550 font-mono italic">No operators inside team</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {teams.length === 0 && (
              <div className="border border-dashed border-[#262626] rounded-xl p-8 text-center text-zinc-600 space-y-2">
                <Users className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-xs font-mono">No operational teams configured</p>
                <p className="text-[10px] text-zinc-550">Use the builder panel on the left to create your first team linking a supervisor to active operators.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
