import React, { useState, useEffect } from 'react';
import { 
  User, CheckSquare, FileText, UploadCloud, PlusCircle, Trash2, 
  Save, Sparkles, BookOpen, Clock, AlertCircle, ArrowRight,
  File, Globe, Link2
} from 'lucide-react';
import { DocumentMetadata, User as OperatorUser, ChecklistItem, Team } from '../types';

interface SupervisorUploadProps {
  documents: DocumentMetadata[];
  users: OperatorUser[];
  onUploadSuccess: () => void;
  teams?: Team[];
  currentUserRole?: string;
}

export default function SupervisorUpload({ 
  documents = [], 
  users = [], 
  onUploadSuccess,
  teams = [],
  currentUserRole = 'SUPERVISOR'
}: SupervisorUploadProps) {
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');

  const isTeamFiltered = selectedTeamId !== 'ALL' && teams && teams.length > 0;
  const teamObj = isTeamFiltered ? teams.find(t => t.id === selectedTeamId) : null;
  const teamOperatorIds = teamObj ? teamObj.operatorIds : [];

  const operators = isTeamFiltered
    ? users.filter(u => u.role === 'OPERATOR' && teamOperatorIds.includes(u.id))
    : users.filter(u => u.role === 'OPERATOR');

  // Active state
  const [selectedOp, setSelectedOp] = useState<OperatorUser | null>(null);

  // Default to first operator if list loaded or changed
  useEffect(() => {
    if (operators.length > 0) {
      if (!selectedOp || !operators.some(o => o.id === selectedOp.id)) {
        setSelectedOp(operators[0]);
      }
    } else {
      setSelectedOp(null);
    }
  }, [selectedTeamId, operators, selectedOp]);

  // --- SECTION 1 STATES ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Active modal upload method: 'local' (file system), 'internet' (Google Drive/URL link), 'editor' (classic text entry)
  const [uploadMethod, setUploadMethod] = useState<'local' | 'internet' | 'editor'>('local');
  const [internetUrl, setInternetUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Helper: auto extract title and process file loading on local select
  const handleFileChangeHelper = (file: File) => {
    if (!file) return;
    
    setNewFileName(file.name);
    
    // Auto populate a clean uppercase title
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const cleanTitle = baseName
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    setNewTitle(cleanTitle);

    const extension = file.name.split('.').pop()?.toLowerCase();
    const isTextReadable = ['txt', 'md', 'json', 'csv', 'yaml', 'yml', 'xml', 'html'].includes(extension || '') || file.type.startsWith('text/');

    if (isTextReadable) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setNewContent(text);
      };
      reader.onerror = () => {
        alert("Error loading local file.");
      };
      reader.readAsText(file);
    } else {
      // Mock / extract metadata for binary files (such as PDF files)
      const mockContent = `[SYSTEM REFERENCED BINARY SPECIFICATION FILE]
File Name: ${file.name}
File Size: ${(file.size / 1024).toFixed(2)} KB
Content Type: ${file.type || 'Binary Stream'}
Reference Date: ${new Date().toLocaleDateString()}
Uploaded By: Sarah Jenkins

This document acts as an active manufacturer calibration guide, machinery specification standard, or external physical layout scheme mapped to the operator safety Avatar.
(PDF content character-stream is auto-referenced by AI agent model using external binary parsers)`;
      setNewContent(mockContent);
    }
  };

  // Helper: handle internet URL entries and default description metadata
  const handleUrlChangeHelper = (url: string) => {
    setInternetUrl(url);
    if (url.trim()) {
      const parsedUrl = url.split('/').pop()?.split('?')[0] || "cloud_spec.pdf";
      const guessTitle = "Internet Asset: " + parsedUrl
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      setNewTitle(prev => prev ? prev : guessTitle);
      setNewFileName(prev => prev ? prev : parsedUrl);

      const defaultInternetContent = `[EXTERNAL CLOUD DATABASE ASSET REFERENCE]
Resource URL Link: ${url}
Assigned Operator: ${selectedOp?.name || 'Authorized Operator'}
Registered timestamp: ${new Date().toISOString()}

This link serves as an external industrial source (Google Drive specification sheet, Siemens online guide, or enterprise intranet page) feeding active diagnostic procedures to safety avatars.`;
      setNewContent(defaultInternetContent);
    }
  };
  
  // Track selected documents checklist for current operator
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [feedSaveLoading, setFeedSaveLoading] = useState(false);
  const [feedSaveSuccess, setFeedSaveSuccess] = useState(false);

  useEffect(() => {
    if (selectedOp) {
      setSelectedDocIds(selectedOp.assignedDocumentIds || []);
    }
  }, [selectedOp]);

  // Toggle document assignment
  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const handleDeleteDoc = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingDocId !== docId) {
      setDeletingDocId(docId);
      // Reset deletion confirmation state after 3 seconds
      setTimeout(() => setDeletingDocId(null), 3000);
      return;
    }

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSelectedDocIds(prev => prev.filter(id => id !== docId));
        onUploadSuccess();
        setDeletingDocId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAvatarFeeds = async () => {
    if (!selectedOp) return;
    setFeedSaveLoading(true);
    setFeedSaveSuccess(false);

    try {
      const res = await fetch(`/api/users/${selectedOp.id}/assigned-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedDocumentIds: selectedDocIds })
      });
      if (res.ok) {
        setFeedSaveSuccess(true);
        onUploadSuccess(); // refresh database
        setTimeout(() => setFeedSaveSuccess(false), 4000);
      } else {
        alert("Feeds saving error.");
      }
    } catch (e) {
      console.error(e);
      alert("Network or database update failed.");
    } finally {
      setFeedSaveLoading(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOp) return;
    if (!newTitle.trim() || !newContent.trim()) {
      alert("Provide a document title and the manufacturer standard guideline text.");
      return;
    }

    setUploadLoading(true);
    try {
      const payload = {
        title: newTitle,
        content: newContent,
        fileName: newFileName || `${newTitle.toLowerCase().replace(/\s+/g, '_')}_spec.txt`,
        accessLevel: 'OPERATOR',
        uploadedBy: "Sarah Jenkins",
        targetOperatorId: selectedOp.id,
        externalLink: uploadMethod === 'internet' ? internetUrl : undefined
      };

      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const generatedDoc = await docRes.json();

      // Automatically check this document ID into the operator's active assigned doc IDs list
      const updatedDocs = [...selectedDocIds, generatedDoc.id];
      setSelectedDocIds(updatedDocs);

      // Save user assignment directly so it links instantly
      await fetch(`/api/users/${selectedOp.id}/assigned-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedDocumentIds: updatedDocs })
      });

      setNewTitle('');
      setNewContent('');
      setNewFileName('');
      setShowUploadModal(false);
      onUploadSuccess(); // refresh parent states
      
      setFeedSaveSuccess(true);
      setTimeout(() => setFeedSaveSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert("Error uploading document feed.");
    } finally {
      setUploadLoading(false);
    }
  };

  // --- SECTION 2 STATES ---
  const [operatorChecklist, setOperatorChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [newChecklistDesc, setNewChecklistDesc] = useState('');
  const [checklistSaveLoading, setChecklistSaveLoading] = useState(false);
  const [checklistSaveSuccess, setChecklistSaveSuccess] = useState(false);

  useEffect(() => {
    if (selectedOp) {
      setOperatorChecklist(selectedOp.checklist || []);
    }
  }, [selectedOp]);

  const handleInsertChecklistTask = () => {
    if (!newChecklistLabel.trim()) {
      alert("Please fill in the checklist task heading / action item.");
      return;
    }
    const newTask: ChecklistItem = {
      id: `chk-${Date.now()}`,
      label: newChecklistLabel,
      desc: newChecklistDesc || 'Operational safety checklist action'
    };
    setOperatorChecklist(prev => [...prev, newTask]);
    setNewChecklistLabel('');
    setNewChecklistDesc('');
  };

  const handleDeleteChecklistTask = (taskId: string) => {
    setOperatorChecklist(prev => prev.filter(t => t.id !== taskId));
  };

  const handleSaveChecklist = async () => {
    if (!selectedOp) return;
    setChecklistSaveLoading(true);
    setChecklistSaveSuccess(false);

    try {
      const res = await fetch(`/api/users/${selectedOp.id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: operatorChecklist })
      });
      if (res.ok) {
        setChecklistSaveSuccess(true);
        onUploadSuccess(); // sync
        setTimeout(() => setChecklistSaveSuccess(false), 4000);
      } else {
        alert("Checklist save failure.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving operator daily checklist configuration.");
    } finally {
      setChecklistSaveLoading(false);
    }
  };

  return (
    <div id="upload-manuals-root" className="space-y-8">
      
      {/* OPERATORS CONTROLLER ROW */}
      <div className="bg-[#111] border border-[#262626] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-amber-500" />
          <div>
            <span className="font-mono text-xs uppercase text-[#ededed] block font-semibold">
              Select Operator focus
            </span>
            <span className="text-[10px] text-zinc-500 font-sans block mb-1">
              {currentUserRole === 'MANAGER' ? "Filter by team first, then pick an operator." : "Choose an operator below to adjust RAG feeds & Checklist"}
            </span>
            {currentUserRole === 'MANAGER' && teams && teams.length > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-[#050505] border border-[#222] px-2 py-1 rounded mt-1.5">
                <span className="font-mono text-[9px] uppercase text-[#666]">Active Team:</span>
                <select
                  id="uploads-team-filter"
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

        <div className="flex flex-wrap gap-2.5">
          {operators.map((op) => (
            <button
              key={op.id}
              onClick={() => setSelectedOp(op)}
              className={`flex items-center gap-2 px-3.5 py-2 border rounded-lg font-sans text-xs transition-all cursor-pointer ${
                selectedOp?.id === op.id
                  ? 'bg-amber-950/20 border-amber-500 text-amber-500 shadow-md shadow-amber-500/5'
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
              <span className="font-mono text-[9px] text-[#555]">@{op.username}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedOp ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* --- SECTION 1: AVATAR MANUALS FEEDS --- */}
          <div className="lg:col-span-6 bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-cyan-400" />
                  <div>
                    <h3 className="font-sans font-bold text-xs uppercase text-[#ededed] tracking-wide">
                      Section 1: {selectedOp.name}'s Avatar Feeds
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono">Select technical documents assigned to their custom Avatar RAG</p>
                  </div>
                </div>

                <button
                  id="btn-trigger-upload-modal"
                  onClick={() => setShowUploadModal(true)}
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-2xs uppercase tracking-wider rounded font-mono shadow duration-200 cursor-pointer flex items-center gap-1"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload documents
                </button>
              </div>

              {/* LIST OF DOCUMENTS WITH CHECKBOXES */}
              <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-2 mb-4">
                {documents.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.id);
                  return (
                    <div 
                      key={doc.id}
                      onClick={() => handleToggleDoc(doc.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-200' 
                          : 'bg-[#0a0a0a] border-[#222] text-[#888] hover:border-[#333]'
                      }`}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // toggling taken care of by div click
                        className="mt-1"
                        id={`chk-feed-doc-${doc.id}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-sans font-bold text-xs text-[#ededed] block leading-snug truncate">
                            {doc.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {doc.externalLink && (
                              <a
                                href={doc.externalLink}
                                onClick={(e) => e.stopPropagation()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-[#ededed] bg-cyan-950 hover:bg-cyan-900 border border-cyan-600/50 px-1.5 py-0.5 rounded cursor-pointer duration-150 flex items-center gap-1 font-mono hover:text-cyan-450 text-[10px]"
                              >
                                <Link2 className="w-2.5 h-2.5 text-cyan-450" />
                                Link
                              </a>
                            )}
                            <button
                              id={`btn-delete-doc-${doc.id}`}
                              type="button"
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              className={`text-[9.5px] px-2 py-0.5 rounded cursor-pointer duration-150 flex items-center gap-1 font-mono hover:text-red-400 ${
                                deletingDocId === doc.id
                                  ? 'bg-red-950/40 border border-red-500/50 text-red-200 animate-pulse font-bold'
                                  : 'bg-[#141414] border border-[#222] text-[#888] hover:bg-[#1f1f1f] hover:border-[#333]'
                              }`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              {deletingDocId === doc.id ? 'Confirm?' : 'Delete'}
                            </button>
                          </div>
                        </div>
                        <span className="font-mono text-[9px] text-zinc-500 block leading-tight mt-1">
                          Filename: {doc.fileName} • Size: {(doc.fileSize / 1024).toFixed(1)} KB • Indexed: {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {documents.length === 0 && (
                  <div className="text-center py-12 text-zinc-650 italic text-xs font-mono">
                    "No technical files uploaded in core databases"
                  </div>
                )}
              </div>
            </div>

            {/* SAVE ACTION REDUX */}
            <div className="border-t border-[#262626] pt-4 flex items-center justify-between gap-4 mt-auto">
              <span className="text-[9.5px] italic text-[#666] leading-snug font-sans">
                These selected documents exclusively feed this operator's custom safety Avatar assistant.
              </span>
              
              <button
                id="btn-save-avatar-feeds"
                onClick={handleSaveAvatarFeeds}
                disabled={feedSaveLoading}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-[#151515] text-black font-semibold text-xs font-sans rounded shadow shrink-0 flex items-center gap-1.5 cursor-pointer disabled:text-[#444]"
              >
                <Save className="w-4 h-4" />
                {feedSaveLoading ? "Linking..." : "Save Config"}
              </button>
            </div>

            {feedSaveSuccess && (
              <span className="text-[10px] text-emerald-400 block font-mono mt-2 animate-pulse text-right">
                ✓ Avatar Feeds successfully committed to operator database index!
              </span>
            )}
          </div>

          {/* --- SECTION 2: OPERATOR DAILY CHECKLIST --- */}
          <div className="lg:col-span-6 bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4.5 h-4.5 text-amber-500" />
                  <div>
                    <h3 className="font-sans font-bold text-xs uppercase text-[#ededed] tracking-wide">
                      Section 2: {selectedOp.name}'s Daily Checklist
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono">Review active tasks or insert new diagnostic workflows</p>
                  </div>
                </div>
              </div>

              {/* LIST OF CURRENT CHECKLIST ITEMS */}
              <div className="space-y-2.5 overflow-y-auto max-h-[180px] mb-4 pr-1">
                {operatorChecklist.map((task) => (
                  <div key={task.id} className="flex items-start justify-between bg-[#0a0a0a] p-3 rounded-lg border border-[#222]">
                    <div className="min-w-0 pr-2">
                      <span className="font-sans font-bold text-xs text-[#ededed] block">
                        {task.label}
                      </span>
                      <p className="text-[10px] text-[#888] font-mono leading-relaxed mt-0.5">
                        {task.desc}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteChecklistTask(task.id)}
                      className="p-1 hover:bg-zinc-900 border border-transparent hover:border-red-900/35 hover:text-red-400 rounded shrink-0 duration-200 cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {operatorChecklist.length === 0 && (
                  <div className="text-center py-10 text-zinc-650 italic text-xs font-mono">
                    "Daily compliance checklist template is empty"
                  </div>
                )}
              </div>

              {/* INSERT CHECKLIST ITEM FORM */}
              <div className="bg-[#0c0c0c] border border-[#222] p-3 rounded-xl space-y-3 mb-4">
                <span className="font-mono text-[10px] text-[#888] block uppercase tracking-wider font-bold">
                  ➕ Insert task in list
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input 
                    id="inp-checklist-label"
                    type="text" 
                    placeholder="Task summary/action (e.g., Vent spindle valve)" 
                    value={newChecklistLabel}
                    onChange={(e) => setNewChecklistLabel(e.target.value)}
                    className="bg-[#050505] border border-[#222] rounded p-2 text-[#ededed] text-xs focus:border-amber-500 focus:outline-none"
                  />
                  <input 
                    id="inp-checklist-desc"
                    type="text" 
                    placeholder="Brief description guide (e.g., Level check <= 2.5bar)" 
                    value={newChecklistDesc}
                    onChange={(e) => setNewChecklistDesc(e.target.value)}
                    className="bg-[#050505] border border-[#222] rounded p-2 text-[#ededed] text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  id="btn-insert-task"
                  onClick={handleInsertChecklistTask}
                  className="w-full py-1.5 bg-[#1a1a1a] border border-[#333] hover:border-amber-500 hover:text-amber-500 rounded text-[11px] font-sans font-bold uppercase transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Insert task in list
                </button>
              </div>
            </div>

            {/* SAVE ALL CHECKLIST CONFIGURATION */}
            <div className="border-t border-[#262626] pt-4 mt-auto">
              <button
                id="btn-save-checklist-config"
                onClick={handleSaveChecklist}
                disabled={checklistSaveLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-[#151515] text-black font-semibold text-xs font-sans rounded shadow flex justify-center items-center gap-1.5 cursor-pointer disabled:text-[#444]"
              >
                <Save className="w-4 h-4" />
                {checklistSaveLoading ? "Updating template..." : "Save checklist configuration"}
              </button>

              {checklistSaveSuccess && (
                <span className="text-[10px] text-emerald-400 block font-mono text-center mt-2.5 animate-pulse">
                  ✓ Daily compliance checklists saved successfully!
                </span>
              )}
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-20 border border-[#262626] border-dashed rounded-xl">
          <span className="text-sm italic text-zinc-650 font-sans">"Assign operator selection above to configure custom payloads"</span>
        </div>
      )}

      {/* --- POPUP UPLOAD MODAL --- */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleUploadDocument}
            className="w-full max-w-lg bg-[#111] border border-[#262626] rounded-xl p-5 shadow-2xl relative space-y-4"
          >
            <div className="border-b border-[#262626] pb-3 flex justify-between items-center">
              <span className="font-mono text-xs text-[#ededed] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-amber-500" />
                Upload Manual / Safety Guideline
              </span>
              <button 
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-zinc-500 hover:text-white font-mono text-xs cursor-pointer px-1"
              >
                ✖
              </button>
            </div>

            {/* THREE METHOD TAB TABS SELECTOR */}
            <div className="grid grid-cols-3 gap-1 bg-[#090909] p-1 border border-[#222] rounded-lg">
              <button
                type="button"
                onClick={() => { setUploadMethod('local'); setNewTitle(''); setNewContent(''); setNewFileName(''); setInternetUrl(''); }}
                className={`py-1.5 px-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded duration-150 cursor-pointer ${
                  uploadMethod === 'local'
                    ? 'bg-[#1a1a1a] text-amber-500 border border-[#333]'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                💾 File System
              </button>
              <button
                type="button"
                onClick={() => { setUploadMethod('internet'); setNewTitle(''); setNewContent(''); setNewFileName(''); setInternetUrl(''); }}
                className={`py-1.5 px-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded duration-150 cursor-pointer ${
                  uploadMethod === 'internet'
                    ? 'bg-[#1a1a1a] text-amber-500 border border-[#333]'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                🌐 Internet Link
              </button>
              <button
                type="button"
                onClick={() => { setUploadMethod('editor'); setNewTitle(''); setNewContent(''); setNewFileName(''); setInternetUrl(''); }}
                className={`py-1.5 px-2 text-[10px] font-mono uppercase tracking-wider font-bold rounded duration-150 cursor-pointer ${
                  uploadMethod === 'editor'
                    ? 'bg-[#1a1a1a] text-amber-500 border border-[#333]'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                ✍️ Write Text
              </button>
            </div>

            <div className="space-y-3.5">
              
              {/* IF LOCAL FILE SYSTEM SELECTED */}
              {uploadMethod === 'local' && (
                <div className="space-y-3">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileChangeHelper(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => document.getElementById('computer-file-picker')?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 ${
                      dragActive 
                        ? 'border-amber-500 bg-amber-500/5' 
                        : 'border-[#333] hover:border-zinc-500 bg-[#070707] hover:bg-[#0c0c0c]'
                    }`}
                  >
                    <input 
                      type="file" 
                      id="computer-file-picker"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChangeHelper(e.target.files[0]);
                        }
                      }}
                    />
                    <File className="w-8 h-8 text-[#555] mb-2" />
                    <span className="text-xs font-sans text-zinc-300 font-bold block">
                      Drag & Drop safety manual or click to select
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                      Supports .txt, .pdf, .md, .docx standard reference guides
                    </span>
                  </div>

                  {newFileName && (
                    <div className="bg-[#050505] border border-[#222] rounded-lg p-2.5 flex items-center justify-between text-left">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-mono uppercase text-zinc-500 font-bold block">Selected document:</span>
                        <span className="text-xs font-mono text-amber-400 block truncate">{newFileName}</span>
                      </div>
                      <span className="text-[9px] bg-amber-950/15 border border-amber-900/30 px-2 py-0.5 rounded font-mono text-amber-500 ml-2">
                        Ready
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* IF INTERNET LINK SELECTED */}
              {uploadMethod === 'internet' && (
                <div className="space-y-3.5">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold">Google Drive or External URL link</label>
                    <span className="text-[10px] text-zinc-500 font-sans leading-tight">Input Google Drive shared url, online manual web page, or cloud file reference storage below:</span>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-zinc-500">
                        <Globe className="w-4 h-4" />
                      </span>
                      <input 
                        id="modal-doc-url"
                        type="url" 
                        required
                        placeholder="https://drive.google.com/file/d/1gN_M8o.../view" 
                        value={internetUrl}
                        onChange={(e) => handleUrlChangeHelper(e.target.value)}
                        className="w-full bg-[#050505] border border-[#262626] rounded p-2.5 pl-9 text-white text-xs focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* COMMON REMAINING FIELDS (TITLE, FILENAME, AND WARNING PROCEDURAL DATA PREVIEW/MANUAL TEXT) */}
              {(uploadMethod === 'editor' || newFileName || internetUrl) && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold">Manual Title / System Head</label>
                    <input 
                      id="modal-doc-title"
                      type="text" 
                      required
                      placeholder="e.g., Venting procedure CNC-Axis" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="bg-[#050505] border border-[#262626] rounded p-2 text-white text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold">Reference File Designation</label>
                    <input 
                      id="modal-doc-filename"
                      type="text" 
                      placeholder="e.g., CNC300_manual_revision.pdf" 
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="bg-[#050505] border border-[#262626] rounded p-2 text-white text-xs focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] text-zinc-400 uppercase font-bold">
                      {uploadMethod === 'internet' ? "Index Metadata View" : "Diagnostic Warnings & Manual Guidelines Text"}
                    </label>
                    <textarea 
                      id="modal-doc-content"
                      required
                      rows={uploadMethod === 'internet' ? 4 : 5}
                      placeholder="Write clear instructions, safety alert thresholds, evacuation limits, valve vent references..." 
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="bg-[#050505] border border-[#262626] rounded p-2 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-[#262626]">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="flex-1 py-2 bg-[#1a1a1a] hover:bg-zinc-800 border border-[#262626] text-[#888] text-xs rounded uppercase font-sans cursor-pointer font-bold duration-150"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadLoading || !newTitle || !newContent}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-950 disabled:text-zinc-650 text-black text-xs font-sans font-black rounded uppercase flex items-center justify-center gap-1.5 cursor-pointer duration-150"
              >
                <UploadCloud className="w-4 h-4 shrink-0" />
                {uploadLoading ? "Linking..." : "Index & Link Feed"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
