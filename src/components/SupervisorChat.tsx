import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageCircle, Clock, Check, Bell } from 'lucide-react';
import { Message, User as OperatorUser, Team } from '../types';

interface SupervisorChatProps {
  currentUserId: string;
  messages: Message[];
  users: OperatorUser[];
  onSendMessage: (text: string, targetOperatorId?: string) => void;
  teams?: Team[];
  currentUserRole?: string;
}

export default function SupervisorChat({
  currentUserId,
  messages = [],
  users = [],
  onSendMessage,
  teams = [],
  currentUserRole = 'SUPERVISOR'
}: SupervisorChatProps) {
  
  // Contacts list: Managers see all other users; supervisors see their team operators
  const operators = currentUserRole === 'MANAGER'
    ? users.filter(u => u.id !== currentUserId)
    : (() => {
        const myTeams = teams.filter(t => t.supervisorId === currentUserId);
        if (myTeams.length > 0) {
          const opIds = myTeams.flatMap(t => t.operatorIds);
          return users.filter(u => u.role === 'OPERATOR' && opIds.includes(u.id));
        }
        return users.filter(u => u.role === 'OPERATOR');
      })();
  
  // Selected operator conversation
  const [activeOpId, setActiveOpId] = useState<string | null>(null);
  const [typedMessage, setTypedMessage] = useState('');

  // Track read state timestamps
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, string>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize selected operator to the first one available
  useEffect(() => {
    if (operators.length > 0 && !activeOpId) {
      setActiveOpId(operators[0].id);
    }
  }, [operators, activeOpId]);

  // Set active op messages timestamp to "now" whenever new messages arrive or active op switches
  useEffect(() => {
    if (activeOpId) {
      setLastReadTimestamps(prev => ({
        ...prev,
        [activeOpId]: new Date().toISOString()
      }));
    }
  }, [messages, activeOpId]);

  // Scroll to bottom of active conversation room
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeOpId]);

  const activeOp = operators.find(op => op.id === activeOpId);

  // Filter messages for active channel
  const activeRoomMessages = activeOpId
    ? messages.filter(m => {
        // Message is part of active contact room if:
        // Case A: Sent by active communication partner to logged in user (or target is logged in user)
        // Case B: Sent by logged-in user to the active communication partner
        const isBetweenUs = (m.senderId === activeOpId && m.targetOperatorId === currentUserId) ||
                            (m.senderId === currentUserId && m.targetOperatorId === activeOpId);
        
        // Legacy/Fallback Case: supervisor is chatting with operator, but target operator id was saved under targetOperatorId, and sender was supervisor
        const isLegacyRoom = (
          (m.senderId === activeOpId && m.senderRole === 'OPERATOR' && !m.targetOperatorId) ||
          (m.senderRole === 'SUPERVISOR' && m.targetOperatorId === activeOpId && m.senderId === currentUserId)
        );

        return isBetweenUs || isLegacyRoom;
      })
    : [];

  const handleSend = () => {
    if (!typedMessage.trim() || !activeOpId) return;
    onSendMessage(typedMessage, activeOpId);
    setTypedMessage('');
  };

  // Helper to compute unread counts
  const getUnreadCount = (opId: string) => {
    if (activeOpId === opId) return 0; // currently open

    const lastRead = lastReadTimestamps[opId];
    const opMessages = messages.filter(m => m.senderId === opId);

    if (!lastRead) {
      // If we haven't read any yet, consider newer messages (e.g. within past day) as unread
      return opMessages.length;
    }

    return opMessages.filter(m => new Date(m.createdAt) > new Date(lastRead)).length;
  };

  // Helper to get last message preview
  const getLastMessagePreview = (opId: string) => {
    const opMessages = messages.filter(m => m.senderId === opId || m.targetOperatorId === opId);
    if (opMessages.length === 0) return 'No conversation logs';
    const last = opMessages[opMessages.length - 1];
    return last.content;
  };

  const getLastMessageTime = (opId: string) => {
    const opMessages = messages.filter(m => m.senderId === opId || m.targetOperatorId === opId);
    if (opMessages.length === 0) return '';
    const last = opMessages[opMessages.length - 1];
    return new Date(last.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div id="comms-hub-root" className="grid grid-cols-1 md:grid-cols-12 bg-[#090909] border border-[#262626] rounded-xl overflow-hidden h-[540px] shadow-2xl relative">
      
      {/* LEFT COLUMN: CONVERSATIONS/OPERATOR SIDEBAR list (width: 4/12) */}
      <div className="md:col-span-4 border-r border-[#262626] bg-[#111] flex flex-col justify-between h-full overflow-hidden">
        <div>
          <div className="p-4 border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-amber-500" />
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-150 font-bold block">
                Chats
              </span>
            </div>
            <span className="text-[9px] bg-[#161616] border border-[#222] px-2 py-0.5 rounded text-amber-500 font-mono font-bold uppercase">
              {operators.filter(op => op.isOnline).length} Active
            </span>
          </div>

          <div className="overflow-y-auto max-h-[460px] divide-y divide-[#1e1e1e]">
            {operators.map((op) => {
              const matchesActive = op.id === activeOpId;
              const unreadCount = getUnreadCount(op.id);
              const preview = getLastMessagePreview(op.id);
              const lastTime = getLastMessageTime(op.id);

              return (
                <div
                  key={op.id}
                  onClick={() => setActiveOpId(op.id)}
                  className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all duration-150 select-none ${
                    matchesActive 
                      ? 'bg-amber-950/20 border-l-2 border-amber-500' 
                      : 'hover:bg-zinc-900/40 bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <img 
                        src={op.avatar} 
                        alt={op.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-md object-cover border border-[#222]" 
                      />
                      <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-black ${
                        op.isOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold text-xs text-[#ededed] block truncate">
                          {op.name}
                        </span>
                        <span className="text-[9.5px] font-mono text-zinc-600">
                          {lastTime}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-zinc-550 truncate font-sans mt-0.5">
                        {preview}
                      </p>
                    </div>
                  </div>

                  {unreadCount > 0 && (
                    <span className="w-5 h-5 bg-red-600 border border-red-500 font-mono text-2xs text-white font-black flex justify-center items-center rounded-full shrink-0 animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                </div>
              );
            })}

            {operators.length === 0 && (
              <span className="text-zinc-650 italic text-xs block text-center py-8">
                "No operators assigned to station"
              </span>
            )}
          </div>
        </div>

        {/* User context indicator footer */}
        <div className="p-3 bg-[#0a0a0a] border-t border-[#1a1a1a] flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 font-mono">
            CONNECTED AS: SUPERVISOR
          </span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block animate-pulse" />
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE DIRECT CONVERSATION FOR SELECTED OPERATOR (width: 8/12) */}
      <div className="md:col-span-8 bg-[#0a0a0a] flex flex-col justify-between h-full overflow-hidden">
        {activeOp ? (
          <>
            {/* Direct message room header */}
            <div className="p-4 bg-[#111] border-b border-[#262626] flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <img 
                  src={activeOp.avatar} 
                  alt={activeOp.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded object-cover border border-[#222]" 
                />
                <div>
                  <span className="font-sans font-bold text-xs text-[#ededed] block">
                    {activeOp.name}
                  </span>
                </div>
              </div>

              <span className={`text-[10.5px] font-mono ${activeOp.isOnline ? 'text-emerald-400' : 'text-zinc-600'}`}>
                Role: {activeOp.role} ({activeOp.isOnline ? 'Online' : 'Offline'})
              </span>
            </div>

            {/* MESSAGE CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
              {activeRoomMessages.map((msg) => {
                const isSupervisorMsg = msg.senderRole === 'SUPERVISOR';
                const isSystemAlert = msg.isAlert;

                return (
                  <div 
                    key={msg.id}
                    className={`flex flex-col ${isSupervisorMsg ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    {/* Tiny header text */}
                    <div className="flex items-center gap-2 px-1 text-[10px] text-zinc-600 font-mono">
                      <span className={isSupervisorMsg ? 'text-amber-500' : 'text-zinc-400'}>
                        {msg.senderName}
                      </span>
                      <span>•</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Content bubble */}
                    <div 
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isSystemAlert 
                          ? 'bg-red-950/20 border border-red-900/30 text-rose-200'
                          : isSupervisorMsg
                            ? 'bg-amber-950/25 border border-amber-500/30 text-amber-250 font-sans'
                            : 'bg-[#121212] border border-[#222] text-zinc-200 font-sans'
                      }`}
                    >
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })}

              {activeRoomMessages.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center text-zinc-600">
                  <span className="text-xs italic font-sans">
                    No matching chat messages in this secure operator thread.
                  </span>
                  <p className="text-[10px] font-mono text-zinc-700 mt-1">
                    Send instructions below to establish direct tunnel channel
                  </p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* FOOTER MESSAGE WRITER BAR */}
            <div className="p-3 bg-[#111] border-t border-[#262626] flex items-center gap-2">
              <input
                id="inp-supervisor-whatsapp"
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={`Type secure message to ${activeOp.name}...`}
                className="flex-1 bg-[#050505] text-[#ededed] placeholder-[#444] rounded border border-[#222] px-3.5 py-2 text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
              <button
                id="btn-send-whatsapp"
                onClick={handleSend}
                className="p-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded cursor-pointer duration-150"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-650 p-6">
            <span className="text-xs italic font-mono">"Choose an operator from the left sidebar"</span>
          </div>
        )}
      </div>

    </div>
  );
}
