import React, { useState } from 'react';
import { 
  Cpu, UserCheck, Lock, User, 
  ShieldAlert, ArrowRight
} from 'lucide-react';
import { User as UserType } from '../types';

interface UserProfileSelectionProps {
  users: UserType[];
  currentUser: UserType | null;
  onSelectUser: (user: UserType) => void;
  onRefreshUsers?: () => void;
}

export default function UserProfileSelection({
  users,
  currentUser,
  onSelectUser,
  onRefreshUsers,
}: UserProfileSelectionProps) {
  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick autofill helper
  const handleAutofill = (user: UserType) => {
    setErrorMsg('');
    setUsername(user.username);
    // Determine preloaded password
    const defaultPass = user.role === 'SUPERVISOR' ? 'supervisor123' : (user.role === 'MANAGER' ? 'manager123' : 'operator123');
    setPassword(defaultPass);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please provide both username and password.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim().toLowerCase(), 
          password 
        })
      });
      const data = await res.json();
      
      if (res.ok && data.user) {
        setSuccessMsg(`Identity verified! Welcome, ${data.user.name}.`);
        setTimeout(() => {
          onSelectUser(data.user);
        }, 1000);
      } else {
        setErrorMsg(data.error || 'Authentication rejected: Invalid credentials.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Connection error: Failed to reach security server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#262626] rounded-xl p-6 shadow-2xl relative overflow-hidden max-w-xl mx-auto">
      <div className="absolute right-0 top-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl" />
      <div className="absolute left-10 bottom-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />

      {/* Title */}
      <div className="flex items-center gap-3 border-b border-[#262626] pb-5 mb-6">
        <Cpu className="text-amber-500 w-7 h-7 animate-pulse" />
        <div>
          <h2 className="text-xl font-mono font-bold text-[#ededed] tracking-tight">
            Terminal Access Portal
          </h2>
          <p className="text-xs text-[#888] font-mono mt-0.5 uppercase tracking-wider">
            Industrial Operating System Authentication Bay
          </p>
        </div>
      </div>

      {/* Response Messages */}
      {errorMsg && (
        <div className="mb-5 p-4 bg-red-950/40 border border-red-900/50 rounded-lg flex items-start gap-3">
          <ShieldAlert className="text-red-500 w-5 h-5 shrink-0 mt-0.5" animate-bounce="true" />
          <span className="text-xs text-red-400 font-mono">{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="mb-5 p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-lg flex items-start gap-3">
          <UserCheck className="text-emerald-500 w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-xs text-emerald-400 font-mono">{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col justify-between">
        <div>
          {/* Login form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[#999] mb-1.5 font-semibold">
                System Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 w-4 h-4 text-[#555]" />
                <input
                  id="input-login-username"
                  type="text"
                  placeholder="e.g., sarah_super"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg pl-10 pr-4 py-3 text-sm text-[#ededed] font-sans focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[#999] mb-1.5 font-semibold">
                Portal Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-[#555]" />
                <input
                  id="input-login-password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg pl-10 pr-4 py-3 text-sm text-[#ededed] font-sans focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-[#222] disabled:text-[#666] text-black font-mono font-bold uppercase text-xs py-3 rounded-lg transition-all duration-200 shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 mt-6 cursor-pointer"
            >
              {submitting ? 'Verifying Identity...' : 'login'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
