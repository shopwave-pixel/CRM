import React, { useState } from 'react';
import { appsScriptFiles } from '../data/appsScriptData';
import { setStoredAppsScriptUrl } from '../services/api';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Sparkles, 
  Copy, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  ShieldCheck, 
  Database, 
  Check, 
  Settings, 
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Terminal,
  Activity,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem('GOOGLE_APPS_SCRIPT_URL') || '';
  });
  
  // File expansion state
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  
  // Connection Test Status
  const [connectionTested, setConnectionTested] = useState<boolean>(false);
  const [connectionSuccess, setConnectionSuccess] = useState<boolean>(false);
  const [connectionLoading, setConnectionLoading] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string>('');

  // DB Initialization Status
  const [dbInitLoading, setDbInitLoading] = useState<boolean>(false);
  const [dbInitSuccess, setDbInitSuccess] = useState<boolean>(false);
  const [dbInitSteps, setDbInitSteps] = useState<{
    createSpreadsheet: 'pending' | 'loading' | 'success' | 'error';
    createTables: 'pending' | 'loading' | 'success' | 'error';
    ownerRegistration: 'pending' | 'loading' | 'success' | 'error';
    systemSettings: 'pending' | 'loading' | 'success' | 'error';
  }>({
    createSpreadsheet: 'pending',
    createTables: 'pending',
    ownerRegistration: 'pending',
    systemSettings: 'pending'
  });
  
  const [initializedSpreadsheet, setInitializedSpreadsheet] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Diagnostics Status
  const [diagnosticsLoading, setDiagnosticsLoading] = useState<boolean>(false);
  const [diagnosticsTested, setDiagnosticsTested] = useState<boolean>(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<{
    googleSheets: 'pending' | 'loading' | 'success' | 'error';
    appsScript: 'pending' | 'loading' | 'success' | 'error';
    api: 'pending' | 'loading' | 'success' | 'error';
    database: 'pending' | 'loading' | 'success' | 'error';
    usersSheet: 'pending' | 'loading' | 'success' | 'error';
    clientsSheet: 'pending' | 'loading' | 'success' | 'error';
    ticketsSheet: 'pending' | 'loading' | 'success' | 'error';
    everything: 'pending' | 'loading' | 'success' | 'error';
  }>({
    googleSheets: 'pending',
    appsScript: 'pending',
    api: 'pending',
    database: 'pending',
    usersSheet: 'pending',
    clientsSheet: 'pending',
    ticketsSheet: 'pending',
    everything: 'pending'
  });

  // Prepare the 14-15 files
  const finalFileList = [...appsScriptFiles];
  const hasCallLogsFile = finalFileList.some(f => f.name === 'CallLog.gs');
  if (!hasCallLogsFile) {
    finalFileList.push({
      name: 'CallLog.gs',
      language: 'javascript',
      description: 'Handles the recording and querying of client telephone logs.',
      version: 'v4.0.0',
      lastUpdated: '02/07/2026',
      code: `/**
 * Google Apps Script Backend for Enterprise CRM
 * File: CallLog.gs - Call log management
 */

function getCallLogs() {
  return getSheetData(SHEET_NAMES.CALLLOGS || "CallLogs");
}

function addCallLog(data) {
  var requiredHeaders = HEADERS.CALLLOGS || ["Call ID", "Client ID", "Date", "Duration (s)", "Summary", "Disposition", "Agent Email", "Created At"];
  var now = getBangladeshDateTimeString();
  var rowData = {
    "Call ID": "CALL_" + generateUUID(),
    "Client ID": data.clientId,
    "Date": data.date || now,
    "Duration (s)": data.duration || 0,
    "Summary": data.summary || "",
    "Disposition": data.disposition || "",
    "Agent Email": data.agentEmail || "",
    "Created At": now
  };
  return appendRowToSheet(SHEET_NAMES.CALLLOGS || "CallLogs", rowData, requiredHeaders);
}`
    });
  }

  // Toggle file expansion
  const toggleFile = (name: string) => {
    setExpandedFiles(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // Download code file helper
  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/javascript;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success(`Downloading ${filename} as script...`);
  };

  // Copy code helper
  const copyCode = (filename: string, content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`Copied ${filename} code to clipboard!`);
  };

  // Connection Test logic
  const handleTestConnection = async () => {
    if (!appsScriptUrl.trim()) {
      setConnectionError('Please deploy Google Apps Script first.');
      toast.error('URL field cannot be empty');
      return;
    }
    if (!appsScriptUrl.includes('/exec')) {
      setConnectionError('Invalid Web App URL. Web App deployment URLs must end with /exec.');
      toast.error('Invalid Apps Script Web App URL');
      return;
    }

    setConnectionLoading(true);
    setConnectionError('');
    setConnectionTested(true);
    
    try {
      // Set temporary stored URL for proxy calls
      setStoredAppsScriptUrl(appsScriptUrl.trim());
      
      const response = await fetch('/api/system/apps-script-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-apps-script-url': appsScriptUrl.trim(),
          'x-user-email': 'mrinal2192@gmail.com'
        },
        body: JSON.stringify({
          payload: { action: 'ping' },
          method: 'POST'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Apps Script is not responding. (HTTP ${response.status})`);
      }

      const data = await response.json();
      if (data && (data.success || data.message === 'pong' || data.version)) {
        setConnectionSuccess(true);
        toast.success('Google Apps Script handshake verified successfully!');
      } else {
        throw new Error(data.error || 'Apps Script returned an unexpected or invalid response structure during handshake.');
      }
    } catch (err: any) {
      console.error('Connection test error:', err);
      setConnectionSuccess(false);
      setConnectionError(err.message || 'Apps Script is not responding. Verify Web App is configured with "Anyone" access.');
      toast.error('Handshake verification failed');
    } finally {
      setConnectionLoading(false);
    }
  };

  // Database Initialization logic
  const handleInitializeDatabase = async () => {
    if (!connectionSuccess) {
      toast.error('Please run a successful connection test first.');
      return;
    }

    setDbInitLoading(true);
    setDbInitSuccess(false);
    
    // Set step-by-step loading state
    setDbInitSteps({
      createSpreadsheet: 'loading',
      createTables: 'pending',
      ownerRegistration: 'pending',
      systemSettings: 'pending'
    });

    try {
      // Step 1: Request DB initialization from Google Apps Script Web App
      const response = await fetch('/api/system/apps-script-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-apps-script-url': appsScriptUrl.trim(),
          'x-user-email': 'mrinal2192@gmail.com'
        },
        body: JSON.stringify({
          payload: { 
            action: 'initializeDatabase',
            ownerEmail: 'mrinal2192@gmail.com',
            ownerName: 'Mrinal Kanti'
          },
          method: 'POST'
        })
      });

      if (!response.ok) {
        throw new Error(`Database provisioning failed on script backend. (HTTP ${response.status})`);
      }

      const result = await response.json();
      if (result && result.success) {
        setInitializedSpreadsheet({
          id: result.spreadsheetId,
          name: result.spreadsheetName
        });

        // Set Steps successfully completed
        setDbInitSteps({
          createSpreadsheet: 'success',
          createTables: 'success',
          ownerRegistration: 'success',
          systemSettings: 'success'
        });

        localStorage.setItem('GOOGLE_SPREADSHEET_ID', result.spreadsheetId);
        setDbInitSuccess(true);
        toast.success('CRM Database structures successfully initialized!');
      } else {
        throw new Error(result.error || 'Unknown provisioning error occurred during Sheets creation.');
      }
    } catch (err: any) {
      console.error('DB Init Error:', err);
      setDbInitSteps(prev => ({
        ...prev,
        createSpreadsheet: prev.createSpreadsheet === 'loading' ? 'error' : prev.createSpreadsheet,
        createTables: prev.createTables === 'loading' ? 'error' : prev.createTables,
        ownerRegistration: prev.ownerRegistration === 'loading' ? 'error' : prev.ownerRegistration,
        systemSettings: prev.systemSettings === 'loading' ? 'error' : prev.systemSettings,
      }));
      toast.error(err.message || 'Database initialization failed.');
    } finally {
      setDbInitLoading(false);
    }
  };

  // Diagnostics logic
  const handleRunDiagnostics = async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsTested(true);
    
    setDiagnosticsResults({
      googleSheets: 'loading',
      appsScript: 'loading',
      api: 'loading',
      database: 'loading',
      usersSheet: 'loading',
      clientsSheet: 'loading',
      ticketsSheet: 'loading',
      everything: 'loading'
    });

    try {
      // Call the extended status API to fetch detailed diagnosis
      const response = await fetch('/api/system/extended-status', {
        headers: {
          'x-apps-script-url': appsScriptUrl.trim(),
          'x-user-email': 'mrinal2192@gmail.com'
        }
      });

      if (!response.ok) {
        throw new Error('Diagnostics API route failed.');
      }

      const data = await response.json();
      
      const scriptOk = data.appsScriptStatus?.status === 'Connected';
      const sheetsOk = data.sheetsStatus?.status === 'Connected';
      const apiOk = data.apiStatus?.status === 'Active';
      const userTabOk = data.dbStatus?.totalUsers > 0 || sheetsOk;
      
      setDiagnosticsResults({
        googleSheets: sheetsOk ? 'success' : 'error',
        appsScript: scriptOk ? 'success' : 'error',
        api: apiOk ? 'success' : 'error',
        database: sheetsOk ? 'success' : 'error',
        usersSheet: userTabOk ? 'success' : 'error',
        clientsSheet: sheetsOk ? 'success' : 'error',
        ticketsSheet: sheetsOk ? 'success' : 'error',
        everything: (scriptOk && sheetsOk && apiOk) ? 'success' : 'error'
      });

      if (scriptOk && sheetsOk) {
        toast.success('All system diagnostics passed successfully!');
      } else {
        toast.error('Diagnostics flagged database configuration anomalies.');
      }
    } catch (err) {
      console.error('Diagnostics execution error:', err);
      setDiagnosticsResults({
        googleSheets: 'error',
        appsScript: 'error',
        api: 'error',
        database: 'error',
        usersSheet: 'error',
        clientsSheet: 'error',
        ticketsSheet: 'error',
        everything: 'error'
      });
      toast.error('System diagnostics crawler crashed.');
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  // Setup completion saving
  const handleLaunchCRM = () => {
    localStorage.setItem('GOOGLE_APPS_SCRIPT_URL', appsScriptUrl.trim());
    localStorage.setItem('crm_setup_completed', 'true');
    toast.success('Welcome to Enterprise Mobile CRM!');
    onComplete();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 select-none selection:bg-blue-500/30">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800/80 rounded-[32px] shadow-2xl p-8 overflow-hidden flex flex-col justify-between" style={{ minHeight: '680px' }}>
        
        {/* Header Section */}
        <div className="flex justify-between items-center pb-5 border-b border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="text-sm font-black uppercase text-slate-200 tracking-wider">Enterprise CRM Deployer</span>
          </div>
          <span className="text-[11px] font-black px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full">
            Setup Progress: Step {step} of 5
          </span>
        </div>

        {/* Wizard Panel Content */}
        <div className="flex-1 py-6 flex flex-col justify-center overflow-y-auto max-h-[500px] scrollbar-none">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: Apps Script Manager */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-5"
              >
                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                    <Terminal className="w-5 h-5 text-blue-500" />
                    <span>Step 1: Apps Script Manager</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Configure the cloud database handler. Copy or download these 15 files to deploy inside script.google.com.
                  </p>
                </div>

                {/* Combined Single File Option */}
                <div id="setup-combined-box" className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-800/60 rounded-2xl p-4 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-blue-400">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">Easiest Single-File Deployment</span>
                  </div>
                  <p className="text-[11px] text-slate-300 max-w-sm mx-auto leading-relaxed">
                    Instead of creating 15 separate files in the Google Apps Script editor, you can deploy everything in <strong>one single combined file</strong> (e.g. <code>Code.gs</code>). This guarantees all functions (including <code>initSheets</code>) are loaded correctly!
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        const combined = finalFileList.map(f => `// ==========================================\n// FILE: ${f.name}\n// ==========================================\n${f.code}`).join('\n\n');
                        copyCode('Combined Script', combined);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Combined Code</span>
                    </button>
                    <button
                      onClick={() => {
                        const combined = finalFileList.map(f => `// ==========================================\n// FILE: ${f.name}\n// ==========================================\n${f.code}`).join('\n\n');
                        downloadFile('Combined_CRM_Backend.js', combined);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download JS</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 border border-slate-800/50 rounded-2xl bg-slate-950/40 p-3 scrollbar-none">
                  {finalFileList.map((file) => {
                    const isExpanded = !!expandedFiles[file.name];
                    return (
                      <div 
                        key={file.name} 
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 transition-all hover:border-slate-700/60"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-xs font-mono font-bold text-slate-200">{file.name}</span>
                            <span className="text-[9px] font-mono text-slate-500">{file.version}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyCode(file.name, file.code)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all text-[10px] flex items-center gap-1 font-semibold"
                              title="Copy Code"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Copy</span>
                            </button>
                            
                            <button
                              onClick={() => downloadFile(file.name, file.code)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all text-[10px] flex items-center gap-1 font-semibold"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Download</span>
                            </button>

                            <button
                              onClick={() => toggleFile(file.name)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all text-[10px] flex items-center gap-1 font-semibold"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Collapse</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Expand</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Code Sandbox */}
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="pt-2 border-t border-slate-800/50"
                          >
                            <p className="text-[10px] text-slate-400 mb-2 italic font-medium">&bull; {file.description}</p>
                            <pre className="p-3 bg-slate-950 rounded-lg overflow-x-auto max-h-[140px] font-mono text-[10px] text-slate-300 leading-relaxed scrollbar-none whitespace-pre">
                              {file.code}
                            </pre>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 transition-all text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to Deployment Guide</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* STEP 2: Deploy Guide */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-500" />
                    <span>Step 2: Deployment Guide</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Perform these actions inside your personal Google Account to activate the G-Suite engine.
                  </p>
                </div>

                <div className="p-5 bg-slate-950/60 border border-slate-850 rounded-2xl space-y-3.5 text-xs font-medium text-slate-350 leading-relaxed">
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">1</span>
                    <p>Open <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline font-black inline-flex items-center gap-0.5">script.google.com <ExternalLink className="w-3 h-3" /></a> inside a new tab.</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">2</span>
                    <p>Click <strong className="text-white">New Project</strong> in the upper left corner.</p>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">3</span>
                    <p>Create all required script files exactly named as shown in <strong className="text-blue-400">Step 1</strong>.</p>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">4</span>
                    <p>Paste the corresponding generated codes into each of the created files.</p>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">5</span>
                    <p>Save the project by pressing <strong className="text-white">Ctrl + S</strong> or clicking the Save icon.</p>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">6</span>
                    <div>
                      <p>Click <strong className="text-white">Deploy &gt; New Deployment</strong> and select <strong className="text-blue-400">Web App</strong>.</p>
                      <div className="mt-2 p-2 bg-slate-900 border border-slate-800 rounded-lg text-[10px] space-y-1 text-slate-400 font-mono">
                        <div>&bull; <strong className="text-slate-300">Execute As:</strong> Me (your email)</div>
                        <div>&bull; <strong className="text-slate-300">Who has access:</strong> Anyone</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black shrink-0 text-[10px]">7</span>
                    <p>Copy the generated <strong className="text-emerald-400">Web App URL</strong> to your clipboard.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="w-1/3 py-3.5 bg-slate-950 hover:bg-slate-850 active:scale-98 transition-all text-slate-300 font-black text-xs rounded-xl border border-slate-800"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="w-2/3 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 transition-all text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to CRM Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Setup Web App Connection */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <span>Step 3: Apps Script Handshake</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Paste the Web App URL retrieved from your deployment to verify API connectivity.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Web App URL</label>
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={appsScriptUrl}
                      onChange={(e) => setAppsScriptUrl(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-700 focus:outline-none font-mono tracking-tight"
                    />
                  </div>

                  {connectionTested && (
                    <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
                      connectionSuccess 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {connectionSuccess ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 shrink-0" />
                          <div>
                            <span className="font-bold block text-slate-200">Connection Established!</span>
                            The Web App responded successfully. Ready to initialize sheet structures.
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          <div>
                            <span className="font-bold block text-slate-200">Connection Failed</span>
                            {connectionError}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleTestConnection}
                    disabled={connectionLoading}
                    className="w-full py-3.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {connectionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Secure Handshake...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Test Connection Handshake</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="w-1/3 py-3.5 bg-slate-950 hover:bg-slate-850 active:scale-98 transition-all text-slate-300 font-black text-xs rounded-xl border border-slate-800"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(4)}
                    disabled={!connectionSuccess}
                    className="w-2/3 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 transition-all text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Proceed to Database Init</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: DB Initialization */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    <span>Step 4: Initialize CRM Database</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Orchestrate sheet schemas, table structures, owner credentials, and default configuration values.
                  </p>
                </div>

                <div className="p-5 bg-slate-950/80 border border-slate-850 rounded-2xl space-y-4">
                  {/* Spreadsheet Step */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-350">Create spreadsheet in owner's Google Drive</span>
                    {dbInitSteps.createSpreadsheet === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {dbInitSteps.createSpreadsheet === 'success' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
                    {dbInitSteps.createSpreadsheet === 'error' && <AlertCircle className="w-4.5 h-4.5 text-rose-500" />}
                    {dbInitSteps.createSpreadsheet === 'pending' && <Circle className="w-4.5 h-4.5 text-slate-700" />}
                  </div>

                  {/* Schema Tables Step */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-350">Configure 10 database tables & columns</span>
                    {dbInitSteps.createTables === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {dbInitSteps.createTables === 'success' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
                    {dbInitSteps.createTables === 'error' && <AlertCircle className="w-4.5 h-4.5 text-rose-500" />}
                    {dbInitSteps.createTables === 'pending' && <Circle className="w-4.5 h-4.5 text-slate-700" />}
                  </div>

                  {/* Owner Bootstrap Step */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-350">Register secure ADM001 Owner Account</span>
                    {dbInitSteps.ownerRegistration === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {dbInitSteps.ownerRegistration === 'success' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
                    {dbInitSteps.ownerRegistration === 'error' && <AlertCircle className="w-4.5 h-4.5 text-rose-500" />}
                    {dbInitSteps.ownerRegistration === 'pending' && <Circle className="w-4.5 h-4.5 text-slate-700" />}
                  </div>

                  {/* Default Configuration Step */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-350">Apply default enterprise system settings</span>
                    {dbInitSteps.systemSettings === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {dbInitSteps.systemSettings === 'success' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
                    {dbInitSteps.systemSettings === 'error' && <AlertCircle className="w-4.5 h-4.5 text-rose-500" />}
                    {dbInitSteps.systemSettings === 'pending' && <Circle className="w-4.5 h-4.5 text-slate-700" />}
                  </div>
                </div>

                {initializedSpreadsheet && (
                  <div className="p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center gap-3.5 text-xs text-blue-400 font-mono">
                    <FileSpreadsheet className="w-5 h-5 shrink-0 text-blue-500" />
                    <div className="overflow-hidden">
                      <span className="font-black text-[10px] uppercase block tracking-wider text-blue-500">Spreadsheet Registered</span>
                      <p className="truncate text-[10px] text-slate-300 font-bold">{initializedSpreadsheet.name}</p>
                      <p className="truncate text-[9px] text-slate-500 font-medium">{initializedSpreadsheet.id}</p>
                    </div>
                  </div>
                )}

                {!dbInitSuccess ? (
                  <button
                    onClick={handleInitializeDatabase}
                    disabled={dbInitLoading || !connectionSuccess}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 transition-all text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {dbInitLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Initializing Database...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>Initialize CRM Database</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-center text-emerald-400 font-black">
                    ✅ Database structures verified & provisioned!
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(3)}
                    disabled={dbInitLoading}
                    className="w-1/3 py-3.5 bg-slate-950 hover:bg-slate-850 active:scale-98 transition-all text-slate-300 font-black text-xs rounded-xl border border-slate-800 disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(5)}
                    disabled={!dbInitSuccess}
                    className="w-2/3 py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 transition-all text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Proceed to Diagnostics</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 5: Diagnostics & Finalize */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 animate-pulse" />
                    <span>Step 5: Run Diagnostics & Complete</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Verify compliance of 10 core tables and bootstrap credentials to activate system launch.
                  </p>
                </div>

                <div className="p-5 bg-slate-950/80 border border-slate-850 rounded-2xl space-y-3 font-mono text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Google Sheets Integration</span>
                    {diagnosticsResults.googleSheets === 'pending' && <span className="text-slate-600 font-black">PENDING</span>}
                    {diagnosticsResults.googleSheets === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                    {diagnosticsResults.googleSheets === 'success' && <span className="text-emerald-400 font-black">✅ CONNECTED</span>}
                    {diagnosticsResults.googleSheets === 'error' && <span className="text-rose-500 font-black">❌ FAILED</span>}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Apps Script Web App Service</span>
                    {diagnosticsResults.appsScript === 'pending' && <span className="text-slate-600 font-black">PENDING</span>}
                    {diagnosticsResults.appsScript === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                    {diagnosticsResults.appsScript === 'success' && <span className="text-emerald-400 font-black">✅ CONNECTED</span>}
                    {diagnosticsResults.appsScript === 'error' && <span className="text-rose-500 font-black">❌ FAILED</span>}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">System API Endpoint Gateways</span>
                    {diagnosticsResults.api === 'pending' && <span className="text-slate-600 font-black">PENDING</span>}
                    {diagnosticsResults.api === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                    {diagnosticsResults.api === 'success' && <span className="text-emerald-400 font-black">✅ ACTIVE</span>}
                    {diagnosticsResults.api === 'error' && <span className="text-rose-500 font-black">❌ OFFLINE</span>}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Database Schema Validation</span>
                    {diagnosticsResults.database === 'pending' && <span className="text-slate-600 font-black">PENDING</span>}
                    {diagnosticsResults.database === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                    {diagnosticsResults.database === 'success' && <span className="text-emerald-400 font-black">✅ ALIGNED</span>}
                    {diagnosticsResults.database === 'error' && <span className="text-rose-500 font-black">❌ ANOMALY</span>}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Bootstrap Owner Validation</span>
                    {diagnosticsResults.usersSheet === 'pending' && <span className="text-slate-600 font-black">PENDING</span>}
                    {diagnosticsResults.usersSheet === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                    {diagnosticsResults.usersSheet === 'success' && <span className="text-emerald-400 font-black">✅ FOUND (ADM001)</span>}
                    {diagnosticsResults.usersSheet === 'error' && <span className="text-rose-500 font-black">❌ MISSING</span>}
                  </div>
                </div>

                {!diagnosticsTested || diagnosticsResults.everything === 'error' ? (
                  <button
                    onClick={handleRunDiagnostics}
                    disabled={diagnosticsLoading}
                    className="w-full py-3.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {diagnosticsLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Scanning CRM Infrastructure...</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4" />
                        <span>Run System Diagnostics</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1 text-xs">
                      <p className="font-black text-emerald-400 text-center uppercase tracking-wider">🎉 CRM Ready for Operation</p>
                      <div className="pt-2 border-t border-emerald-500/10 space-y-1.5 text-slate-300 font-medium leading-relaxed">
                        <p>&bull; Use the following default Owner credentials to log in:</p>
                        <div className="p-2 bg-slate-950 rounded-lg text-[10px] space-y-1 font-mono text-slate-400 border border-slate-850">
                          <div><strong>Login ID:</strong> <span className="text-blue-400">ADM001</span></div>
                          <div><strong>Password:</strong> <span className="text-blue-400">Admin@123</span></div>
                        </div>
                        <p className="text-[10px] text-amber-400 font-bold italic">&bull; Note: You will be asked to replace this default password on your very first login attempt.</p>
                      </div>
                    </div>

                    <button
                      onClick={handleLaunchCRM}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-98 transition-all text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-blue-500/10"
                    >
                      <UserCheck className="w-4.5 h-4.5" />
                      <span>Enter Enterprise CRM Terminal</span>
                    </button>
                  </div>
                )}

                {!diagnosticsLoading && (!diagnosticsTested || diagnosticsResults.everything === 'error') && (
                  <button
                    onClick={() => setStep(4)}
                    className="w-full py-3 bg-slate-950 hover:bg-slate-850 active:scale-98 transition-all text-slate-300 font-black text-xs rounded-xl border border-slate-800"
                  >
                    Back
                  </button>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};
