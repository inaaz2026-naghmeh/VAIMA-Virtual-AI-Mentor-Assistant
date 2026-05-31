import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, AlertTriangle, Play, HelpCircle, Activity, User, Bell } from 'lucide-react';
import { Message, Quiz, Role, ChecklistItem } from '../types';

interface OperatorChatProps {
  currentUserId: string;
  currentUserRole: Role;
  currentUserChecklist?: ChecklistItem[];
  messages: Message[];
  onSendMessage: (text: string) => void;
  onSubmitQuizAnswers: (quizId: string, title: string, answers: number[], score: number, total: number) => void;
}

export default function OperatorChat({
  currentUserId,
  currentUserRole,
  currentUserChecklist = [],
  messages,
  onSendMessage,
  onSubmitQuizAnswers,
}: OperatorChatProps) {
  const [typedMessage, setTypedMessage] = useState('');
  
  // Tracking answers for active quizzes: key is quizId, value is array of selected indices or null
  const [activeQuizAnswers, setActiveQuizAnswers] = useState<Record<string, number[]>>({});
  const [activeQuizSubmitting, setActiveQuizSubmitting] = useState<Record<string, boolean>>({});

  // Active notifications state
  const [newNotification, setNewNotification] = useState<string | null>(null);

  // Filter messages meant for this specific operator or sent by them
  const myMessages = messages.filter(msg => {
    return msg.senderId === currentUserId || msg.targetOperatorId === currentUserId || (msg.isAlert && !msg.targetOperatorId);
  });

  const [messagesLength, setMessagesLength] = useState(myMessages.length);

  // Today's checklist state
  const [checklistItems, setChecklistItems] = useState<{ id: string; label: string; desc: string; checked: boolean; }[]>([]);

  useEffect(() => {
    if (currentUserChecklist && currentUserChecklist.length > 0) {
      setChecklistItems(currentUserChecklist.map(item => ({
        id: item.id,
        label: item.label,
        desc: item.desc,
        checked: false // defaulted to false daily
      })));
    } else {
      setChecklistItems([]);
    }
  }, [currentUserChecklist]);

  useEffect(() => {
    if (myMessages.length > messagesLength) {
      const lastMsg = myMessages[myMessages.length - 1];
      if (lastMsg && lastMsg.senderId !== currentUserId) {
        setNewNotification(`New message from ${lastMsg.senderName}: "${lastMsg.content.slice(0, 45)}${lastMsg.content.length > 45 ? '...' : ''}"`);
      }
    }
    setMessagesLength(myMessages.length);
  }, [myMessages, currentUserId, messagesLength]);

  const handleToggleCheck = (id: string) => {
    setChecklistItems(prev =>
      prev.map(item => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleSendChecklist = () => {
    const completed = checklistItems.filter(item => item.checked).map(item => `✅ ${item.label}`);
    const pending = checklistItems.filter(item => !item.checked).map(item => `❌ ${item.label}`);

    let content = `📋 TODAY'S CHECKLIST STATUS REPORT:\n\n`;
    if (completed.length > 0) {
      content += `COMPLETED:\n${completed.join('\n')}\n\n`;
    }
    if (pending.length > 0) {
      content += `PENDING:\n${pending.join('\n')}`;
    }

    onSendMessage(content);
    setNewNotification("Checklist report submitted successfully!");
  };

  const handleSend = () => {
    if (!typedMessage.trim()) return;
    onSendMessage(typedMessage);
    setTypedMessage('');
  };

  const handleQuizOptionSelect = (quizId: string, qIndex: number, oIndex: number) => {
    setActiveQuizAnswers(prev => {
      const current = { ...(prev[quizId] || []) };
      current[qIndex] = oIndex;
      return {
        ...prev,
        [quizId]: Object.values(current) // mapping values
      };
    });
  };

  const submitQuiz = async (quiz: Quiz) => {
    const answersObj = activeQuizAnswers[quiz.id] || [];
    if (Object.keys(answersObj).length < quiz.questions.length) {
      alert("Please solve all safety questions before submission.");
      return;
    }

    // Convert object or list to array of selected options
    const selectedList = quiz.questions.map((_, idx) => (activeQuizAnswers[quiz.id] as any)[idx]);

    // Calculate score
    let score = 0;
    quiz.questions.forEach((q, idx) => {
      if (selectedList[idx] === q.correctOption) {
        score += 1;
      }
    });

    onSubmitQuizAnswers(quiz.id, quiz.title, selectedList, score, quiz.questions.length);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
      {/* Messages Thread list */}
      <div className="lg:col-span-8 flex flex-col justify-between bg-[#111] border border-[#262626] rounded-xl p-4 overflow-hidden h-full">
        <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-3">
          <span className="font-mono text-xs text-[#ededed] uppercase tracking-wider block">
            Chat History
          </span>
          {currentUserRole !== 'OPERATOR' && (
            <span className="flex items-center gap-1.5 text-xs text-[#888] font-mono">
              <Activity className="w-4 h-4 text-amber-500 animate-pulse" />
              Live Sync Sockets ACTIVE
            </span>
          )}
        </div>

        {newNotification && (
          <div className="bg-amber-950/40 border border-amber-900/60 rounded-lg p-2.5 mb-3 flex items-center justify-between text-xs text-amber-200 animate-fade-in shrink-0">
            <span className="font-sans flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-amber-500 animate-bounce shrink-0" />
              {newNotification}
            </span>
            <button 
              onClick={() => setNewNotification(null)} 
              className="text-[10px] font-mono uppercase tracking-wider text-amber-500 hover:text-white px-2 py-0.5 rounded border border-amber-900/30 hover:border-amber-950 bg-black cursor-pointer ml-2 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable container for logs */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-3 min-h-[220px]">
          {myMessages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            const isManager = msg.senderRole === 'SUPERVISOR';
            const isSystemAlert = msg.isAlert;

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1 mb-2`}
              >
                {/* Sender badge header */}
                <div className="flex items-center gap-2 px-1 text-[11px] text-[#888] font-mono">
                  <span className={`${isManager ? 'text-violet-400 font-bold' : 'text-amber-500 font-bold'}`}>
                    {msg.senderName}
                  </span>
                  <span>•</span>
                  <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>

                {/* Message Body */}
                <div 
                  className={`max-w-[85%] rounded-lg p-3 ${
                    isSystemAlert 
                      ? 'bg-red-950/20 border border-red-900/40 text-red-200'
                      : isSelf
                        ? 'bg-amber-950/25 border border-amber-500/30 text-amber-200'
                        : isManager
                          ? 'bg-[#0a0a0a] border border-[#262626] text-[#ededed]'
                          : 'bg-[#141414] border border-[#262626] text-slate-300'
                  }`}
                >
                  <p className="text-sm font-sans leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {/* Render inline Quiz Score Card if attached to the message */}
                  {msg.quizScore && (
                    <div className="mt-3 bg-[#0a0a0a] border border-[#262626] rounded p-2.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-amber-950/20 flex items-center justify-center border border-amber-900/40">
                        <CheckCircle2 className="w-6 h-6 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <span className="font-mono text-xs text-amber-500 font-bold block">
                          SCORE POSTED COMPLIANT
                        </span>
                        <span className="text-[11px] text-[#ededed] font-sans block">
                          Result: {msg.quizScore.score}/{msg.quizScore.total} Correct (
                          {Math.round((msg.quizScore.score / msg.quizScore.total) * 100)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline active Quiz form render inside operator list */}
                {msg.quiz && msg.quiz.status === 'PENDING' && currentUserRole === 'OPERATOR' && (
                  <div className="w-full max-w-[90%] bg-[#0a0a0a] border border-[#262626] rounded-lg p-4 mt-2 shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#262626] pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Play className="w-5 h-5 text-amber-500" />
                        <h4 className="font-mono text-sm text-yellow-500 font-bold uppercase">
                          {msg.quiz.title}
                        </h4>
                      </div>
                      <span className="bg-amber-950/20 border border-amber-900/40 text-amber-500 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                        Requires action
                      </span>
                    </div>

                    <div className="space-y-4">
                      {msg.quiz.questions.map((q, qIdx) => {
                        const selectedVal = (activeQuizAnswers[msg.quiz!.id] || [])[qIdx];
                        
                        return (
                          <div key={q.id} className="border-b border-[#262626] pb-3 last:border-b-0">
                            <p className="text-xs text-[#ededed] font-sans font-medium mb-2 flex gap-1.5">
                              <span className="font-mono text-amber-500">{qIdx + 1}.</span>
                              {q.question}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                              {q.options.map((option, oIdx) => {
                                const isSelected = selectedVal === oIndexToNum(oIdx);
                                return (
                                  <button
                                    key={oIdx}
                                    id={`btn-quiz-option-${msg.quiz!.id}-${qIdx}-${oIdx}`}
                                    onClick={() => handleQuizOptionSelect(msg.quiz!.id, qIdx, oIdx)}
                                    className={`text-left p-2.5 rounded border text-xs font-sans transition-all duration-200 cursor-pointer ${
                                      isSelected
                                        ? 'bg-amber-950/20 text-amber-500 border-amber-500'
                                        : 'bg-[#111] text-[#888] border-[#262626] hover:bg-[#141414]'
                                    }`}
                                  >
                                    <span className="font-mono font-bold mr-1">{offsetToChar(oIdx)}.</span>{' '}
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Submit Quiz actions */}
                    <div className="mt-4 pt-3 border-t border-[#262626] flex justify-end">
                      <button
                        id={`btn-submit-active-quiz-${msg.quiz!.id}`}
                        onClick={() => submitQuiz(msg.quiz!)}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-sans font-semibold text-xs px-4 py-2 rounded shadow transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Submit Answers
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 border-t border-[#262626] pt-3">
          <input
            id="inp-chat-message"
            type="text"
            value={typedMessage}
            onChange={(e) => setTypedMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type message to Dispatch..."
            className="flex-1 bg-[#0a0a0a] text-[#ededed] placeholder-[#444] rounded border border-[#262626] px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
          />
          <button
            id="btn-chat-send"
            onClick={handleSend}
            className="p-3 bg-amber-500 hover:bg-amber-600 rounded text-black cursor-pointer"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: REALTIME ACTIVE COMPLIANCE WIDGET ALERTS */}
      <div className="lg:col-span-4 bg-[#111] border border-[#262626] rounded-xl p-4 flex flex-col justify-between h-full">
        <div>
          <h4 className="font-mono text-xs text-[#ededed] uppercase tracking-wider mb-3 pb-2 border-b border-[#262626] flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-500" />
            Today's Checklist
          </h4>
          
          <div className="space-y-3.5">
            {checklistItems.map(item => (
              <div key={item.id} className="flex items-start gap-2.5 check-item">
                <input 
                  type="checkbox" 
                  checked={item.checked} 
                  onChange={() => handleToggleCheck(item.id)}
                  className="mt-1 accent-amber-500 cursor-pointer" 
                />
                <div>
                  <span className="text-xs font-sans font-medium text-[#ededed] block">{item.label}</span>
                  <span className="text-[10px] text-[#888] block">{item.desc}</span>
                </div>
              </div>
            ))}
            {checklistItems.length === 0 && (
              <span className="text-xs font-sans text-neutral-500 italic block py-4 text-center border-dashed border border-[#262626] rounded">
                No supervisor checklist assigned yet.
              </span>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-[#262626]">
            <button
              id="btn-send-checklist"
              onClick={handleSendChecklist}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded text-xs transition-all duration-200 cursor-pointer hover:shadow-md active:scale-[0.98]"
            >
              <Send className="w-3 h-3" />
              Send Checklist Status
            </button>
          </div>
        </div>

        {/* Emergency quick vent warning badge */}
        <div className="bg-amber-950/20 border border-amber-900/40 p-3 rounded-lg flex items-start gap-3">
          <AlertTriangle className="text-amber-500 w-5 h-5 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
              Pneumatic Vent Safety Warning
            </span>
            <span className="text-[10px] text-slate-350 block font-sans leading-relaxed mt-1">
              If acoustic E-740 buzzer triggers and pressure goes above 8.5 Bars, relocate Red Valve #34 situational aux bay rotation 90 deg counter-clockwise immediately!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper conversions
function offsetToChar(offset: number) {
  return String.fromCharCode(65 + offset);
}
function oIndexToNum(idx: number): number {
  return idx;
}
