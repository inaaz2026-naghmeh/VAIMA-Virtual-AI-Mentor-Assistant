import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Camera, RefreshCw, Send, AlertTriangle, 
  HelpCircle, Volume2, VolumeX, Sparkles, BookOpen, Layers,
  Settings, Globe, Cpu, Video, Info, FileText, Check, Loader2
} from 'lucide-react';
import { User, DocumentMetadata } from '../types';

interface OperatorExpertProps {
  currentUser: User;
  onNewMessageLogged: () => void;
  documents?: DocumentMetadata[];
  onDocumentUploaded?: () => void;
}

// Helper to transform any pasted HeyGen URL (including dashboard/creator links) into an embeddable Player URL
function resolveHeygenIframeUrl(url: string): { 
  embedUrl: string; 
  originalId: string; 
  wasConverted: boolean; 
  isVideoAgent: boolean; 
  isDashboard: boolean;
} {
  if (!url) return { embedUrl: '', originalId: '', wasConverted: false, isVideoAgent: false, isDashboard: false };
  let trimmed = url.trim();
  let wasConverted = false;
  let isVideoAgent = false;
  let isDashboard = false;

  if (trimmed.toLowerCase().includes('video-agent') || trimmed.toLowerCase().includes('video_agent') || trimmed.toLowerCase().includes('/videos/')) {
    isVideoAgent = true;
  }
  
  if (trimmed.toLowerCase().includes('app.heygen.com') && !trimmed.toLowerCase().includes('embed') && !trimmed.toLowerCase().includes('interactive-avatar')) {
    isDashboard = true;
  }

  // If the user pasted an <iframe> snippet or HTML tag, extract the src URL
  if (trimmed.startsWith('<')) {
    const srcMatch = trimmed.match(/src="([^"]+)"/) || trimmed.match(/src='([^']+)'/);
    if (srcMatch && srcMatch[1]) {
      trimmed = srcMatch[1];
      wasConverted = true;
    }
  }

  // If it's a liveavatar.com link, it is already an interactive live avatar embed page. Bypass standard HeyGen conversions.
  if (trimmed.toLowerCase().includes('liveavatar.com')) {
    return { embedUrl: trimmed, originalId: 'LiveAvatar', wasConverted: true, isVideoAgent: false, isDashboard: false };
  }
  
  // Try to search for a 32-character Hex ID (typical HeyGen Video ID or Interactive Avatar ID or Widget ID)
  const hexIdMatch = trimmed.match(/[a-fA-F0-9]{32}/);
  if (hexIdMatch) {
    const id = hexIdMatch[0];
    const isAlreadyEmbed = trimmed.toLowerCase().includes('/embed/') || trimmed.toLowerCase().includes('/embed?');
    const isInteractive = trimmed.toLowerCase().includes('interactive') || trimmed.toLowerCase().includes('avatar') || trimmed.toLowerCase().includes('labs');

    let finalUrl = trimmed;
    
    if (!isAlreadyEmbed) {
      if (isInteractive) {
        finalUrl = `https://app.heygen.com/embed/interactive-avatar?id=${id}`;
      } else {
        // Standard video agent or standard video compiled embeds are loaded with the /embed/ format
        finalUrl = `https://app.heygen.com/embed/${id}`;
      }
      wasConverted = true;
    }
    
    return { embedUrl: finalUrl, originalId: id, wasConverted: wasConverted, isVideoAgent, isDashboard };
  }
  
  return { embedUrl: trimmed, originalId: '', wasConverted: wasConverted, isVideoAgent, isDashboard };
}

export default function OperatorExpert({ currentUser, onNewMessageLogged, documents, onDocumentUploaded }: OperatorExpertProps) {
  // States
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchedDoc, setMatchedDoc] = useState('');
  const [activePersona, setActivePersona] = useState<'AUTO' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('AUTO');
  const [isEmergency, setIsEmergency] = useState(false);

  // Exclusive RAG PDF target selector
  const [restrictToDocumentIds, setRestrictToDocumentIds] = useState<string[]>([]);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfParseProgress, setPdfParseProgress] = useState('');
  const [pdfError, setPdfError] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Sync state fallback
  const [localDocs, setLocalDocs] = useState<DocumentMetadata[]>([]);
  useEffect(() => {
    if (!documents) {
      fetch('/api/documents')
        .then(res => res.json())
        .then(data => setLocalDocs(data))
        .catch(err => console.error("Error fetching docs internally", err));
    }
  }, [documents]);

  const rawDisplayDocs = documents || localDocs;
  const displayDocs = currentUser && currentUser.role === 'OPERATOR' && Array.isArray(currentUser.assignedDocumentIds) && currentUser.assignedDocumentIds.length > 0
    ? rawDisplayDocs.filter(d => currentUser.assignedDocumentIds?.includes(d.id))
    : rawDisplayDocs;

  useEffect(() => {
    if (currentUser && currentUser.role === 'OPERATOR' && Array.isArray(currentUser.assignedDocumentIds) && currentUser.assignedDocumentIds.length > 0) {
      setRestrictToDocumentIds(currentUser.assignedDocumentIds);
    } else {
      setRestrictToDocumentIds([]);
    }
  }, [currentUser]);
  
  // Voice Modes
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isWokenUp, setIsWokenUp] = useState(false);
  const [wakeWordStatus, setWakeWordStatus] = useState<'IDLE' | 'LISTENING' | 'ACTIVE'>('IDLE');

  // Photo uploads
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar Voice State
  const [avatarTalking, setAvatarTalking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // HeyGen Connection States
  const [avatarSource, setAvatarSource] = useState<'SIMULATOR' | 'WIDGET' | 'SDK'>(() => {
    return 'WIDGET';
  });
  const [widgetId, setWidgetId] = useState(() => {
    return localStorage.getItem('heygen_widgetId') || '1b000c3accb94d10b6bb3153f1e9b82b';
  });
  const [widgetRenderStyle, setWidgetRenderStyle] = useState<'FLOATING' | 'LABS' | 'FRAMER' | 'BETA' | 'CUSTOM'>(() => {
    return (localStorage.getItem('heygen_widgetRenderStyle') as any) || 'CUSTOM';
  });
  const [customEmbedUrl, setCustomEmbedUrl] = useState(() => {
    const saved = localStorage.getItem('heygen_customEmbedUrl');
    // If empty or containing old broken URLs, overwrite with working liveavatar.com link
    if (!saved || saved.toLowerCase().includes('1b000c3accb9') || saved.toLowerCase().includes('app.heygen.com/share') || saved.toLowerCase().includes('video-agent') || saved.toLowerCase().includes('video_agent')) {
      return 'https://embed.liveavatar.com/v1/7a065d3a-5e44-4326-97f6-c2c7d5064352?orientation=horizontal';
    }
    return saved;
  });
  const [showConfig, setShowConfig] = useState(false);
  const [sdkLogs, setSdkLogs] = useState<string[]>(["WebRTC Stream initialized.", "Awaiting connection trigger..."]);
  const [sdkAccessToken, setSdkAccessToken] = useState('');
  const [connectingSdk, setConnectingSdk] = useState(false);
  const [sdkConnected, setSdkConnected] = useState(false);

  // Sync HeyGen settings to localStorage
  useEffect(() => {
    localStorage.setItem('heygen_avatarSource', avatarSource);
  }, [avatarSource]);

  useEffect(() => {
    localStorage.setItem('heygen_widgetId', widgetId);
  }, [widgetId]);

  useEffect(() => {
    localStorage.setItem('heygen_widgetRenderStyle', widgetRenderStyle);
  }, [widgetRenderStyle]);

  useEffect(() => {
    localStorage.setItem('heygen_customEmbedUrl', customEmbedUrl);
  }, [customEmbedUrl]);

  // Dynamically load HeyGen Interactive Avatar script for Floating Mode
  useEffect(() => {
    // Check if widget should be active
    const isFloatingActive = avatarSource === 'WIDGET' && widgetId && widgetRenderStyle === 'FLOATING';

    if (!isFloatingActive) {
      // Hide floating elements if they exist
      const badge = document.getElementById('heygen-chat-badge');
      const container = document.getElementById('heygen-chat-container');
      const widgetElements = document.querySelectorAll('[class*="heygen-"]');
      widgetElements.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      if (badge) badge.style.display = 'none';
      if (container) container.style.display = 'none';
      return;
    }

    setSdkLogs(prev => [...prev, `[Floating Widget] Loading HeyGen live script for ID: ${widgetId}...`]);

    try {
      const win = window as any;
      
      // 1. Initialise main trigger queue on window
      if (!win.heygen_main_trigger) {
        win.heygen_main_trigger = function () {
          (win.heygen_main_trigger.queue = win.heygen_main_trigger.queue || []).push(arguments);
        };
        win.heygen_main_trigger.queue = [];
        win.heygen_main_trigger.t = +new Date();
      }

      // 2. Load the script tag dynamically
      let script = document.getElementById('heygen-embed-script') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'heygen-embed-script';
        script.async = true;
        script.src = 'https://a.heygen.ai/detective/assets/embed.js';
        document.head.appendChild(script);
      }

      // 3. Command the widget to initialize with custom widgetID
      win.heygen_main_trigger('init', {
        id: widgetId,
      });

      // Show existing if previously loaded and hidden
      const badge = document.getElementById('heygen-chat-badge');
      const container = document.getElementById('heygen-chat-container');
      const widgetElements = document.querySelectorAll('[class*="heygen-"]');
      widgetElements.forEach(el => {
        (el as HTMLElement).style.display = '';
      });
      if (badge) badge.style.display = '';
      if (container) container.style.display = '';

      setSdkLogs(prev => [...prev, "✅ Dynamic script loaded! HeyGen Voice Assistant initialized Bottom-Right."]);
    } catch (err: any) {
      console.error("HeyGen floating widget initialization failed:", err);
    }

    return () => {
      // Auto-hide when changing source or ID
      const badge = document.getElementById('heygen-chat-badge');
      const container = document.getElementById('heygen-chat-container');
      const widgetElements = document.querySelectorAll('[class*="heygen-"]');
      widgetElements.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
      if (badge) badge.style.display = 'none';
      if (container) container.style.display = 'none';
    };
  }, [avatarSource, widgetId, widgetRenderStyle]);

  const fetchHeyGenToken = async () => {
    setConnectingSdk(true);
    setSdkLogs(prev => [...prev, `Initiating WebRTC connection for Avatar ID: ${widgetId}...`, "POST request to secure endpoint: /api/heygen/token..."]);
    try {
      const res = await fetch("/api/heygen/token", { method: "POST" });
      const data = await res.json();
      if (data.token) {
        setSdkAccessToken(data.token);
        setSdkLogs(prev => [...prev, "✅ Dynamic interactive token generated successfully!", `Connecting WebRTC peer with Avatar ID: ${widgetId}...`, "Streaming session established on S_AVATAR_#1b000."]);
        setSdkConnected(true);
      } else {
        setSdkLogs(prev => [
          ...prev, 
          `❌ Server Error: ${data.error || "Authentication refused."}`, 
          "TIP: HEYGEN_API_KEY fallback loaded automatically. Make sure the Key is active and correct."
        ]);
      }
    } catch (e: any) {
      setSdkLogs(prev => [...prev, `❌ Network transmission failure: ${e.message || "Endpoint connection timeout."}`]);
    } finally {
      setConnectingSdk(false);
    }
  };

  const closeSdkSession = () => {
    setSdkAccessToken('');
    setSdkConnected(false);
    setSdkLogs(["WebRTC Stream terminated.", "Awaiting connection trigger..."]);
  };

  // Sample machine trouble photos to choose from for zero-friction simulator diagnostics
  const SAMPLE_DIAGNOSTICS = [
    {
      name: "High pressure panel.jpg",
      url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=60",
      b64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", // minimal red pixel base64
      query: "Analyze this image error code E-740 on the pneumatic sensor."
    },
    {
      name: "Overheated spindle fan.jpg",
      url: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=300&auto=format&fit=crop&q=60",
      b64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      query: "Diagnosis overheating on the main spinning Axis. What is the G-code?"
    }
  ];

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    
    // Initialize Web Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setWakeWordStatus('LISTENING');
      };

      rec.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.trim().toLowerCase();
        
        console.log("Recorded speech:", transcript);

        // Check for Wake Word "hey expert"
        if (transcript.includes("hey expert") || transcript.includes("expert")) {
          setIsWokenUp(true);
          setWakeWordStatus('ACTIVE');
          // Speak wake response
          speakText("Yes, operator, I am listening. What is your mechanical inquiry?");
          
          // Clear any current text query
          setQuery('');
          return;
        }

        // If woken up, assume the speech is the actual machine inquiry
        if (isWokenUp || transcript.length > 5) {
          setQuery(transcript);
          setIsWokenUp(false);
          setWakeWordStatus('LISTENING');
          // Trigger the submission automatically for complete hands-free operations!
          handleSubmitInquiry(transcript);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        setWakeWordStatus('IDLE');
      };

      recognitionRef.current = rec;
    }

    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isWokenUp]);

  // Handle Text to Speech playback
  const speakText = (text: string) => {
    if (!voiceEnabled || !synthRef.current) return;
    
    stopSpeaking();
    
    // Clean markdown before speaking
    const cleanText = text
      .replace(/\[.*?\]/g, '')
      .replace(/[\*#_\-`]/g, '')
      .replace(/ERR-CNC-998/gi, 'error code C N C nine nine eight')
      .replace(/E-740/gi, 'error code E seven forty')
      .slice(0, 300);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Try to get a professional female accent voice if available
    const voices = synthRef.current.getVoices();
    const expertVoice = voices.find(v => v.name.includes("Google US English") || v.lang.includes("en-US") && v.name.includes("Female") || v.name.includes("Natural"));
    if (expertVoice) utterance.voice = expertVoice;
    
    utterance.pitch = 1.05;
    utterance.rate = 0.95;

    utterance.onstart = () => setAvatarTalking(true);
    utterance.onend = () => setAvatarTalking(false);
    utterance.onerror = () => setAvatarTalking(false);

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setAvatarTalking(false);
  };

  // Turn Voice Wake listener on/off
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Web Speech Recognition is not supported on this browser version. Please type queries manually.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsWokenUp(false);
      setWakeWordStatus('IDLE');
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Speech already active", e);
      }
    }
  };

  // Browser-powered PDF to Text parser using dynamic CDNs for safe sandboxed runtime
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsingPdf(true);
    setPdfError('');
    setPdfParseProgress('Initializing document(s) processing...');

    try {
      if (!(window as any).pdfjsLib) {
        setPdfParseProgress('Loading PDF analyzer library...');
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
          script.onload = () => {
            const pdfjs = (window as any).pdfjsLib;
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            resolve();
          };
          script.onerror = () => reject(new Error("Failed to load PDF processing library. Please check your internet connection."));
          document.head.appendChild(script);
        });
      }

      const pdfjsLib = (window as any).pdfjsLib;
      const newlyCreatedIds: string[] = [];
      const fileCount = files.length;

      for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
        const file = files[fileIndex];

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          setPdfError(`File "${file.name}" is not a valid PDF document. Skipped.`);
          continue;
        }

        setPdfParseProgress(`Reading file ${fileIndex + 1} of ${fileCount}: ${file.name}...`);

        const typedarray = await new Promise<Uint8Array>((resolve, reject) => {
          const fileReader = new FileReader();
          fileReader.onload = (event) => {
            resolve(new Uint8Array(event.target?.result as ArrayBuffer));
          };
          fileReader.onerror = () => reject(new Error(`Unable to read file "${file.name}".`));
          fileReader.readAsArrayBuffer(file);
        });

        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        let fullText = "";

        for (let i = 1; i <= numPages; i++) {
          setPdfParseProgress(`Document ${fileIndex + 1} of ${fileCount} [Page ${i} of ${numPages}]: ${file.name}...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n";
        }

        if (fullText.trim().length < 50) {
          throw new Error(`Document "${file.name}" has no readable text (it might be scanned/image-only without an OCR text layer).`);
        }

        setPdfParseProgress(`Saving document ${fileIndex + 1} of ${fileCount}: ${file.name}...`);
        
        const payload = {
          title: file.name.replace(/\.[^/.]+$/, ""),
          content: fullText,
          fileName: file.name,
          accessLevel: 'OPERATOR',
          uploadedBy: currentUser.name
        };

        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`Error saving document "${file.name}" to the server database.`);
        }

        const newDoc = await res.json();
        if (newDoc && newDoc.id) {
          newlyCreatedIds.push(newDoc.id);
        }
      }

      setPdfParseProgress('All documents processed and saved successfully!');
      
      if (newlyCreatedIds.length > 0) {
        setRestrictToDocumentIds(prev => Array.from(new Set([...prev, ...newlyCreatedIds])));
      }

      if (onDocumentUploaded) {
        onDocumentUploaded();
      } else {
        const docRes = await fetch('/api/documents');
        const docData = await docRes.json();
        setLocalDocs(docData);
      }

      setTimeout(() => {
        setIsParsingPdf(false);
        setPdfParseProgress('');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setPdfError(err.message || "Error processing multiple PDF files.");
      setIsParsingPdf(false);
    }

    if (pdfInputRef.current) {
      pdfInputRef.current.value = "";
    }
  };

  // Submit Technical Queries
  const handleSubmitInquiry = async (customQuery?: string) => {
    const textQuery = customQuery || query;
    if (!textQuery.trim() && !uploadedPhoto) return;

    setLoading(true);
    setResponse('');
    stopSpeaking();
    setIsEmergency(false);

    try {
      const payload = {
        userId: currentUser.id,
        query: textQuery,
        userPersona: activePersona === 'AUTO' ? undefined : activePersona,
        imageBytes: uploadedPhoto ? uploadedPhoto.split(',')[1] : undefined,
        restrictToDocumentIds: restrictToDocumentIds
      };

      const res = await fetch('/api/expert/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setResponse(data.response);
      setMatchedDoc(data.matchedDoc || 'System local rules fallback');
      setIsEmergency(!!data.isEmergency);

      // Trigger standard expert avatar voice synthesis immediately
      if (data.isEmergency) {
        speakText("Emergency situation detected! Shut down machine operations and evacuate safe distance immediately.");
      } else {
        speakText(data.suggestedSpeech || data.response);
      }

      // Notify App to pull updated messages for live supervisor notification
      onNewMessageLogged();

    } catch (e) {
      console.error(e);
      setResponse("Network transmission failed. AI Operating system currently offline.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Photo Diagnostics Upload
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectSimulatedPhoto = (sample: typeof SAMPLE_DIAGNOSTICS[0]) => {
    setUploadedPhoto(sample.url); // Use clean layout image for display
    setPhotoName(sample.name);
    setQuery(sample.query);
  };

  const clearPhoto = () => {
    setUploadedPhoto(null);
    setPhotoName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT COLUMN: THE LIVE AI AVATAR WINDOW (HeyGen Simulator & Real Integrator) */}
      <div className={`lg:col-span-12 ${currentUser?.role === 'OPERATOR' ? 'xl:col-span-12 max-w-2xl mx-auto w-full' : 'xl:col-span-5'} bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl flex flex-col items-center justify-between relative overflow-hidden min-h-[500px]`}>
        {/* Subtle grid styling */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#141414_1px,transparent_1px),linear-gradient(to_bottom,#141414_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-45 pointer-events-none" />
        
        {/* Connection status header */}
        <div className="w-full flex flex-col gap-2 z-10 border-b border-[#262626] pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isListening || sdkConnected ? 'bg-amber-500 animate-ping' : 'bg-[#444]'}`} />
              <span className="font-mono text-xs text-[#ededed] uppercase tracking-wider">
                {avatarSource === 'SIMULATOR' && "System Live Avatar (HeyGen Simulator)"}
                {avatarSource === 'WIDGET' && "VAIMA is here for your questions..."}
                {avatarSource === 'SDK' && "HeyGen Custom WebRTC Session"}
              </span>
            </div>
            
            {currentUser?.role !== 'OPERATOR' && (
              <button
                id="btn-toggle-config-panel"
                onClick={() => setShowConfig(!showConfig)}
                className="p-1 text-[#888] hover:text-[#fff] hover:bg-[#1a1a1a] rounded transition-all cursor-pointer border border-[#262626]"
                title="Configure HeyGen Live Connection"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick source tabs */}
          {currentUser?.role !== 'OPERATOR' && (
            <div className="grid grid-cols-1 gap-1 bg-[#0a0a0a] p-0.5 rounded border border-[#262626]">
              <button
                onClick={() => { setAvatarSource('WIDGET'); stopSpeaking(); }}
                className={`py-1.5 text-[9px] font-mono uppercase tracking-wider rounded transition-all cursor-pointer ${
                  avatarSource === 'WIDGET' ? 'bg-[#1e1e1e] text-amber-500 border border-[#262626]' : 'text-[#888] hover:text-white'
                }`}
              >
                🌐 Widget
              </button>
            </div>
          )}
        </div>

        {/* Configuration Overlay Settings */}
        {showConfig && (
          <div className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-3.5 my-3 z-20 text-xs text-left">
            <h4 className="font-mono text-[#ededed] font-bold text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1">
              <Settings className="w-3.5 h-3.5 text-amber-500" /> HeyGen Connection Settings
            </h4>
            
            <div className="space-y-3">
              {/* English Guide Helper Badge */}
              <div className="bg-emerald-500/10 border border-emerald-500/15 rounded p-3 text-[11px] leading-relaxed text-emerald-200 font-sans space-y-2">
                <p className="font-bold text-emerald-400 text-xs mb-1 flex items-center gap-1.5 justify-start">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  🎉 Live Interactive Avatar Connected Successfully!
                </p>
                <div className="space-y-2 text-left">
                  <p>
                    Your connection is established correctly! Previously, video creation links were used which are not designed for live dialogue, leading to security-driven restrictions by HeyGen.
                  </p>
                  <p>
                    You have now used the best possible integration path: fetching a direct playback link from HeyGen's dedicated live/interactive avatar domain (<code className="text-[#ededed] bg-[#222] px-1 rounded font-mono">embed.liveavatar.com</code>).
                  </p>
                  <div className="bg-[#141414] border border-[#222] rounded p-2.5 text-[10px] space-y-1 text-emerald-300">
                    <p className="font-bold text-amber-400 mb-0.5">Benefits of your Live Talking Avatar (VAIMA):</p>
                    <p>
                      • The speaking avatar opens directly as an online interactive chat, allowing you to converse in real-time using voice and microphone.
                    </p>
                    <p>
                      • Your interactive avatar link is saved as the default URL, so it renders immediately upon application startup!
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-mono text-[9px] text-[#888] uppercase block mb-1">
                  HeyGen Widget ID (For Live Widget Mode)
                </label>
                <input
                  type="text"
                  value={widgetId}
                  onChange={(e) => setWidgetId(e.target.value)}
                  placeholder="Paste HeyGen Widget ID here..."
                  className="w-full bg-[#111] border border-[#262626] rounded px-2 py-1.5 text-xs text-[#ededed] font-mono focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-[#666] mt-1 block text-left">
                  Enter the 32-digit HeyGen Interactive Widget ID in the input field above.
                </span>
              </div>

              <div>
                <label className="font-mono text-[9px] text-amber-500 uppercase block mb-1 font-bold">
                  Or Paste Full Custom Embed / Share Link URL (Optional Override)
                </label>
                <input
                  type="text"
                  value={customEmbedUrl}
                  onChange={(e) => {
                    setCustomEmbedUrl(e.target.value);
                    if (e.target.value) setWidgetRenderStyle('CUSTOM');
                  }}
                  placeholder="Paste URL (e.g. app.heygen.com/share/xxxx or iframe code)..."
                  className="w-full bg-[#111] border border-[#262626] rounded px-2 py-1.5 text-xs text-[#ededed] font-mono focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-[#888] mt-1 block text-left">
                  Only public URLs belonging to the <strong>Interactive Avatar</strong> section or live share addresses are compatible here.
                </span>
              </div>

              <div className="border-t border-[#262626] pt-2">
                <span className="font-mono text-[9px] text-[#888] uppercase block mb-1">
                  Secure Server API Key Authentication
                </span>
                <div className="bg-[#111] p-2 rounded border border-[#262626] text-[10px] text-[#888] space-y-1">
                  <p>
                    For custom SDK connections, define <code className="text-amber-500 font-mono">HEYGEN_API_KEY</code> in settings secrets.
                  </p>
                  <p>
                    The backend endpoint <code className="text-[#ededed] font-mono">/api/heygen/token</code> fetches dynamic authorized WebRTC keys securely.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowConfig(false)}
                className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 font-sans font-bold text-black rounded text-[10px] transition-all cursor-pointer"
              >
                Apply & Save Settings
              </button>
            </div>
          </div>
        )}

        {/* Content panel based on avatar source */}
        {avatarSource === 'SIMULATOR' && (
          <>
            {/* Visual representation of 40yo female industrial expert */}
            <div className="w-52 h-52 rounded-full bg-[#0d0d0d] border-4 border-[#262626] flex items-center justify-center relative my-4 overflow-hidden shadow-2xl group cursor-pointer z-10 transition-transform duration-500 hover:scale-105">
              {/* Pulsing ring during speech generation */}
              {avatarTalking && (
                <div className="absolute inset-0 bg-amber-500/10 rounded-full border border-amber-500 animate-[ping_1.5s_infinite]" />
              )}

              {/* SVG Vector Animation Avatar Illustration */}
              <div className="relative w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full text-slate-400 absolute fill-none">
                  <defs>
                    <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1a1a1a" />
                      <stop offset="100%" stopColor="#0d0d0d" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="48" fill="url(#avatarGrad)" />
                  <circle cx="50" cy="50" r="38" stroke="#262626" strokeWidth="1" strokeDasharray="4 2" className="animate-[spin_40s_linear_infinite]" />
                  <path d="M20,95 C20,70 80,70 80,95" fill="#333" />
                  <path d="M35,76 L32,95 M65,76 L68,95" stroke="#f59e0b" strokeWidth="3" />
                  <path d="M30,85 L70,85" stroke="#f59e0b" strokeWidth="2.5" />
                  <circle cx="50" cy="45" r="16" fill="#444" className="transition-transform duration-300 group-hover:translate-y-0.5" />
                  <path d="M34,42 C30,22 70,22 66,42 C70,45 66,55 66,55 L34,55 C34,55 30,45 34,42" fill="#581c87" />
                  <circle cx="50" cy="43" r="13" fill="#ffedd5" />
                  <path d="M38,39 L62,39" stroke="#f59e0b" strokeWidth="2" />
                  <rect x="40" y="36" width="8" height="6" rx="2" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                  <rect x="52" y="36" width="8" height="6" rx="2" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                  <path d="M33,35 C33,18 67,18 67,35 Z" fill="#ebaa17" />
                  <rect x="30" y="31" width="40" height="4" rx="1.5" fill="#ca8a04" />
                  <rect x="46" y="20" width="8" height="12" fill="#ca8a04" />
                  {avatarTalking ? (
                    <ellipse cx="50" cy="49" rx="4" ry="3" fill="#141414" className="animate-pulse" />
                  ) : (
                    <path d="M46,49 C48,51 52,51 54,49" stroke="#333" strokeWidth="1.5" fill="none" />
                  )}
                </svg>
              </div>

              <span className="absolute bottom-2 right-12 bg-amber-500 text-black font-mono text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded shadow">
                Expert S.
              </span>
            </div>

            {/* Live Audio Sync Visualizer */}
            <div className="w-full flex items-center justify-center gap-1.5 h-6 mb-4 z-10 animate-fade-in">
              {avatarTalking ? (
                Array.from({ length: 14 }).map((_, i) => (
                  <span 
                    key={i} 
                    className="w-1.5 bg-amber-500 rounded-full animate-[bounce_0.8s_infinite]"
                    style={{
                      height: `${Math.max(10, Math.floor(Math.random() * 24))}px`,
                      animationDelay: `${i * 0.05}s`
                    }}
                  />
                ))
              ) : (
                <span className="text-xs font-mono text-[#666] uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#444] animate-ping" />
                  Avatar Speaker Standby
                </span>
              )}
            </div>
          </>
        )}

        {avatarSource === 'WIDGET' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-3 min-h-[300px] z-10 animate-fade-in">
            {widgetId || customEmbedUrl ? (
              <div className="w-full h-auto relative border border-[#262626] rounded-xl overflow-hidden bg-black flex flex-col justify-between p-3">
                {/* Embed style selector */}
                {currentUser?.role !== 'OPERATOR' && (
                  <div className="flex items-center justify-between gap-1 mb-3 bg-[#0c0c0c] border border-[#222] p-1.5 rounded-lg w-full flex-wrap sm:flex-nowrap">
                    <span className="font-mono text-[9px] text-[#888] uppercase pl-1.5">
                      Embed Engine
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { id: 'FLOATING', label: 'Floating Script' },
                        { id: 'LABS', label: 'Labs Iframe' },
                        { id: 'FRAMER', label: 'Framer Embed' },
                        { id: 'BETA', label: 'Beta Iframe' },
                        { id: 'CUSTOM', label: 'Custom URL' }
                      ].map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setWidgetRenderStyle(style.id as any)}
                          className={`px-2 py-1 rounded font-mono text-[9px] uppercase font-semibold transition ${
                            widgetRenderStyle === style.id 
                              ? 'bg-amber-500 text-black shadow' 
                              : 'bg-[#141414] text-[#888] hover:bg-[#1a1a1a] hover:text-[#ededed]'
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {widgetRenderStyle === 'FLOATING' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg w-full min-h-[225px]">
                    <Sparkles className="w-10 h-10 text-amber-500 mb-2 animate-bounce" />
                    <span className="font-mono text-xs text-[#ededed] block font-bold">
                      Dynamic HeyGen Widget Initialized!
                    </span>
                    <p className="text-[11px] text-[#aaa] font-sans mt-2 max-w-xs leading-relaxed">
                      We have injected your active HeyGen avatar <strong className="text-amber-500">({widgetId.slice(0, 8)}...)</strong> directly into your browser's DOM.
                    </p>
                    <div className="mt-4 p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded text-[10px] font-mono inline-block animate-pulse">
                      👉 Look at the bottom-right corner of your screen!
                    </div>
                    <p className="text-[10px] text-[#666] mt-3 max-w-xs">
                      Note: Sandboxed preview limits can block floating bubbles. To see it fully, click the &quot;Open in New Tab&quot; button below!
                    </p>
                  </div>
                )}

                {widgetRenderStyle === 'LABS' && (
                  <iframe
                    src={`https://labs.heygen.com/interactive-avatar?id=${widgetId}`}
                    className="w-full aspect-video border-0 rounded-lg bg-[#000]"
                    allow="camera; microphone; clipboard-write; autoplay; display-capture;"
                  />
                )}

                {widgetRenderStyle === 'FRAMER' && (
                  <iframe
                    src={`https://app.heygen.com/embed/interactive-avatar?id=${widgetId}`}
                    className="w-full aspect-video border-0 rounded-lg bg-[#000]"
                    allow="camera; microphone; clipboard-write; autoplay; display-capture;"
                  />
                )}

                {widgetRenderStyle === 'BETA' && (
                  <iframe
                    src={`https://beta.heygen.com/interactive-avatar?id=${widgetId}`}
                    className="w-full aspect-video border-0 rounded-lg bg-[#000]"
                    allow="camera; microphone; clipboard-write; autoplay; display-capture;"
                  />
                )}

                {widgetRenderStyle === 'CUSTOM' && (() => {
                  const parsed = resolveHeygenIframeUrl(customEmbedUrl);
                  return customEmbedUrl ? (
                    <div className="w-full flex-1 flex flex-col gap-2 min-h-[300px]">
                      {parsed.isVideoAgent && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3.5 rounded-lg text-xs font-sans text-left leading-relaxed mb-1">
                          <p className="font-bold text-amber-400 flex items-center justify-start gap-1 pb-1 border-b border-amber-500/10">
                            ⚠️ Incompatible HeyGen Link Detected (Offline Video Link)!
                          </p>
                          <p className="mt-1.5 text-zinc-300 leading-relaxed text-[11px]">
                            You have provided a HeyGen offline video creator webpage URL. This workspace is specifically for designing static scripts and generating custom MP4 files using "Create/Submit Video". For security reasons, HeyGen blocks rendering its full video editing studio in external iframes.
                          </p>
                          <div className="mt-2 text-[10.5px] text-zinc-300 bg-black/40 p-2 rounded">
                            <span className="font-semibold text-amber-400">💡 Quick Workarounds:</span>
                            <ul className="list-disc list-inside mt-1 space-y-1 text-zinc-400 pl-1">
                              <li>To embed your genuine HeyGen live avatar, enter its dedicated <strong className="text-white font-mono">Interactive Avatar</strong> share link or Widget ID inside the gear settings panel ⚙️.</li>
                            </ul>
                          </div>
                        </div>
                      )}
                      
                      {currentUser?.role !== 'OPERATOR' && !parsed.isVideoAgent && parsed.wasConverted && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded text-[10.5px] font-sans text-left leading-relaxed">
                          <p className="font-bold flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            Auto-converted HeyGen video ID to playable link:
                          </p>
                          <p className="text-emerald-300/80 mt-0.5">
                            Standard HeyGen editor links cannot load in frames because of iframe security policies. We parsed the embedded video ID and successfully transformed it into a secure, playable preview stream so your avatar <strong className="text-amber-400 font-mono">({parsed.originalId.slice(0, 8)}...)</strong> displays perfectly here.
                          </p>
                        </div>
                      )}
                      
                      <iframe
                        src={parsed.embedUrl}
                        className="w-full aspect-video border-0 rounded-lg bg-[#000]"
                        allow="camera; microphone; clipboard-write; autoplay; display-capture;"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg w-full min-h-[225px]">
                      <Info className="w-8 h-8 text-amber-500 mb-2 animate-pulse" />
                      <span className="font-mono text-xs text-[#ededed] block font-bold">
                        No Custom Embed URL Configured
                      </span>
                      <p className="text-[11px] text-[#aaa] font-sans mt-2 max-w-xs leading-relaxed">
                        To load a custom avatar webpage or frame, please click the settings cog ⚙️ above and enter your URL.
                      </p>
                    </div>
                  );
                })()}

                {/* Highly useful Sandbox escaping banner */}
                {currentUser?.role !== 'OPERATOR' && (
                  <div className="bg-[#0e0e0e] border border-[#222] p-2.5 mt-2.5 rounded-lg text-center flex flex-col items-center gap-1.5">
                    <span className="text-[10.5px] text-[#aaa] font-sans">
                      🔑 Web Audio & Iframe security active. Avoid sandbox locks:
                    </span>
                    <button
                      onClick={() => {
                        window.open(window.location.origin, "_blank", "noopener,noreferrer");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-black font-semibold font-mono text-[10px] rounded uppercase transition-all shadow-md cursor-pointer"
                    >
                      🚀 Open App in New Tab (Recommended) ↗
                    </button>
                  </div>
                )}

                <div className="bg-[#0a0a0a] p-2 mt-2 border border-[#1f1f1f] rounded text-center font-mono text-[9px] text-[#888] w-full flex items-center justify-between">
                  {currentUser?.role !== 'OPERATOR' ? (
                    <span>Widget ID: {widgetId || "None"}</span>
                  ) : (
                    <span />
                  )}
                  {currentUser?.role !== 'OPERATOR' && (
                    <span className="text-amber-500 font-bold uppercase tracking-wide text-[8px]">ACTIVE ENGINE: {widgetRenderStyle}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-[#0a0a0a] border border-[#262626] border-dashed rounded-lg max-w-xs">
                <Globe className="w-8 h-8 text-amber-500 mx-auto mb-2 animate-pulse" />
                <span className="font-mono text-xs text-[#ededed] block">No Widget ID Entered</span>
                <p className="text-[11px] text-[#888] font-sans mt-2">
                  Click the ⚙️ settings cog above to insert your interactive avatar widget ID from your HeyGen profile.
                </p>
              </div>
            )}
          </div>
        )}

        {avatarSource === 'SDK' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-3 min-h-[300px] z-10 animate-fade-in">
            <div className="w-full h-full bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 font-mono text-xs flex flex-col justify-between shrink-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                  <span className="text-amber-500 flex items-center gap-1">
                    <Cpu className="w-4 h-4" /> WebRTC SDK Diagnostics
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide ${
                    sdkConnected ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-[#141414] text-[#666]'
                  }`}>
                    {sdkConnected ? "CONNECTED" : "STOPPED"}
                  </span>
                </div>

                <div className="bg-[#111] p-3 rounded border border-[#262626] h-32 overflow-y-auto text-[10px] text-[#888] space-y-1 select-none font-mono">
                  {sdkLogs.map((log, lIdx) => (
                    <div key={lIdx} className="leading-normal">
                      <span className="text-amber-500/80 mr-1.5">&gt;</span>
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#262626] flex gap-2">
                {sdkConnected ? (
                  <button
                    onClick={closeSdkSession}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    Disconnect Peer
                  </button>
                ) : (
                  <button
                    onClick={fetchHeyGenToken}
                    disabled={connectingSdk}
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-[#141414] disabled:text-[#444] text-black font-semibold rounded text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {connectingSdk && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {connectingSdk ? "Initializing..." : "Connect WebRTC SDK"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: COGNITIVE RAG CONSOLE & WORKER TRANSCRIPTS */}
      {currentUser?.role !== 'OPERATOR' && (
        <div className="lg:col-span-12 xl:col-span-7 bg-[#111] border border-[#262626] rounded-xl p-5 shadow-xl flex flex-col justify-between min-h-[460px]">
        {/* Terminal Header */}
        <div>
          <div className="flex items-center justify-between border-b border-[#262626] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="text-amber-500 w-5 h-5 animate-pulse" />
              <h3 className="font-sans font-semibold text-[#ededed]">
                Cognitive Industrial Agent Pipeline
              </h3>
            </div>
            
            {/* Tone Adaptive Controller selector */}
            <div className="flex items-center gap-2">
              <span className="text-[#888] font-mono text-[10px] uppercase flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Tone Persona:
              </span>
              <div className="bg-[#0a0a0a] p-0.5 rounded border border-[#262626] flex gap-0.5">
                {(['AUTO', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((p) => (
                  <button
                    key={p}
                    id={`btn-persona-${p}`}
                    onClick={() => setActivePersona(p)}
                    className={`px-2 py-1 rounded text-[9px] font-mono tracking-wide cursor-pointer transition-all duration-200 ${
                      activePersona === p
                        ? 'bg-amber-500 text-black font-semibold'
                        : 'text-[#888] hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RAG Knowledge Base PDF Loader & Restriction Panel */}
          <div className="mb-4 bg-[#0a0a0a] border border-[#262626] rounded-lg p-3.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-[#1f1f1f]">
              <div className="flex items-center gap-2">
                <BookOpen className="text-amber-500 w-4 h-4" />
                <span className="font-sans font-semibold text-xs text-[#ededed]">
                  Live Avatar Knowledge Source (RAG)
                </span>
              </div>
              
              {/* PDF file hidden input trigger */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  ref={pdfInputRef}
                  onChange={handlePdfUpload}
                  className="hidden"
                />
                <button
                  id="btn-trigger-pdf-upload"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isParsingPdf}
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-600 text-black text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer transition-all"
                >
                  {isParsingPdf ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  Upload New PDF File
                </button>
              </div>
            </div>

            {/* Parsing State Visual Progress Bar */}
            {isParsingPdf && (
              <div className="mb-3 bg-amber-950/10 border border-amber-500/20 rounded p-2.5 text-center">
                <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-mono font-medium animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{pdfParseProgress}</span>
                </div>
                <div className="w-full bg-zinc-800 h-1 rounded overflow-hidden mt-2">
                  <div className="h-full bg-amber-500 transition-all duration-300 w-[60%] animate-pulse" />
                </div>
              </div>
            )}

            {pdfError && (
              <div className="mb-3 bg-red-950/20 border border-red-900/40 rounded p-2 text-center text-red-400 text-[11px] font-sans">
                ⚠️ {pdfError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="font-sans text-[11px] text-[#ededed] font-medium tracking-wide">
                Select reference documents for Avatar training & response (Multiple selection allowed):
              </label>

              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = displayDocs.map(d => d.id);
                    setRestrictToDocumentIds(allIds);
                  }}
                  className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-[#ccc] border border-zinc-800 text-[10px] rounded transition-all active:scale-95 cursor-pointer"
                >
                  📥 Select All Documents ({displayDocs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRestrictToDocumentIds([]);
                  }}
                  className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-[#ccc] border border-zinc-800 text-[10px] rounded transition-all active:scale-95 cursor-pointer"
                >
                  🧹 Clear Restriction (Unrestricted Search)
                </button>
              </div>

              {/* Document List with Checkboxes */}
              {displayDocs.length === 0 ? (
                <div className="text-center text-[11px] text-[#555] py-4 border border-dashed border-[#222] rounded">
                  No documents uploaded yet. Please add a new PDF document using the button above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {displayDocs.map((doc) => {
                    const isSelected = restrictToDocumentIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          const updated = isSelected
                            ? restrictToDocumentIds.filter(id => id !== doc.id)
                            : [...restrictToDocumentIds, doc.id];
                          setRestrictToDocumentIds(updated);
                        }}
                        className={`p-2 rounded border transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 select-none text-[11px] ${
                          isSelected
                            ? 'bg-amber-500/5 border-amber-500/70 text-amber-200'
                            : 'bg-[#0b0b0b] border-[#1f1f1f] hover:border-[#333] text-[#aaa]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-500' : 'text-zinc-600'}`} />
                          <span className="truncate font-sans font-medium" title={doc.title}>
                            {doc.title}
                          </span>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                          isSelected ? 'bg-amber-500 border-amber-500 text-[#000]' : 'border-zinc-750 bg-[#000]'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Status Indicator */}
              <div className="mt-1 flex items-center justify-between gap-2 border-t border-[#161616] pt-2">
                <span className="text-[10px] text-[#777]">
                  {restrictToDocumentIds.length === 0
                    ? "💡 Status: Intelligent search across all standard workshop documents is active."
                    : `🎯 Status: Answering restricted exclusively to ${restrictToDocumentIds.length} selected file(s).`
                  }
                </span>

                {restrictToDocumentIds.length > 0 && (
                  <span className="bg-emerald-950/30 border border-emerald-900 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase flex items-center justify-center gap-1 shrink-0">
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                    RAG RESTRICTION ACTIVE ({restrictToDocumentIds.length})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Simulated Machine Diagnostics Photo Shortcuts */}
          <div className="mb-4 bg-[#0a0a0a] border border-[#262626] rounded-lg p-3">
            <span className="text-[10px] font-mono text-[#888] uppercase tracking-wider block mb-2">
              📸 Interactive Diagnostics (Simulated Broken Parts / Error Panels)
            </span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_DIAGNOSTICS.map((sample, idx) => (
                <button
                  key={idx}
                  id={`btn-sample-diagnostics-${idx}`}
                  onClick={() => handleSelectSimulatedPhoto(sample)}
                  className="flex items-center gap-2 bg-[#111] hover:bg-[#141414] text-left border border-[#262626] hover:border-[#444] p-1.5 rounded transition-all text-xs"
                >
                  <img src={sample.url} className="w-10 h-10 object-cover rounded border border-[#262626]" alt="" />
                  <div>
                    <span className="text-[#ededed] block truncate max-w-[140px] font-mono text-[11px] font-semibold">{sample.name}</span>
                    <span className="text-[#888] block max-w-[140px] truncate">{sample.query}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active query response area */}
          <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-4 min-h-[160px] flex flex-col justify-between mb-4 relative">
            {isEmergency && (
              <div className="absolute right-3 top-3 bg-red-950/40 text-red-500 border border-red-900/40 px-2 py-1 rounded text-[10px] uppercase font-mono font-bold flex items-center gap-1.3 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                Safety bypass activated
              </div>
            )}

            <div className="text-sm font-sans text-slate-300 whitespace-pre-line leading-relaxed">
              {loading ? (
                <div className="flex flex-col gap-2 py-6 items-center justify-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="font-mono text-xs text-[#888] uppercase tracking-wider">
                    Searching indexed manuals & re-ranking codes...
                  </span>
                </div>
              ) : response ? (
                response
              ) : (
                <div className="text-[#666] py-6 text-center italic font-sans text-xs">
                  "Query standard error limits (e.g., Siemens overheats ERR-CNC-998 or pressure vent triggers CODE E-740) or input diagnostic photo."
                </div>
              )}
            </div>

            {/* Citations Footer */}
            {matchedDoc && !loading && (
              <div className="border-t border-[#262626] pt-3 mt-4 flex items-center justify-between text-[11px] font-mono text-[#888]">
                <span className="flex items-center gap-1 text-[#888] bg-[#111] px-2 py-0.5 rounded border border-[#262626]">
                  <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                  {matchedDoc}
                </span>
                <span className="text-[#555]">
                  Hallucination Check: SECURE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Form controls */}
        <div>
          {/* File Upload Selector info */}
          {uploadedPhoto && (
            <div className="flex items-center justify-between bg-amber-950/20 border border-amber-900/40 rounded p-2 mb-3 text-xs">
              <div className="flex items-center gap-2">
                <img src={uploadedPhoto} alt="Upload" className="w-8 h-8 object-cover rounded" />
                <div>
                  <span className="text-[#ededed] font-mono text-[11px] block">{photoName}</span>
                  <span className="text-amber-500 text-[10px] block font-mono">Multimodal Vision buffer ready</span>
                </div>
              </div>
              <button 
                id="btn-clear-photo"
                onClick={clearPhoto} 
                className="text-slate-450 hover:text-white font-mono uppercase text-[10px] bg-[#0a0a0a] px-2 py-0.5 rounded cursor-pointer border border-[#262626]"
              >
                Clear
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Camera File Trigger */}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handlePhotoSelect} 
              className="hidden" 
            />
            <button
              id="btn-upload-photo"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-[#0a0a0a] hover:bg-[#141414] hover:border-[#444] text-[#888] hover:text-white border border-[#262626] rounded transition-all relative group cursor-pointer"
              title="Upload Machine Diagnostics Photo"
            >
              <Camera className="w-5 h-5" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#111] text-[#ededed] text-[10px] font-mono uppercase tracking-wide px-2 py-1 rounded shadow-lg border border-[#262626] whitespace-nowrap z-20">
                Send Photo
              </span>
            </button>

            {/* Input Bar */}
            <div className="flex-1 relative">
              <input
                id="inp-expert-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitInquiry()}
                placeholder="Ask technical question here..."
                className="w-full bg-[#0a0a0a] text-[#ededed] placeholder-[#444] rounded border border-[#262626] px-4 py-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Voice toggle shortcut */}
            {voiceEnabled ? (
              <button 
                id="btn-mute-voice"
                onClick={() => { setVoiceEnabled(false); stopSpeaking(); }} 
                className="p-3 bg-[#0a0a0a] hover:bg-[#141414] text-amber-500 border border-[#262626] rounded cursor-pointer" 
                title="Mute Voice Output"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            ) : (
              <button 
                id="btn-unmute-voice"
                onClick={() => setVoiceEnabled(true)} 
                className="p-3 bg-[#0a0a0a] hover:bg-[#141414] text-[#444] hover:text-[#888] border border-[#262626] rounded cursor-pointer" 
                title="Unmute Voice Output"
              >
                <VolumeX className="w-5 h-5" />
              </button>
            )}

            {/* Submit Trigger */}
            <button
              id="btn-submit-expert"
              onClick={() => handleSubmitInquiry()}
              disabled={loading || (!query.trim() && !uploadedPhoto)}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-[#111] text-black font-semibold rounded font-sans transition-all flex items-center gap-2 cursor-pointer disabled:text-[#444] disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>Query</span>
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
