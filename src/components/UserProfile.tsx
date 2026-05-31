import React, { useState, useRef } from 'react';
import { 
  User as UserIcon, Mail, Shield, Camera, Save, 
  Lock, CheckCircle, Loader2, AlertCircle, RefreshCw,
  Phone, Upload
} from 'lucide-react';
import { User } from '../types';

interface UserProfileProps {
  currentUser: User;
  onUpdateSuccess: (updatedUser: User) => void;
  onBackToApp: () => void;
}

export default function UserProfile({ 
  currentUser, 
  onUpdateSuccess,
  onBackToApp
}: UserProfileProps) {
  const isSupervisor = currentUser.role === 'SUPERVISOR' || currentUser.role === 'MANAGER';

  // Local form states
  const [name, setName] = useState(currentUser.name);
  const [personalId, setPersonalId] = useState(currentUser.id); // Maps to User.id
  const [email, setEmail] = useState(currentUser.email || '');
  const [contactNumber, setContactNumber] = useState(currentUser.contactNumber || '');
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  const [role, setRole] = useState(currentUser.role);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Operation feedback states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // High-contrast industrial avatars presets
  const avatarPresets = [
    { name: 'Arash (Cyan)', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
    { name: 'Nima (Amber)', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80' },
    { name: 'Sarah (Supervisor)', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
    { name: 'Dr. Evelyn', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80' },
    { name: 'Devin', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80' },
    { name: 'Amalia', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate email
    if (email && !email.includes('@')) {
      setErrorMsg("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setErrorMsg("Profile name cannot be blank.");
      setLoading(false);
      return;
    }

    if (!personalId.trim()) {
      setErrorMsg("Personal ID / Database Identifier cannot be blank.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        name,
        email,
        contactNumber,
        avatar,
        role,
        personalId: isSupervisor ? personalId : undefined // Only Supervisor can change ID
      };

      const res = await fetch(`/api/users/${currentUser.id}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Internal Server Error occurred while updating profile.");
      }

      setSuccessMsg("Profile details saved successfully!");
      
      // Update session and parent context
      onUpdateSuccess(data.user);
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3500);

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="user-profile-editor-root" className="max-w-4xl mx-auto space-y-6">
      
      {/* HEADER CONTROLLER ACTION ROW */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans font-black text-xl text-white tracking-tight uppercase flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-amber-500" />
            Your Profile
          </h2>
        </div>

        <button
          onClick={onBackToApp}
          className="px-3.5 py-1.5 bg-[#151515] hover:bg-[#202020] border border-[#262626] text-white font-mono text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
        >
          ← Return to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: AVATAR PRESERVES AND SELECTORS */}
        <div className="md:col-span-4 bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl flex flex-col items-center text-center space-y-5">
          <span className="font-mono text-[10px] text-[#888] uppercase tracking-wider font-bold block self-start">
            Profile Image
          </span>

          <div className="relative group">
            <img 
              src={avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"} 
              alt={currentUser.name} 
              referrerPolicy="no-referrer"
              className="w-32 h-32 rounded-xl object-cover border-2 border-amber-500/30 group-hover:border-amber-500 duration-200"
            />
            <div className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
              <Camera className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-sans font-bold text-sm text-[#ededed] block">
              {currentUser.name}
            </span>
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <span className="px-2 py-0.5 bg-amber-950/20 border border-amber-900/40 text-amber-500 text-[9px] font-mono rounded uppercase font-black tracking-widest">
                {currentUser.role}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                ID: {currentUser.id}
              </span>
            </div>
          </div>

          {/* Quick presets selectors */}
          <div className="w-full border-t border-[#1e1e1e] pt-4 text-left space-y-4">
            <div>
              <span className="font-mono text-[9px] text-zinc-500 uppercase font-black tracking-widest block mb-2">
                Preset Avatars
              </span>
              <div className="grid grid-cols-3 gap-2">
                {avatarPresets.map((preset, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => setAvatar(preset.url)}
                    className={`relative rounded-md overflow-hidden h-10 border transition-all cursor-pointer ${
                      avatar === preset.url 
                        ? 'border-amber-500 shadow-md scale-105' 
                        : 'border-[#222] hover:border-zinc-500'
                    }`}
                    title={preset.name}
                  >
                    <img 
                      src={preset.url} 
                      alt={preset.name} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Local Image Uploader Action Button */}
            <div className="border-t border-[#1e1e1e] pt-3">
              <span className="font-mono text-[9px] text-zinc-500 uppercase font-black tracking-widest block mb-2">
                Custom Local Image
              </span>
              <input 
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#18181b] hover:bg-zinc-855 border border-[#262626] text-white text-xs font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer font-bold"
              >
                <Upload className="w-4 h-4 text-amber-500" />
                upload a photo
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CORE DETAILS EDITABLE FORM */}
        <form onSubmit={handleSaveProfile} className="md:col-span-8 bg-[#111] border border-[#262626] rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-5">
            <span className="font-mono text-[10px] text-[#888] uppercase tracking-wider font-bold block pb-2 border-b border-[#222]">
              User System Attributes
            </span>

            {/* Field Status Note */}
            {!isSupervisor && (
              <div className="flex items-start gap-2 bg-zinc-950/40 border border-zinc-900 p-3 rounded-lg text-zinc-500 text-[11px] font-sans">
                <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-mono">
                  NOTICE: Non-administrative personnel (Operators) are only permitted to configure their personal profile avatar. System parameters such as Name, Personal ID, and Email are read-only and locked down for compliance.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* NAME INPUT */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                  Name
                  {!isSupervisor && <Lock className="w-3 h-3 text-zinc-650" />}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-600">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    id="profile-field-name"
                    type="text"
                    disabled={!isSupervisor}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 bg-[#050505] border rounded-lg text-xs font-sans text-[#ededed] focus:outline-none transition-all ${
                      !isSupervisor 
                        ? 'border-zinc-900 bg-zinc-950/30 text-zinc-500 cursor-not-allowed' 
                        : 'border-[#262626] focus:border-amber-500'
                    }`}
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              {/* PERSONAL ID INPUT */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                  Personal ID (Unique Ref Key)
                  {!isSupervisor && <Lock className="w-3 h-3 text-zinc-650" />}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-650 font-mono text-2xs uppercase">
                    ID
                  </span>
                  <input
                    id="profile-field-id"
                    type="text"
                    disabled={!isSupervisor}
                    value={personalId}
                    onChange={(e) => setPersonalId(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 bg-[#050505] border rounded-lg text-xs font-mono text-[#ededed] focus:outline-none transition-all ${
                      !isSupervisor 
                        ? 'border-zinc-900 bg-zinc-950/30 text-zinc-500 cursor-not-allowed' 
                        : 'border-[#262626] focus:border-amber-500'
                    }`}
                    placeholder="e.g. u-1"
                  />
                </div>
              </div>

              {/* EMAIL INPUT */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                  Email Address
                  {!isSupervisor && <Lock className="w-3 h-3 text-zinc-650" />}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-650">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="profile-field-email"
                    type="email"
                    disabled={!isSupervisor}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 bg-[#050505] border rounded-lg text-xs font-sans text-[#ededed] focus:outline-none transition-all ${
                      !isSupervisor 
                        ? 'border-zinc-900 bg-zinc-950/30 text-zinc-500 cursor-not-allowed' 
                        : 'border-[#262626] focus:border-amber-500'
                    }`}
                    placeholder="e.g. operator@vaima.com"
                  />
                </div>
              </div>

              {/* CONTACT NUMBER INPUT */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold">
                  Contact Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-650">
                    <Phone className="w-4 h-4 text-amber-500/80" />
                  </span>
                  <input
                    id="profile-field-contact"
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#050505] border border-[#262626] focus:border-amber-500 rounded-lg text-xs font-mono text-[#ededed] focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    placeholder="e.g. +358 45 123 4567"
                    required
                  />
                </div>
              </div>

              {/* ROLE FIELD */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                  Role
                  {!isSupervisor && <Lock className="w-3 h-3 text-zinc-650" />}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-650">
                    <Shield className="w-4 h-4 text-amber-500/80" />
                  </span>
                  <select
                    id="profile-field-role"
                    disabled={!isSupervisor}
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className={`w-full pl-9 pr-3 py-2 bg-[#050505] border rounded-lg text-xs font-sans text-[#ededed] focus:outline-none transition-all ${
                      !isSupervisor 
                        ? 'border-zinc-900 bg-zinc-950/30 text-zinc-500 cursor-not-allowed' 
                        : 'border-[#262626] focus:border-amber-500'
                    }`}
                  >
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </div>
              </div>

              {/* IMAGE URL DIRECT FIELD */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold">
                  Custom Image / Avatar URL
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-600">
                    <Camera className="w-4 h-4" />
                  </span>
                  <input
                    id="profile-field-avatar-url"
                    type="url"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#050505] border border-[#262626] focus:border-amber-500 rounded-lg text-xs font-mono text-[#ededed] focus:outline-none"
                    placeholder="Enter absolute Unsplash or web avatar image URL"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* PROCESS AND SUBMIT BANNER ZONE */}
          <div className="mt-8 border-t border-[#1e1e1e] pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col">
              {errorMsg && (
                <span className="text-rose-400 text-2xs font-mono flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorMsg}
                </span>
              )}
              {successMsg && (
                <span className="text-emerald-400 text-2xs font-mono flex items-center gap-1 animate-pulse">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {successMsg}
                </span>
              )}
              {!errorMsg && !successMsg && (
                <span className="text-[10px] text-zinc-550 font-mono">
                  {/* Space for dynamic action statuses */}
                </span>
              )}
            </div>

            <button
              id="btn-save-profile-action"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-[#1f1f1d] text-black font-semibold text-xs font-sans rounded-lg shadow duration-150 cursor-pointer flex items-center gap-1.5 disabled:text-[#666]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
