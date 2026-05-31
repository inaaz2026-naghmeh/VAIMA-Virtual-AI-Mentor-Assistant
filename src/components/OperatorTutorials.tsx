import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, BookOpen, Clock, PlayCircle, History, 
  CheckCircle2, XCircle, ArrowRight, ArrowLeft, RefreshCw, 
  HelpCircle, Award, Check, FileText
} from 'lucide-react';
import { QuizQuestion, TutorialAttempt, DocumentMetadata } from '../types';

interface OperatorTutorialsProps {
  currentUserId: string;
  assignedTutorialDocIds?: string[];
  assignedDocumentIds?: string[];
  documents: DocumentMetadata[];
  tutorialAttempts: TutorialAttempt[];
  onNewAttemptSubmitted: () => void;
}

export default function OperatorTutorials({
  currentUserId,
  assignedTutorialDocIds = [],
  assignedDocumentIds = [],
  documents,
  tutorialAttempts,
  onNewAttemptSubmitted
}: OperatorTutorialsProps) {
  // Active test state
  const [activeTest, setActiveTest] = useState<{
    title: string;
    questions: QuizQuestion[];
  } | null>(null);

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]); // matching indices of questions
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Completed Test review modal state
  const [reviewAttempt, setReviewAttempt] = useState<TutorialAttempt | null>(null);

  // Seconds counter for active training timer
  const [activeTimerSeconds, setActiveTimerSeconds] = useState(0);
  const [timerIntervalId, setTimerIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Define available materials for user selection
  const assignedSources = documents.filter(doc => 
    (assignedTutorialDocIds || []).includes(doc.id) || 
    (assignedDocumentIds || []).includes(doc.id) ||
    (doc.targetOperatorId === currentUserId)
  );

  const availableMaterials = assignedSources.length > 0 
    ? assignedSources 
    : documents.filter(doc => doc.accessLevel === 'OPERATOR');

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedMaterialIds(availableMaterials.map(doc => doc.id));
  }, [assignedTutorialDocIds, assignedDocumentIds, documents]);

  const handleToggleMaterial = (docId: string) => {
    setSelectedMaterialIds(prev => 
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  // Filter history of this operator
  const myAttempts = tutorialAttempts
    .filter(att => att.userId === currentUserId)
    .sort((a, b) => b.testNumber - a.testNumber); // newest first

  // Start active timer when active test begins
  useEffect(() => {
    if (activeTest) {
      setActiveTimerSeconds(0);
      const interval = setInterval(() => {
        setActiveTimerSeconds(prev => prev + 1);
      }, 1000);
      setTimerIntervalId(interval);
    } else {
      if (timerIntervalId) {
        clearInterval(timerIntervalId);
        setTimerIntervalId(null);
      }
    }
    return () => {
      if (timerIntervalId) clearInterval(timerIntervalId);
    };
  }, [activeTest]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle starting a practice test
  const handleStartPracticeTest = async () => {
    if (selectedMaterialIds.length === 0) {
      alert("Please select at least one material to take the quiz.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/tutorials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUserId,
          selectedMaterialIds: selectedMaterialIds
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTest({
          title: data.title,
          questions: data.questions
        });
        setCurrentQuestionIdx(0);
        // Initialize 20 empty answers (-1)
        setSelectedAnswers(new Array(data.questions.length).fill(-1));
      } else {
        alert("Failed to initialize training pipeline.");
      }
    } catch (e) {
      console.error(e);
      alert("Error contacting the training compilation server.");
    } finally {
      setGenerating(false);
    }
  };

  // Handle selecting an option
  const handleSelectOption = (optionIdx: number) => {
    setSelectedAnswers(prev => {
      const copy = [...prev];
      copy[currentQuestionIdx] = optionIdx;
      return copy;
    });
  };

  // Calculate score and submit
  const handleSubmitTest = async () => {
    if (!activeTest) return;

    // Check if any question remains unanswered
    const unansweredCount = selectedAnswers.filter(ans => ans === -1).length;
    if (unansweredCount > 0) {
      if (!window.confirm(`Warning: You have left ${unansweredCount} questions unanswered. Are you sure you want to finish and grade the test?`)) {
        return;
      }
    }

    setSubmitting(true);
    let finalScore = 0;
    activeTest.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctOption) {
        finalScore += 1;
      }
    });

    try {
      const res = await fetch('/api/tutorials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          score: finalScore,
          total: activeTest.questions.length,
          questions: activeTest.questions,
          selectedAnswers: selectedAnswers
        })
      });

      if (res.ok) {
        const data = await res.json();
        onNewAttemptSubmitted();
        // Clear active test state, and immediately show the submitted test as review!
        setActiveTest(null);
        setReviewAttempt(data.attempt);
      } else {
        alert("Compliance interface failed to log score.");
      }
    } catch (e) {
      console.error(e);
      alert("Connection error: could not submit score.");
    } finally {
      setSubmitting(false);
    }
  };

  const getPercentageColor = (score: number, total: number) => {
    const ratio = score / total;
    if (ratio >= 0.85) return 'text-emerald-400 bg-emerald-950/20 border-emerald-900/40';
    if (ratio >= 0.70) return 'text-amber-400 bg-amber-950/20 border-amber-900/40';
    return 'text-rose-400 bg-rose-950/20 border-rose-900/40';
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TUTORIAL ACTIVE PRACTICE ENVIRONMENT SCREEN */}
      {activeTest ? (
        <div className="bg-[#111] border border-[#262626] rounded-xl overflow-hidden shadow-2xl">
          {/* Header Bar */}
          <div className="bg-[#161616] px-5 py-4 border-b border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
                <GraduationCap className="text-amber-500 w-4 h-4 animate-bounce" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-sm text-[#ededed] leading-none">
                  {activeTest.title}
                </h3>
                <p className="text-[10px] font-mono text-[#888] mt-1">
                  Compliance Practice Suite • 20 Questions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Dynamic running timer */}
              <div className="flex items-center gap-1.5 font-mono text-xs text-amber-500 bg-amber-500/5 px-2.5 py-1 rounded border border-amber-500/10">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTimer(activeTimerSeconds)}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Abandon current test? Progress will not be logged.")) {
                    setActiveTest(null);
                  }
                }}
                className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 hover:text-white px-2 py-1 rounded border border-[#262626] hover:bg-neutral-900 cursor-pointer"
              >
                Quit Test
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-neutral-900 h-1.5 w-full">
            <div 
              className="bg-amber-500 h-1.5 transition-all duration-300"
              style={{ width: `${((currentQuestionIdx + 1) / activeTest.questions.length) * 100}%` }}
            />
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs uppercase tracking-wider text-[#888]">
                Question <strong className="text-amber-500">{currentQuestionIdx + 1}</strong> of <strong className="text-white">{activeTest.questions.length}</strong>
              </span>
              <span className="text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                Weight: {(100 / activeTest.questions.length).toFixed(1)}% each
              </span>
            </div>

            {/* Question Statement */}
            <div className="mb-6 bg-black/40 border border-[#202020] rounded-xl p-5">
              <p className="font-sans font-medium text-[14px] text-[#ededed] leading-relaxed">
                {activeTest.questions[currentQuestionIdx]?.question}
              </p>
            </div>

            {/* Select Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-8">
              {activeTest.questions[currentQuestionIdx]?.options.map((option, idx) => {
                const isSelected = selectedAnswers[currentQuestionIdx] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative group flex items-start gap-3 ${
                      isSelected 
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-medium'
                        : 'bg-[#090909] border-[#222] text-[#888] hover:bg-[#111] hover:text-[#ededed] hover:border-zinc-750'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center font-mono text-[10px] border ${
                      isSelected 
                        ? 'bg-amber-500 border-amber-500 text-black font-extrabold'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="text-xs leading-tight py-0.5">{option}</span>
                  </button>
                );
              })}
            </div>

            {/* Navigation and Submission actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#222]">
              <button
                type="button"
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx(prev => prev - 1)}
                className="px-4 py-2 text-xs font-mono font-bold uppercase text-zinc-400 hover:text-white hover:bg-zinc-900 disabled:text-zinc-700 disabled:hover:bg-transparent border border-[#222] disabled:border-[#151515] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous Question
              </button>

              {currentQuestionIdx < activeTest.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
                  className="px-4.5 py-2 text-xs font-mono font-bold uppercase bg-neutral-900 hover:bg-neutral-800 text-white border border-[#333] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                >
                  Next Question
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitTest}
                  disabled={submitting}
                  className="px-6 py-2.5 text-xs font-mono font-extrabold uppercase bg-amber-500 hover:bg-amber-450 text-black rounded-lg shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer ml-auto border-none"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Grading Submission...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      Submit & Complete Test
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (

        /* 2. MAIN TUTORIALS ENTRANCE VIEW: START LAB & SCORECARD HISTORY */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Assigned Source Material Preview & Start Trigger */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />

              <div className="border-b border-[#262626] pb-3 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-500" />
                <h4 className="font-mono text-2xs text-[#ededed] uppercase font-bold tracking-wider">
                  Target Material Config
                </h4>
              </div>

              <p className="text-[11.5px] text-[#888] font-sans leading-relaxed mb-4">
                Select from the materials assigned by your supervisor or manager to focus the training quiz questions:
              </p>

              {availableMaterials.length === 0 ? (
                <div className="p-3.5 rounded-lg bg-black/40 border border-[#202020] space-y-2 mb-6 text-center">
                  <span className="text-[10px] font-mono text-zinc-400 bg-[#161616] px-2 py-0.5 rounded border border-[#222]">
                    No Materials Available
                  </span>
                  <p className="text-[10px] text-zinc-500 font-sans leading-tight">
                    No operator-facing manuals or supervisor training assignments found.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 mb-6 limit-height max-h-[260px] overflow-y-auto pr-1">
                  {availableMaterials.map(doc => {
                    const isSelected = selectedMaterialIds.includes(doc.id);
                    return (
                      <div 
                        key={doc.id} 
                        onClick={() => handleToggleMaterial(doc.id)}
                        className={`p-3 rounded-lg border transition-all flex items-start gap-2.5 cursor-pointer select-none ${
                          isSelected 
                            ? 'bg-amber-500/10 border-amber-500/50' 
                            : 'bg-black/20 border-[#202020] hover:border-[#333]'
                        }`}
                      >
                        <div className="pt-0.5">
                          <input 
                            id={`check-material-${doc.id}`}
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}} // toggled via wrapper div click
                            className="accent-amber-500 cursor-pointer"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className={`font-sans font-semibold text-xs truncate ${
                            isSelected ? 'text-amber-400' : 'text-[#ededed]'
                          }`}>
                            {doc.title}
                          </h5>
                          <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-500 mt-1">
                            <span>{doc.fileName}</span>
                            <span>•</span>
                            <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                id="btn-start-tutorial"
                onClick={handleStartPracticeTest}
                disabled={generating}
                className="w-full py-3 bg-amber-500 hover:bg-amber-450 disabled:bg-zinc-800 text-black disabled:text-zinc-500 font-mono text-xs font-extrabold rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md shadow-amber-500/10 active:scale-[0.98]"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generating 20 questions...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5" />
                    Start 20-Question Practice Test
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Historical Attempts Scorecard Log */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl">
              
              <div className="border-b border-[#262626] pb-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4 text-amber-500" />
                  <div>
                    <h4 className="font-sans font-bold text-xs text-[#ededed]">
                      Practice Log & Compliance Scores History
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                      Review previous training quizzes taken by you. Click any attempt to inspect chosen answers and system citations.
                    </p>
                  </div>
                </div>

                <span className="font-mono text-[10px] text-zinc-500 bg-zinc-800/40 px-2.5 py-1 rounded border border-zinc-700/30">
                  Total Tests: {myAttempts.length}
                </span>
              </div>

              {myAttempts.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#202020] rounded-xl p-6 bg-black/10">
                  <Award className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
                  <p className="text-xs text-zinc-500 font-sans italic">
                    "No tutorial diagnostics filed. Take your first 20-question practice test above."
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {myAttempts.map((attempt) => {
                    const ratio = attempt.score / attempt.total;
                    const isPassed = ratio >= 0.70;
                    return (
                      <div 
                        key={attempt.id}
                        onClick={() => setReviewAttempt(attempt)}
                        className="p-3.5 rounded-xl border border-[#202020] bg-black/20 hover:bg-[#151515] transition-all flex items-center justify-between gap-4 cursor-pointer hover:border-amber-500/45 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-mono text-xs font-bold ${getPercentageColor(attempt.score, attempt.total)}`}>
                            {Math.round(ratio * 100)}%
                          </div>
                          <div>
                            <h5 className="font-sans font-bold text-xs text-[#ededed] group-hover:text-amber-500 transition-colors">
                              Tutorial Quiz Practice #{attempt.testNumber}
                            </h5>
                            <p className="text-[10px] text-zinc-500 font-sans mt-1">
                              Completed on {new Date(attempt.createdAt).toLocaleDateString()} {new Date(attempt.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-mono text-xs font-extrabold text-[#ededed] block">
                              {attempt.score} / {attempt.total}
                            </span>
                            <span className={`text-[9px] font-mono uppercase tracking-wider font-bold block mt-0.5 ${
                              isPassed ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                              {isPassed ? 'PASSED' : 'RE-TRY REQ'}
                            </span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-650 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 3. INSTRUCTIVE COMPREHENSIVE ATTEMPT REVIEW MODAL / DRAWER PANEL */}
      {reviewAttempt && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-hidden">
          <div className="bg-[#0f0f0f] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#222] bg-[#161616] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center font-mono text-[#dedede] leading-none text-md font-extrabold ${getPercentageColor(reviewAttempt.score, reviewAttempt.total)}`}>
                  {Math.round((reviewAttempt.score / reviewAttempt.total) * 100)}%
                </div>
                <div>
                  <h4 className="font-sans font-extrabold text-[#ededed] text-sm">
                    In-depth Test Review: Practice #{reviewAttempt.testNumber}
                  </h4>
                  <p className="text-[10px] font-mono text-[#888] mt-1">
                    Logged diagnostics: {reviewAttempt.score} of {reviewAttempt.total} answered correct on {new Date(reviewAttempt.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewAttempt(null)}
                className="px-3 py-1.5 rounded-lg border border-[#333] hover:border-zinc-500 uppercase tracking-widest text-zinc-400 hover:text-white font-mono text-[10px] transition-all cursor-pointer bg-neutral-900"
              >
                Close Review
              </button>
            </div>

            {/* Questions list Container */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#0b0b0b]">
              
              <div className="p-3.5 bg-amber-500/5 border border-amber-900/30 rounded-xl flex items-start gap-2.5">
                <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-zinc-400 font-sans leading-relaxed">
                  Review the correct answer citations and explanation blocks below. Incorrect selections are highlighted in <span className="text-rose-400 font-semibold">red</span>, and correct operating manual selections in <span className="text-emerald-400 font-semibold">green</span>.
                </p>
              </div>

              {reviewAttempt.questions.map((q, qIndex) => {
                const userSelected = reviewAttempt.selectedAnswers[qIndex];
                const isCorrect = userSelected === q.correctOption;
                
                return (
                  <div 
                    key={q.id}
                    className={`p-5 rounded-xl border transition-all ${
                      isCorrect 
                        ? 'border-emerald-900/30 bg-emerald-950/2' 
                        : 'border-rose-900/30 bg-rose-950/2'
                    }`}
                  >
                    {/* Header line */}
                    <div className="flex items-start gap-2.5 justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-zinc-500">
                          Question #{qIndex + 1}
                        </span>
                        {isCorrect ? (
                          <span className="text-[9px] font-mono bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 px-1.5 py-0.2 rounded uppercase font-bold">
                            Correct
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono bg-rose-950/40 border border-rose-900/40 text-rose-400 px-1.5 py-0.2 rounded uppercase font-bold">
                            Mismatch
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question */}
                    <p className="font-sans font-medium text-xs text-[#ededed] mt-2 mb-4 leading-normal">
                      {q.question}
                    </p>

                    {/* Options list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
                      {q.options.map((opt, optIndex) => {
                        const isCorrectOption = optIndex === q.correctOption;
                        const isSelectedByOperator = optIndex === userSelected;
                        
                        let optStyle = 'border-transparent bg-zinc-900/40 text-zinc-400';
                        let badgeIcon = null;

                        if (isCorrectOption) {
                          optStyle = 'border-emerald-900 text-emerald-300 bg-emerald-950/20';
                          badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
                        } else if (isSelectedByOperator) {
                          optStyle = 'border-rose-950 text-rose-300 bg-rose-950/20';
                          badgeIcon = <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
                        }

                        return (
                          <div 
                            key={optIndex} 
                            className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${optStyle}`}
                          >
                            <span className="leading-tight">{opt}</span>
                            {badgeIcon}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation details citing guidelines */}
                    <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                      <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest block font-bold">
                        CITED EXPLANATION / SAFETY LIMITS:
                      </span>
                      <p className="text-[10.5px] text-zinc-300 font-sans mt-0.5 leading-relaxed">
                        {q.explanation}
                      </p>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#222] bg-[#161616] flex items-center justify-between shrink-0">
              <span className="text-[10.5px] font-mono text-[#888]">
                VAIMA compliance system verification logs active
              </span>
              <button
                type="button"
                onClick={() => setReviewAttempt(null)}
                className="px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-sans text-xs font-bold transition-all cursor-pointer border-none"
              >
                Close and Return to Dashboard
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
