import React, { useState, useEffect } from 'react';
import { 
  User, FileText, UploadCloud, PlusCircle, Save, Award, Clock, Trash2, HelpCircle, CheckCircle2, AlertTriangle, File
} from 'lucide-react';
import { DocumentMetadata, User as OperatorUser, Team } from '../types';

interface QueueItem {
  id: string;
  name: string;
  size: number;
  title: string;
  content: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

interface SupervisorTrainingProps {
  documents: DocumentMetadata[];
  users: OperatorUser[];
  onSyncSuccess: () => void;
  teams?: Team[];
  currentUserRole?: string;
}

export default function SupervisorTraining({
  documents = [],
  users = [],
  onSyncSuccess,
  teams = [],
  currentUserRole = 'SUPERVISOR'
}: SupervisorTrainingProps) {
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');

  const isTeamFiltered = selectedTeamId !== 'ALL' && teams && teams.length > 0;
  const teamObj = isTeamFiltered ? teams.find(t => t.id === selectedTeamId) : null;
  const teamOperatorIds = teamObj ? teamObj.operatorIds : [];

  const operators = isTeamFiltered
    ? users.filter(u => u.role === 'OPERATOR' && teamOperatorIds.includes(u.id))
    : users.filter(u => u.role === 'OPERATOR');

  // Active selected operator state
  const [selectedOp, setSelectedOp] = useState<OperatorUser | null>(null);

  // Default selection or change
  useEffect(() => {
    if (operators.length > 0) {
      if (!selectedOp || !operators.some(o => o.id === selectedOp.id)) {
        setSelectedOp(operators[0]);
      }
    } else {
      setSelectedOp(null);
    }
  }, [selectedTeamId, operators, selectedOp]);

  // --- COMPONENT STATES ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTextMode, setUploadTextMode] = useState<boolean>(false); // toggle between multi file mode and manual text mode
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Multi-file queue states
  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Active quiz feeds selections
  const [selectedQuizFeedIds, setSelectedQuizFeedIds] = useState<string[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (selectedOp) {
      setSelectedQuizFeedIds(selectedOp.assignedTutorialDocIds || []);
    }
  }, [selectedOp]);

  // Toggle checks selection
  const handleToggleQuizFeed = (docId: string) => {
    setSelectedQuizFeedIds(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSaveQuizFeeds = async () => {
    if (!selectedOp) return;
    setSaveLoading(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/users/${selectedOp.id}/tutorial-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTutorialDocIds: selectedQuizFeedIds })
      });

      if (res.ok) {
        setSaveSuccess(true);
        onSyncSuccess(); // reload state
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert("Failed to save quiz sources configuration.");
      }
    } catch (e) {
      console.error(e);
      alert("Network or database update failed.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Helper: parse files to queue
  const handleAddFilesToQueue = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const id = `${Date.now()}-${Math.random()}`;
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isTextReadable = ['txt', 'md', 'json', 'csv', 'yaml', 'yml', 'xml', 'html'].includes(extension || '') || file.type.startsWith('text/');

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const cleanTitle = baseName
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      const newItem: QueueItem = {
        id,
        name: file.name,
        size: file.size,
        title: cleanTitle,
        content: '',
        status: 'pending'
      };

      if (isTextReadable) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newItem.content = e.target?.result as string || '';
          setUploadQueue(prev => [...prev, newItem]);
        };
        reader.onerror = () => {
          newItem.content = "Error reading file content.";
          newItem.status = 'error';
          newItem.errorMessage = "Failed to read local text file.";
          setUploadQueue(prev => [...prev, newItem]);
        };
        reader.readAsText(file);
      } else {
        newItem.content = `[SYSTEM REFERENCED BINARY SPECIFICATION FILE]
File Name: ${file.name}
File Size: ${(file.size / 1024).toFixed(2)} KB
Content Type: ${file.type || 'Binary Stream'}
Reference Date: ${new Date().toLocaleDateString()}
Uploaded By: Sarah Jenkins

This document acts as an active manufacturer calibration guide, machinery specification standard, or external physical layout scheme mapped to the operator safety Avatar.
(PDF content character-stream is auto-referenced by AI agent model using external binary parsers)`;
        // Stagger to ensure updates aren't throttled
        setTimeout(() => {
          setUploadQueue(prev => [...prev, newItem]);
        }, 10);
      }
    });
  };

  const handleRemoveQueueItem = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateQueueItemTitle = (id: string, newTitle: string) => {
    setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, title: newTitle } : item));
  };

  // Upload sequential queue
  const handleUploadQueue = async () => {
    if (!selectedOp) return;
    
    const pendingItems = uploadQueue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      alert("No pending files to build standard guidelines.");
      return;
    }

    setUploadLoading(true);
    let successfullyUploadedIds: string[] = [];

    // process sequentially
    for (const item of pendingItems) {
      setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

      try {
        const payload = {
          title: item.title,
          content: item.content || `Empty placeholder specifications manual for ${item.title}.`,
          fileName: item.name,
          accessLevel: 'OPERATOR',
          uploadedBy: "Sarah Jenkins",
          targetOperatorId: selectedOp.id
        };

        const docRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (docRes.ok) {
          const generatedDoc = await docRes.json();
          successfullyUploadedIds.push(generatedDoc.id);
          
          setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
        } else {
          setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorMessage: 'Save Error' } : q));
        }
      } catch (err) {
        console.error(err);
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorMessage: 'Network Failure' } : q));
      }
    }

    if (successfullyUploadedIds.length > 0) {
      const updatedFeeds = [...selectedQuizFeedIds, ...successfullyUploadedIds];
      setSelectedQuizFeedIds(updatedFeeds);

      // Save user assignment directly so it links instantly
      await fetch(`/api/users/${selectedOp.id}/tutorial-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTutorialDocIds: updatedFeeds })
      });

      onSyncSuccess(); // sync
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }

    setUploadLoading(false);

    // If fully successful, auto shut modal in 1.4s
    const hasErrors = uploadQueue.some(q => q.status === 'error');
    const hasPendingAndUploading = uploadQueue.some(q => q.status === 'pending' || q.status === 'uploading');
    if (!hasErrors) {
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadQueue([]);
      }, 1200);
    }
  };

  // For classic single written text manuals
  const handleUploadSingleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOp) return;
    if (!newTitle.trim() || !newContent.trim()) {
      alert("Please provide custom quiz manual title and troubleshooting content.");
      return;
    }

    setUploadLoading(true);
    try {
      const payload = {
        title: newTitle,
        content: newContent,
        fileName: newFileName || `${newTitle.toLowerCase().replace(/\s+/g, '_')}_quiz_ref.txt`,
        accessLevel: 'OPERATOR',
        uploadedBy: "Sarah Jenkins",
        targetOperatorId: selectedOp.id
      };

      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const generatedDoc = await docRes.json();

      const updatedFeeds = [...selectedQuizFeedIds, generatedDoc.id];
      setSelectedQuizFeedIds(updatedFeeds);

      await fetch(`/api/users/${selectedOp.id}/tutorial-sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTutorialDocIds: updatedFeeds })
      });

      setNewTitle('');
      setNewContent('');
      setNewFileName('');
      setShowUploadModal(false);
      onSyncSuccess(); // sync
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert("Error uploading custom manual.");
    } finally {
      setUploadLoading(false);
    }
  };


  return (
    <div id="ai-training-quizzes-root" className="space-y-6">
      
      {/* SECTION 1 HEADER BAR WITH OPERATOR SWITCHER */}
      <div className="bg-[#111] border border-[#262626] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-amber-500" />
          <div>
            <span className="font-mono text-xs uppercase text-[#ededed] block font-semibold">
              Select Operator focus
            </span>
            <span className="text-[10px] text-zinc-500 font-sans block mb-1">
              {currentUserRole === 'MANAGER' ? "Filter by team first, then pick an operator." : "Choose an operator to select active quiz documents representing their question banks"}
            </span>
            {currentUserRole === 'MANAGER' && teams && teams.length > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-[#050505] border border-[#222] px-2 py-1 rounded mt-1.5">
                <span className="font-mono text-[9px] uppercase text-[#666]">Active Team:</span>
                <select
                  id="quiz-team-filter"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="bg-transparent text-[11px] font-sans text-amber-500 focus:outline-none border-none cursor-pointer pr-1"
                >
                  <option value="ALL">ALL TEAMS</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id} className="bg-[#111] text-white">{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {operators.map((op) => (
            <button
              key={op.id}
              onClick={() => setSelectedOp(op)}
              className={`flex items-center gap-2 px-3.5 py-2 border rounded-lg font-sans text-xs transition-all cursor-pointer ${
                selectedOp?.id === op.id
                  ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow'
                  : 'bg-[#0a0a0a] border-[#222] text-[#888] hover:border-[#444] hover:text-white'
              }`}
            >
              <img 
                src={op.avatar} 
                alt={op.name}
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded object-cover" 
              />
              <span className="font-semibold">{op.name}</span>
              <span className="font-mono text-[9px] text-zinc-500">@{op.username}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CORE ASSIGNED DOCUMENTS WORKSPACE */}
      {selectedOp ? (
        <div className="bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-amber-500" />
                <div>
                  <h3 className="font-sans font-bold text-xs uppercase text-[#ededed] tracking-wide">
                    {selectedOp.name}'s Quiz Reference Documents Assignment
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono">Check custom technical manuals that feed questions and answers for their quizzes</p>
                </div>
              </div>

              <button
                id="btn-training-upload-modal"
                onClick={() => setShowUploadModal(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-2xs uppercase tracking-wider rounded font-mono shadow duration-200 cursor-pointer flex items-center gap-1"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Upload new manual
              </button>
            </div>

            {/* DOCUMENTS GRID WITH ACTIVE CHECKS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 mb-4">
              {documents.map((doc) => {
                const isSelected = selectedQuizFeedIds.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleToggleQuizFeed(doc.id)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3.5 ${
                      isSelected
                        ? 'bg-amber-950/15 border-amber-500 text-amber-400 font-medium'
                        : 'bg-[#0a0a0a] border-[#222] text-[#888] hover:border-[#333]'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // toggling taken care of by div click
                      className="mt-1"
                      id={`chk-training-doc-${doc.id}`}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-sans font-bold text-xs text-[#ededed] block truncate leading-snug">
                        {doc.title}
                      </span>
                      <p className="font-mono text-[9px] text-[#888] truncate mt-1">
                        File: {doc.fileName}
                      </p>
                    </div>
                  </div>
                );
              })}

              {documents.length === 0 && (
                <div className="text-center py-16 text-zinc-650 italic text-xs font-mono col-span-2">
                  "No reference training manuals populated in index"
                </div>
              )}
            </div>
          </div>

          {/* SAVE SELECTION ACTIONS BAR */}
          <div className="border-t border-[#262626] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-auto">
            <span className="text-[10px] text-zinc-500 font-sans leading-relaxed">
              * The checked manuals directly feed the micro-learning evaluation generator for {selectedOp.name}.
            </span>

            <button
              id="btn-save-quiz-feeds"
              onClick={handleSaveQuizFeeds}
              disabled={saveLoading}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-[#151515] text-black font-semibold text-xs font-sans rounded shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:text-[#444]"
            >
              <Save className="w-4 h-4" />
              {saveLoading ? "Saving Feeds..." : "Save Feeds Configuration"}
            </button>
          </div>

          {saveSuccess && (
            <span className="text-[10px] text-emerald-400 block font-mono mt-2 animate-pulse text-right">
              ✓ Training quiz feeds configuration updated successfully!
            </span>
          )}
        </div>
      ) : (
        <div className="text-center py-20 border border-[#262626] border-dashed rounded-xl">
          <span className="text-sm italic text-zinc-650 font-sans">"Please select an operator above to manage their quiz feeds"</span>
        </div>
      )}

      {/* UPLOAD MULTIPLE FILES / MANUALLY CREATED FEED DIALOG */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0d0d0d] border border-[#222] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1a1a1a] flex justify-between items-center bg-[#070707]">
              <div>
                <span className="font-mono text-xs text-[#deb887] uppercase tracking-wider font-bold block">
                  Reference Manuals Management
                </span>
                <span className="font-sans font-medium text-xs text-zinc-400 mt-1 block">
                  Feed active learning blueprints for <strong className="text-white">{selectedOp?.name}</strong>
                </span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadQueue([]);
                }}
                className="text-zinc-500 hover:text-white font-mono text-sm cursor-pointer p-1.5 rounded-lg bg-zinc-900/30 border border-zinc-800 hover:bg-zinc-800 transition-all"
              >
                ✖
              </button>
            </div>

            {/* Modal Navigation Tabs (Multi-file upload vs Single Manual editor) */}
            <div className="px-6 py-3 border-b border-[#1a1a1a] bg-[#0c0c0c] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUploadTextMode(false)}
                className={`flex-1 py-1.5 px-3 rounded text-[11px] font-mono uppercase tracking-wide font-bold transition-all ${
                  !uploadTextMode 
                    ? 'bg-amber-500 text-black shadow font-extrabold' 
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-900/40'
                }`}
              >
                📂 Multi-File Upload Queue ({uploadQueue.length})
              </button>
              <button
                type="button"
                onClick={() => setUploadTextMode(true)}
                className={`flex-1 py-1.5 px-3 rounded text-[11px] font-mono uppercase tracking-wide font-bold transition-all ${
                  uploadTextMode 
                    ? 'bg-amber-500 text-black shadow font-extrabold' 
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-900/40'
                }`}
              >
                ✍️ Build Single Guide Text
              </button>
            </div>

            {/* Scrollable Container Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* TAB A: MULTIPLE FILE PICKER & QUEUE */}
              {!uploadTextMode ? (
                <div className="space-y-4">
                  
                  {/* Drag and Drop Box */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleAddFilesToQueue(e.dataTransfer.files);
                      }
                    }}
                    onClick={() => document.getElementById('dialog-multi-file-picker')?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                      dragActive 
                        ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.05)]' 
                        : 'border-[#333] hover:border-zinc-500 bg-[#060606] hover:bg-[#090909]'
                    }`}
                  >
                    <input 
                      type="file" 
                      id="dialog-multi-file-picker"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleAddFilesToQueue(e.target.files);
                        }
                      }}
                    />
                    <UploadCloud className="w-10 h-10 text-amber-500/80 mb-3" />
                    <span className="text-xs font-sans text-zinc-300 font-bold block">
                      Drag & Drop several safety manuals at once or click to browse
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-1.5 block">
                      Supports .txt, .pdf, .md, .docx standard manual guidelines
                    </span>
                  </div>

                  {/* Staged Queue Section */}
                  <div className="space-y-2.5">
                    {uploadQueue.length > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-extrabold">Staged files ({uploadQueue.length})</span>
                        <button
                          type="button"
                          onClick={() => setUploadQueue([])}
                          className="text-[10px] text-rose-400 hover:text-[#f43f5e] font-mono uppercase bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded"
                        >
                          Clear All
                        </button>
                      </div>
                    )}

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {uploadQueue.map((item) => {
                        const isSuccess = item.status === 'success';
                        const isUploading = item.status === 'uploading';
                        const isError = item.status === 'error';

                        return (
                          <div 
                            key={item.id} 
                            className={`p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                              isSuccess 
                                ? 'bg-emerald-950/10 border-emerald-500/30' 
                                : isError 
                                ? 'bg-rose-950/10 border-rose-500/30'
                                : isUploading
                                ? 'bg-amber-500/5 border-amber-500/30'
                                : 'bg-black/20 border-[#222]'
                            }`}
                          >
                            {/* Icon Staging indicator */}
                            <div className="p-1.5 bg-zinc-900 rounded shrink-0">
                              {isSuccess ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : isError ? (
                                <AlertTriangle className="w-4 h-4 text-rose-400" />
                              ) : isUploading ? (
                                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <File className="w-4 h-4 text-zinc-400" />
                              )}
                            </div>

                            {/* Info & editable Title */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-mono text-zinc-500 truncate block max-w-[150px]">
                                  {item.name}
                                </span>
                                <span className="text-[9px] font-mono text-zinc-650">•</span>
                                <span className="text-[9px] font-mono text-zinc-500">
                                  {(item.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                              <input 
                                type="text"
                                value={item.title}
                                placeholder="Edit descriptive quiz manual label"
                                onChange={(e) => handleUpdateQueueItemTitle(item.id, e.target.value)}
                                className="w-full bg-black/40 border border-[#262626] font-sans rounded p-1.5 text-xs text-white placeholder-zinc-600 focus:border-amber-500/80 focus:outline-none focus:bg-[#050505]"
                              />
                              {isError && (
                                <span className="text-[9px] text-rose-400 font-mono block mt-1">
                                  ⚠ {item.errorMessage || "Failed to process manual"}
                                </span>
                              )}
                            </div>

                            {/* Remove button */}
                            {item.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveQueueItem(item.id)}
                                className="text-zinc-500 hover:text-rose-400 transition-colors p-1.5 hover:bg-rose-500/10 rounded shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {uploadQueue.length === 0 && (
                        <div className="text-center py-10 border border-[#1a1a1a] border-dashed rounded-lg bg-black/10">
                          <HelpCircle className="w-6 h-6 text-zinc-650 mx-auto mb-2" />
                          <p className="text-[11px] text-[#888] font-sans">No reference specs selected yet.</p>
                          <p className="text-[9px] text-zinc-500 font-mono mt-1">Staging files parse content to construct your adaptive testing questions.</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                
                /* TAB B: CLASSIC MANUAL SINGLE TEXT EDITOR */
                <form id="form-single-manual" onSubmit={handleUploadSingleManual} className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] text-zinc-500 uppercase font-bold">Document Title / Asset Name</label>
                    <input 
                      id="modal-training-title"
                      type="text" 
                      required
                      placeholder="e.g., Siemens S7-300 Evacuation Drill" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="bg-[#050505] border border-[#222] rounded p-2.5 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] text-zinc-500 uppercase font-bold">Filename Identifier</label>
                    <input 
                      id="modal-training-filename"
                      type="text" 
                      placeholder="e.g., drill_safety_spec.txt" 
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="bg-[#050505] border border-[#222] rounded p-2.5 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] text-zinc-500 uppercase font-bold">Technical manual warnings guidelines text</label>
                    <textarea 
                      id="modal-training-content"
                      required
                      rows={6}
                      placeholder="Input detailed diagnostic warnings, error index thresholds and specific valve regulations so model can generate targeted test questions..." 
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="bg-[#050505] border border-[#222] rounded p-2.5 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </form>
              )}

            </div>

            {/* Modal Actions Footer Bar */}
            <div className="px-6 py-4 bg-[#070707] border-t border-[#1a1a1a] flex gap-3 items-center">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadQueue([]);
                }}
                className="flex-1 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs rounded uppercase font-sans font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>

              {!uploadTextMode ? (
                <button
                  type="button"
                  onClick={handleUploadQueue}
                  disabled={uploadLoading || uploadQueue.length === 0}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-950 text-black disabled:text-zinc-600 text-xs font-sans font-bold rounded uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  {uploadLoading ? "Uploading Queue..." : `Upload ${uploadQueue.length} File${uploadQueue.length !== 1 ? 's' : ''}`}
                </button>
              ) : (
                <button
                  type="submit"
                  form="form-single-manual"
                  disabled={uploadLoading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-920 text-black disabled:text-zinc-600 text-xs font-sans font-bold rounded uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  {uploadLoading ? "Publishing guide..." : "Index written guide"}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
