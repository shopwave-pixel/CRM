import React, { useState, useEffect } from 'react';
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
  // Current step state: 1 to 8
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    return localStorage.getItem('GOOGLE_APPS_SCRIPT_URL') || '';
  });
  
  // Advanced code reference toggle
  const [showCodes, setShowCodes] = useState<boolean>(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  
  // Execution loading & errors
  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');
  const [isSetupStarted, setIsSetupStarted] = useState<boolean>(false);
  
  // Auto progress tracking for UI steps
  const [stepsProgress, setStepsProgress] = useState<Record<number, 'pending' | 'loading' | 'success' | 'error'>>({
    1: 'success', // Step 1: Login/Ready is auto-passed on launch
    2: 'pending', // Step 2: Apps Script Connection
    3: 'pending', // Step 3: Initialize CRM Database
    4: 'pending', // Step 4: Automatically Create Database
    5: 'pending', // Step 5: Automatically Create Columns
    6: 'pending', // Step 6: Automatically Create Owner
    7: 'pending', // Step 7: Verify Database
    8: 'pending', // Step 8: Complete
  });

  // Diagnostics check list
  const [diagnosticsChecklist, setDiagnosticsChecklist] = useState<Record<string, 'pending' | 'loading' | 'success' | 'error'>>({
    'Google Apps Script': 'pending',
    'Google Spreadsheet': 'pending',
    'Script Properties': 'pending',
    'Users Sheet': 'pending',
    'Clients Sheet': 'pending',
    'Tickets Sheet': 'pending',
    'Conversations Sheet': 'pending',
    'FollowUps Sheet': 'pending',
    'CallLogs Sheet': 'pending',
    'Dashboard Sheet': 'pending',
    'Settings Sheet': 'pending',
    'ArchivedClients Sheet': 'pending',
    'Owner Account': 'pending',
  });

  const [initializedSpreadsheet, setInitializedSpreadsheet] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [countdown, setCountdown] = useState<number>(4);

  // Custom setup error mapping
  const mapSetupError = (err: any): string => {
    const errMsg = String(err.message || err).toLowerCase();
    if (!appsScriptUrl.trim() || !appsScriptUrl.includes('/exec')) {
      return 'Apps Script URL is invalid.';
    }
    if (
      errMsg.includes('404') ||
      errMsg.includes('500') ||
      errMsg.includes('fetch') ||
      errMsg.includes('network') ||
      errMsg.includes('not responding') ||
      errMsg.includes('failed to fetch') ||
      errMsg.includes('dns') ||
      errMsg.includes('timeout') ||
      errMsg.includes('unreachable')
    ) {
      return 'Apps Script is not deployed.';
    }
    if (errMsg.includes('permission') || errMsg.includes('denied') || errMsg.includes('authorized') || errMsg.includes('403') || errMsg.includes('401')) {
      return 'Permission denied.';
    }
    if (errMsg.includes('spreadsheet') || errMsg.includes('create') || errMsg.includes('openbyid')) {
      return 'Spreadsheet creation failed.';
    }
    if (errMsg.includes('unavailable') || errMsg.includes('service') || errMsg.includes('google')) {
      return 'Google API unavailable.';
    }
    return err.message || 'Apps Script returned an unexpected or invalid response.';
  };

  // Run automatic multi-step flow
  const runAutomatedSetup = async () => {
    if (!appsScriptUrl.trim()) {
      toast.error('URL field cannot be empty');
      setErrorText('Apps Script URL is invalid.');
      setStepsProgress(prev => ({ ...prev, 2: 'error' }));
      return;
    }
    if (!appsScriptUrl.includes('/exec')) {
      toast.error('Web App URL must end with /exec');
      setErrorText('Apps Script URL is invalid.');
      setStepsProgress(prev => ({ ...prev, 2: 'error' }));
      return;
    }

    setIsSetupStarted(true);
    setLoading(true);
    setErrorText('');
    
    // Set steps back to initial state (except Step 1)
    setStepsProgress({
      1: 'success',
      2: 'loading',
      3: 'pending',
      4: 'pending',
      5: 'pending',
      6: 'pending',
      7: 'pending',
      8: 'pending',
    });
    setCurrentStep(2);

    try {
      // Set temporary stored URL for proxy calls
      setStoredAppsScriptUrl(appsScriptUrl.trim());

      // ----------------------------------------------------
      // STEP 2: TEST CONNECTION HANDSHAKE
      // ----------------------------------------------------
      let isConnected = false;
      let handshakeErrorMsg = '';

      try {
        const handshakeResponse = await fetch('/api/system/apps-script-proxy', {
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

        const status = handshakeResponse.status;
        let responseJson: any = null;
        let responseText = '';

        try {
          // Attempt to clone and parse JSON
          const clone = handshakeResponse.clone();
          responseJson = await clone.json();
          responseText = JSON.stringify(responseJson);
        } catch (e) {
          try {
            responseText = await handshakeResponse.text();
          } catch (tErr) {}
        }

        const lowerText = responseText.toLowerCase();

        // Check for specific keywords or HTTP statuses
        const containsValidIndicators = (
          lowerText.includes('databasenotinitialized') ||
          lowerText.includes('spreadsheetnotfound') ||
          lowerText.includes('missingspreadsheetid') ||
          lowerText.includes('missinguserssheet') ||
          lowerText.includes('missingsettings') ||
          lowerText.includes('spreadsheet not found') ||
          lowerText.includes('database not initialized') ||
          lowerText.includes('runtime error') ||
          lowerText.includes('apps script runtime error') ||
          lowerText.includes('apps script') ||
          lowerText.includes('authorization') ||
          lowerText.includes('unauthorized') ||
          lowerText.includes('permission') ||
          lowerText.includes('pong') ||
          lowerText.includes('success')
        );

        // If HTTP 200, HTTP 400, or any valid JSON response, or contains valid indicators, Apps Script is CONNECTED!
        if (
          status === 200 || 
          status === 400 || 
          responseJson !== null || 
          containsValidIndicators
        ) {
          isConnected = true;
        } else {
          // If status is 404, 500, etc., without valid JSON or indicator keywords
          if (status === 404) {
            handshakeErrorMsg = 'HTTP 404 Error: Apps Script URL was not found.';
          } else if (status === 500) {
            handshakeErrorMsg = 'HTTP 500 Error: Internal Server error from Apps Script endpoint.';
          } else {
            handshakeErrorMsg = `HTTP ${status} Connection Failure.`;
          }
        }
      } catch (fetchErr: any) {
        console.error('Handshake network/fetch failure:', fetchErr);
        handshakeErrorMsg = `Network Failure: ${fetchErr.message || 'unreachable'}`;
      }

      if (!isConnected) {
        // Throw the recorded handshake connection failure error
        throw new Error(handshakeErrorMsg || 'Apps Script is not responding.');
      }

      // Step 2 Connection Succeeds! Update State
      setStepsProgress(prev => ({ ...prev, 2: 'success', 3: 'loading' }));
      setCurrentStep(3);
      toast.success('Google Apps Script Connected successfully!');

      // Short aesthetic delay to let user see transition
      await new Promise(resolve => setTimeout(resolve, 800));

      // ----------------------------------------------------
      // STEP 3, 4, 5, 6: INITIALIZE DATABASE (Sheets, Columns, and Owner ADM001)
      // ----------------------------------------------------
      setStepsProgress(prev => ({ 
        ...prev, 
        3: 'loading',
        4: 'loading',
        5: 'loading',
        6: 'loading'
      }));
      setCurrentStep(4);

      const dbResponse = await fetch('/api/system/apps-script-proxy', {
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

      if (!dbResponse.ok) {
        throw new Error('Database initialization request failed.');
      }

      const dbData = await dbResponse.json();
      if (!dbData || !dbData.success) {
        throw new Error(dbData.error || 'Database initialization returned error status.');
      }

      setInitializedSpreadsheet({
        id: dbData.spreadsheetId,
        name: dbData.spreadsheetName
      });
      localStorage.setItem('GOOGLE_SPREADSHEET_ID', dbData.spreadsheetId);

      // Successfully finished steps 3, 4, 5, 6
      setStepsProgress(prev => ({ 
        ...prev, 
        3: 'success',
        4: 'success',
        5: 'success',
        6: 'success',
        7: 'loading'
      }));
      setCurrentStep(7);
      toast.success('Database initialized successfully.');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // ----------------------------------------------------
      // STEP 7: RUN DETAILED DIAGNOSTICS
      // ----------------------------------------------------
      // Set checklist items to loading sequentially
      const checklistItems = Object.keys(diagnosticsChecklist);
      for (const item of checklistItems) {
        setDiagnosticsChecklist(prev => ({ ...prev, [item]: 'loading' }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Call the diagnostics endpoint
      const diagResponse = await fetch('/api/system/extended-status', {
        headers: {
          'x-apps-script-url': appsScriptUrl.trim(),
          'x-user-email': 'mrinal2192@gmail.com'
        }
      });

      if (!diagResponse.ok) {
        throw new Error('Diagnostics scan failed on backend.');
      }

      const diagData = await diagResponse.json();
      const liveDiag = diagData.diagnostics || {};

      // Map live diagnostics response from backend to our diagnostic checklist
      const mappedChecklist: Record<string, 'success' | 'error'> = {
        'Google Apps Script': diagData.appsScriptStatus?.status === 'Connected' ? 'success' : 'error',
        'Google Spreadsheet': diagData.sheetsStatus?.status === 'Connected' ? 'success' : 'error',
        'Script Properties': liveDiag.scriptProperties === 'Configured' ? 'success' : 'error',
        'Users Sheet': liveDiag.usersSheet === 'Active' ? 'success' : 'error',
        'Clients Sheet': liveDiag.clientsSheet === 'Active' ? 'success' : 'error',
        'Tickets Sheet': liveDiag.ticketsSheet === 'Active' ? 'success' : 'error',
        'Conversations Sheet': liveDiag.conversationsSheet === 'Active' ? 'success' : 'error',
        'FollowUps Sheet': liveDiag.followUpsSheet === 'Active' ? 'success' : 'error',
        'CallLogs Sheet': liveDiag.callLogsSheet === 'Active' ? 'success' : 'error',
        'Dashboard Sheet': liveDiag.dashboardSheet === 'Active' ? 'success' : 'error',
        'Settings Sheet': liveDiag.settingsSheet === 'Active' ? 'success' : 'error',
        'ArchivedClients Sheet': liveDiag.archivedClientsSheet === 'Active' ? 'success' : 'error',
        'Owner Account': liveDiag.ownerAccount === 'Created' ? 'success' : 'error',
      };

      setDiagnosticsChecklist(mappedChecklist);

      // Check if any item failed
      const hasFailure = Object.values(mappedChecklist).some(val => val === 'error');
      if (hasFailure) {
        throw new Error('Self-diagnostic scan flagged sheet setup anomalies.');
      }

      // Step 7 Diagnostics Successful!
      setStepsProgress(prev => ({ ...prev, 7: 'success', 8: 'loading' }));
      setCurrentStep(8);
      toast.success('Diagnostics verification completed successfully!');

      await new Promise(resolve => setTimeout(resolve, 1200));

      // ----------------------------------------------------
      // STEP 8: SETUP COMPLETE! PERSIST STATE & COUNTDOWN TO AUTO-REDIRECT
      // ----------------------------------------------------
      localStorage.setItem('GOOGLE_APPS_SCRIPT_URL', appsScriptUrl.trim());
      localStorage.setItem('crm_setup_completed', 'true');
      setStepsProgress(prev => ({ ...prev, 8: 'success' }));
      setLoading(false);

    } catch (err: any) {
      console.error('Setup error occurred:', err);
      const userFriendlyError = mapSetupError(err);
      setErrorText(userFriendlyError);
      
      // Tag current steps as error
      setStepsProgress(prev => {
        const next = { ...prev };
        for (let s = 2; s <= 8; s++) {
          if (next[s as keyof typeof next] === 'loading') {
            next[s as keyof typeof next] = 'error';
          }
        }
        return next;
      });
      toast.error(userFriendlyError);
      setLoading(false);
    }
  };

  // Autoplay countdown and redirect on Step 8 complete
  useEffect(() => {
    let timer: any;
    if (stepsProgress[8] === 'success' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (stepsProgress[8] === 'success' && countdown === 0) {
      onComplete();
    }
    return () => clearTimeout(timer);
  }, [stepsProgress, countdown, onComplete]);

  // Combined JS files handler
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

  const copyCode = (filename: string, content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`Copied ${filename} code to clipboard!`);
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/javascript;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success(`Downloading ${filename} code...`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 select-none selection:bg-blue-500/30">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-850/80 rounded-[32px] shadow-2xl p-8 overflow-hidden flex flex-col justify-between" style={{ minHeight: '620px' }}>
        
        {/* Header Title */}
        <div className="flex justify-between items-center pb-5 border-b border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="text-sm font-black uppercase text-slate-200 tracking-wider">Enterprise CRM Automatic Setup</span>
          </div>
          <span className="text-[11px] font-black px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full">
            Database Controller
          </span>
        </div>

        {/* Dynamic Panel content */}
        <div className="flex-1 py-6 flex flex-col justify-center overflow-y-auto max-h-[520px] scrollbar-none">
          <AnimatePresence mode="wait">
            
            {!isSetupStarted ? (
              // ----------------------------------------------------
              // INPUT SCREEN (The Only Manual Step)
              // ----------------------------------------------------
              <motion.div
                key="input-screen"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="space-y-1.5 text-center">
                  <h3 className="text-xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                    <Database className="w-5.5 h-5.5 text-blue-500 animate-bounce" />
                    <span>One-Step Automated CRM Setup</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    Connecting Google Apps Script is the only manual configuration needed. Everything else (Google Spreadsheet, 10 table schemas, default configurations, Owner profile ADM001) will be initialized automatically in one click.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Google Apps Script Web App URL</label>
                    <input
                      type="url"
                      id="apps-script-url-input"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={appsScriptUrl}
                      onChange={(e) => setAppsScriptUrl(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-700 focus:outline-none font-mono tracking-tight transition-all"
                    />
                  </div>

                  {errorText && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-500" />
                      <span>{errorText}</span>
                    </div>
                  )}

                  <button
                    onClick={runAutomatedSetup}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] transition-all text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-blue-500/10"
                  >
                    <span>Connect & Setup CRM Database</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Collapsible Script files for manual deployment helper */}
                <div className="border border-slate-800/60 rounded-2xl bg-slate-950/20">
                  <button
                    onClick={() => setShowCodes(!showCodes)}
                    className="w-full px-4 py-3.5 flex justify-between items-center text-xs font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-slate-500" />
                      <span>Show Google Apps Script Codes (Deployment Helper)</span>
                    </span>
                    {showCodes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showCodes && (
                    <div className="p-4 border-t border-slate-800/60 space-y-4 max-h-[250px] overflow-y-auto scrollbar-none">
                      <div className="bg-gradient-to-r from-blue-950/20 to-indigo-950/20 border border-blue-900/40 rounded-xl p-3 text-center space-y-2">
                        <span className="text-[10px] font-black uppercase text-blue-400 block tracking-widest">Easiest Single-File Deployment</span>
                        <p className="text-[10px] text-slate-300 leading-normal">
                          Create a single <code>Code.gs</code> file inside the Google Apps Script editor, copy the combined bundle, and deploy!
                        </p>
                        <div className="flex gap-2 justify-center pt-1">
                          <button
                            onClick={() => {
                              const combined = finalFileList.map(f => `// ==========================================\n// FILE: ${f.name}\n// ==========================================\n${f.code}`).join('\n\n');
                              copyCode('Combined Script', combined);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Combined</span>
                          </button>
                          <button
                            onClick={() => {
                              const combined = finalFileList.map(f => `// ==========================================\n// FILE: ${f.name}\n// ==========================================\n${f.code}`).join('\n\n');
                              downloadFile('Combined_CRM_Backend.js', combined);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] rounded-lg flex items-center gap-1 transition-all border border-slate-700 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download JS</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {finalFileList.map((file) => {
                          const isExpanded = !!expandedFiles[file.name];
                          return (
                            <div key={file.name} className="bg-slate-900 border border-slate-800/60 rounded-xl p-3 space-y-2">
                              <div className="flex justify-between items-center text-[11px] font-mono">
                                <span className="font-bold text-slate-300">{file.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => copyCode(file.name, file.code)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Copy">
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setExpandedFiles(prev => ({ ...prev, [file.name]: !isExpanded }))} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                              {isExpanded && (
                                <pre className="p-2 bg-slate-950 rounded text-[9px] text-slate-400 overflow-x-auto max-h-[100px] whitespace-pre font-mono leading-tight">
                                  {file.code}
                                </pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              // ----------------------------------------------------
              // PROGRESS TRACKER (Steps 1 to 8)
              // ----------------------------------------------------
              <motion.div
                key="progress-screen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="space-y-1 text-center">
                  <h3 className="text-lg font-bold text-white">Automated Deployment Tracker</h3>
                  <p className="text-xs text-slate-400">
                    Executing backend CRM provisioning sequences...
                  </p>
                </div>

                {/* Vertical Stepper List */}
                <div className="space-y-3.5 bg-slate-950/35 border border-slate-850 p-5 rounded-2xl">
                  {/* Step 1: Login */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center text-[8px] text-slate-950">✓</span>
                      <span className="text-slate-300">Step 1: System Authorization</span>
                    </div>
                    <span className="text-emerald-400 font-mono text-[10px]">SUCCESS</span>
                  </div>

                  {/* Step 2: Apps Script Connection */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2.5">
                      {stepsProgress[2] === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                      {stepsProgress[2] === 'success' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      {stepsProgress[2] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {stepsProgress[2] === 'pending' && <Circle className="w-3.5 h-3.5 text-slate-800" />}
                      <span className={stepsProgress[2] === 'pending' ? 'text-slate-600' : 'text-slate-300'}>Step 2: Apps Script Connection Handshake</span>
                    </div>
                    <span className={`font-mono text-[10px] ${
                      stepsProgress[2] === 'success' ? 'text-emerald-400' :
                      stepsProgress[2] === 'loading' ? 'text-blue-500 animate-pulse' :
                      stepsProgress[2] === 'error' ? 'text-rose-500' : 'text-slate-600'
                    }`}>
                      {stepsProgress[2] === 'success' ? '🟢 CONNECTED' : stepsProgress[2].toUpperCase()}
                    </span>
                  </div>

                  {/* Step 3: Initialize CRM Database */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2.5">
                      {stepsProgress[3] === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                      {stepsProgress[3] === 'success' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      {stepsProgress[3] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {stepsProgress[3] === 'pending' && <Circle className="w-3.5 h-3.5 text-slate-800" />}
                      <span className={stepsProgress[3] === 'pending' ? 'text-slate-600' : 'text-slate-300'}>Step 3: Setup Google Spreadsheet SPREADSHEET_ID</span>
                    </div>
                    <span className={`font-mono text-[10px] ${
                      stepsProgress[3] === 'success' ? 'text-emerald-400' :
                      stepsProgress[3] === 'loading' ? 'text-blue-500 animate-pulse' :
                      stepsProgress[3] === 'error' ? 'text-rose-500' : 'text-slate-600'
                    }`}>
                      {stepsProgress[3].toUpperCase()}
                    </span>
                  </div>

                  {/* Step 4: Automatically Create Database */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2.5">
                      {stepsProgress[4] === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                      {stepsProgress[4] === 'success' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      {stepsProgress[4] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {stepsProgress[4] === 'pending' && <Circle className="w-3.5 h-3.5 text-slate-800" />}
                      <span className={stepsProgress[4] === 'pending' ? 'text-slate-600' : 'text-slate-300'}>Step 4: Provision 10 Required Sheets</span>
                    </div>
                    <span className={`font-mono text-[10px] ${
                      stepsProgress[4] === 'success' ? 'text-emerald-400' :
                      stepsProgress[4] === 'loading' ? 'text-blue-500 animate-pulse' :
                      stepsProgress[4] === 'error' ? 'text-rose-500' : 'text-slate-600'
                    }`}>
                      {stepsProgress[4].toUpperCase()}
                    </span>
                  </div>

                  {/* Step 5: Automatically Create Columns */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2.5">
                      {stepsProgress[5] === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                      {stepsProgress[5] === 'success' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      {stepsProgress[5] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {stepsProgress[5] === 'pending' && <Circle className="w-3.5 h-3.5 text-slate-800" />}
                      <span className={stepsProgress[5] === 'pending' ? 'text-slate-600' : 'text-slate-300'}>Step 5: Aligned Sheet Columns & Repair Schemas</span>
                    </div>
                    <span className={`font-mono text-[10px] ${
                      stepsProgress[5] === 'success' ? 'text-emerald-400' :
                      stepsProgress[5] === 'loading' ? 'text-blue-500 animate-pulse' :
                      stepsProgress[5] === 'error' ? 'text-rose-500' : 'text-slate-600'
                    }`}>
                      {stepsProgress[5].toUpperCase()}
                    </span>
                  </div>

                  {/* Step 6: Automatically Create Owner */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2.5">
                      {stepsProgress[6] === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                      {stepsProgress[6] === 'success' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      {stepsProgress[6] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {stepsProgress[6] === 'pending' && <Circle className="w-3.5 h-3.5 text-slate-800" />}
                      <span className={stepsProgress[6] === 'pending' ? 'text-slate-600' : 'text-slate-300'}>Step 6: Setup ADM001 Owner Profile</span>
                    </div>
                    <span className={`font-mono text-[10px] ${
                      stepsProgress[6] === 'success' ? 'text-emerald-400' :
                      stepsProgress[6] === 'loading' ? 'text-blue-500 animate-pulse' :
                      stepsProgress[6] === 'error' ? 'text-rose-500' : 'text-slate-600'
                    }`}>
                      {stepsProgress[6].toUpperCase()}
                    </span>
                  </div>

                  {/* Step 7: Verify Database (Diagnostics) */}
                  <div className="flex flex-col gap-1 text-xs font-semibold">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {stepsProgress[7] === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                        {stepsProgress[7] === 'success' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                        {stepsProgress[7] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                        {stepsProgress[7] === 'pending' && <Circle className="w-3.5 h-3.5 text-slate-800" />}
                        <span className={stepsProgress[7] === 'pending' ? 'text-slate-600' : 'text-slate-300'}>Step 7: Live Infrastructure Diagnostics</span>
                      </div>
                      <span className={`font-mono text-[10px] ${
                        stepsProgress[7] === 'success' ? 'text-emerald-400' :
                        stepsProgress[7] === 'loading' ? 'text-blue-500 animate-pulse' :
                        stepsProgress[7] === 'error' ? 'text-rose-500' : 'text-slate-600'
                      }`}>
                        {stepsProgress[7].toUpperCase()}
                      </span>
                    </div>

                    {/* Sequential checklist UI within Step 7 */}
                    {stepsProgress[7] !== 'pending' && (
                      <div className="ml-6 mt-2 p-3 bg-slate-900 border border-slate-850 rounded-xl grid grid-cols-2 gap-2 text-[10px] font-mono">
                        {Object.entries(diagnosticsChecklist).map(([name, status]) => (
                          <div key={name} className="flex justify-between items-center pr-2">
                            <span className="text-slate-400">{name}</span>
                            {status === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                            {status === 'success' && <span className="text-emerald-400 font-bold">✓</span>}
                            {status === 'error' && <span className="text-rose-500 font-bold">✗</span>}
                            {status === 'pending' && <span className="text-slate-600 font-bold">···</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Step 8: Complete */}
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2.5">
                      {stepsProgress[8] === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
                      {stepsProgress[8] === 'success' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      {stepsProgress[8] === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {stepsProgress[8] === 'pending' && <Circle className="w-3.5 h-3.5 text-slate-800" />}
                      <span className={stepsProgress[8] === 'pending' ? 'text-slate-600' : 'text-slate-350'}>Step 8: Finalize G-Suite CRM Launch</span>
                    </div>
                    <span className={`font-mono text-[10px] ${
                      stepsProgress[8] === 'success' ? 'text-emerald-400' :
                      stepsProgress[8] === 'loading' ? 'text-blue-500 animate-pulse' :
                      stepsProgress[8] === 'error' ? 'text-rose-500' : 'text-slate-600'
                    }`}>
                      {stepsProgress[8].toUpperCase()}
                    </span>
                  </div>
                </div>

                {initializedSpreadsheet && (
                  <div className="p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center gap-3.5 text-xs text-blue-400 font-mono">
                    <FileSpreadsheet className="w-5 h-5 shrink-0 text-blue-500 animate-pulse" />
                    <div className="overflow-hidden">
                      <span className="font-black text-[9px] uppercase block tracking-wider text-blue-500">Google Spreadsheet Registered</span>
                      <p className="truncate text-[10px] text-slate-300 font-bold">{initializedSpreadsheet.name}</p>
                      <p className="truncate text-[9px] text-slate-500 font-medium">{initializedSpreadsheet.id}</p>
                    </div>
                  </div>
                )}

                {/* Setup Error block with restart button */}
                {errorText && (
                  <div className="space-y-3">
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-start gap-2.5 font-semibold">
                      <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                      <div>
                        <p className="font-bold text-slate-200 mb-0.5">Automated Provisioning Interrupted</p>
                        <span>{errorText}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsSetupStarted(false)}
                      className="w-full py-3.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Configure Setup Web App URL</span>
                    </button>
                  </div>
                )}

                {/* Complete / Redirect countdown block */}
                {stepsProgress[8] === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs space-y-3"
                  >
                    <p className="font-black text-emerald-400 text-center uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span>✅ CRM Ready</span>
                    </p>
                    <div className="border-t border-emerald-500/15 pt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-300">
                      <div>Database Connected: <span className="text-emerald-400">Yes</span></div>
                      <div>Apps Script Connected: <span className="text-emerald-400">Yes</span></div>
                      <div>Owner Created: <span className="text-emerald-400">Yes</span></div>
                      <div>System Ready: <span className="text-emerald-400">Yes</span></div>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-3 space-y-1.5 font-mono text-[10px] text-slate-400 border border-slate-850">
                      <div><strong>Bootstrap Login ID:</strong> <span className="text-blue-400">ADM001</span></div>
                      <div><strong>Bootstrap Password:</strong> <span className="text-blue-400">Admin@123</span></div>
                      <p className="text-[9px] text-amber-500 mt-1 font-bold italic">&bull; Password change required upon initial login attempt.</p>
                    </div>
                    <p className="text-center font-bold text-slate-400 animate-pulse pt-1">
                      Redirecting automatically to Login in <span className="text-blue-400 text-sm font-black">{countdown}</span> seconds...
                    </p>
                  </motion.div>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};
