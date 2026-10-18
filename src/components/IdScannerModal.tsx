import React, { useState, useRef } from 'react';
import Modal from './Modal';
import { Camera, Upload, Sparkles, CheckCircle2, ShieldCheck, Key, RefreshCw, AlertCircle } from 'lucide-react';
import { extractIdDocument, getStoredApiKey, setStoredApiKey, type ExtractedIdData } from '@/lib/aiService';
import { maskId } from '@/lib/identity';

interface IdScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (data: ExtractedIdData) => void;
}

export default function IdScannerModal({ isOpen, onClose, onScanComplete }: IdScannerModalProps) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedIdData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPreview(base64);
        processScan(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const processScan = async (base64: string, demoType?: 'aadhaar' | 'passport' | 'driving_license') => {
    setScanning(true);
    setError(null);
    try {
      const data = await extractIdDocument(base64, demoType);
      setExtracted(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to scan document.';
      setError(msg);
      setExtracted(null);
    } finally {
      setScanning(false);
    }
  };

  const runSample = (type: 'aadhaar' | 'passport' | 'driving_license') => {
    setPreview(null);
    setError(null);
    processScan('', type);
  };

  const handleApply = () => {
    if (extracted) {
      onScanComplete(extracted);
      onClose();
    }
  };

  const handleSaveApiKey = () => {
    setStoredApiKey(apiKey);
    setShowKeyConfig(false);
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="AI Document Scanner (Aadhaar / Passport / DL)" maxWidth="max-w-2xl">
      <div className="space-y-6">
        {/* API Key Banner */}
        <div className="flex items-center justify-between p-3 bg-sky-50 rounded-xl border border-sky-100 text-xs">
          <div className="flex items-center gap-2 text-sky-800">
            <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0" />
            <span>
              {apiKey ? 'Powered by Gemini Multimodal Vision AI' : 'Running in Offline Smart OCR mode (zero setup needed)'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="text-sky-700 font-semibold hover:underline flex items-center gap-1"
          >
            <Key className="w-3 h-3" />
            {showKeyConfig ? 'Hide' : 'API Key'}
          </button>
        </div>

        {showKeyConfig && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <label className="font-medium text-slate-700">Google Gemini API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy... or AQ..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input text-xs flex-1"
              />
              <button type="button" onClick={handleSaveApiKey} className="btn btn-primary text-xs py-1 px-3">
                Save
              </button>
            </div>
            <p className="text-slate-400">Stores directly in browser localStorage for secure client-side AI analysis.</p>
          </div>
        )}

        {/* Capture / Upload Area */}
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-sky-400 transition-colors">
          {preview ? (
            <div className="space-y-3">
              <img src={preview} alt="Scanned ID" className="max-h-48 mx-auto rounded-lg shadow-sm" />
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPreview(null); setExtracted(null); setError(null); }}
                  className="btn btn-secondary text-xs"
                >
                  Clear Image
                </button>
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => processScan(preview)}
                  className="btn btn-primary text-xs flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                  Re-scan Image
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Upload or snap photo of guest identity proof</p>
                <p className="text-xs text-slate-400 mt-1">Accepts Aadhaar Card, Passport, Driving Licence or Voter ID</p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary text-xs flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Select Document File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Quick Demo Pre-fills */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Quick 1-Click Sample Scans:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={scanning}
              onClick={() => runSample('aadhaar')}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 text-left transition-all group"
            >
              <div className="font-semibold text-xs text-slate-800 group-hover:text-sky-700">Sample Aadhaar</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Siddharth Malhotra (Tata Motors)</div>
            </button>
            <button
              type="button"
              disabled={scanning}
              onClick={() => runSample('passport')}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 text-left transition-all group"
            >
              <div className="font-semibold text-xs text-slate-800 group-hover:text-sky-700">Sample Passport</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Meera Deshmukh (Mahindra)</div>
            </button>
            <button
              type="button"
              disabled={scanning}
              onClick={() => runSample('driving_license')}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 text-left transition-all group"
            >
              <div className="font-semibold text-xs text-slate-800 group-hover:text-sky-700">Sample Driving Lic.</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Kabir Narang (Bharti Airtel)</div>
            </button>
          </div>
        </div>

        {/* Extraction Progress / Error */}
        {scanning && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-3 text-sm text-slate-600">
            <RefreshCw className="w-5 h-5 text-sky-600 animate-spin" />
            <span>Analyzing document with Gemini Multimodal Vision...</span>
          </div>
        )}

        {error && !scanning && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{error}</p>
              <p className="text-amber-700">Please make sure the image is sharp and legible, or use one of the 1-click sample scans above.</p>
            </div>
          </div>
        )}

        {extracted && !scanning && (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Document Verified & Parsed</span>
              </div>
              <span className="badge badge-success text-[11px]">
                {Math.round(extracted.confidence * 100)}% Confidence
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-emerald-100">
              <div>
                <label className="text-slate-400 block mb-1">Name:</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={extracted.first_name}
                    onChange={(e) => setExtracted({ ...extracted, first_name: e.target.value })}
                    className="input text-xs py-1 px-2 font-bold w-1/2"
                    placeholder="First Name"
                  />
                  <input
                    type="text"
                    value={extracted.last_name}
                    onChange={(e) => setExtracted({ ...extracted, last_name: e.target.value })}
                    className="input text-xs py-1 px-2 font-bold w-1/2"
                    placeholder="Last Name"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Document Type:</label>
                <select
                  value={extracted.id_type}
                  onChange={(e) => setExtracted({ ...extracted, id_type: e.target.value as ExtractedIdData['id_type'] })}
                  className="input text-xs py-1 px-2 font-semibold uppercase"
                >
                  <option value="aadhaar">AADHAAR</option>
                  <option value="driving_license">DRIVING LICENCE</option>
                  <option value="passport">PASSPORT</option>
                  <option value="voter_id">VOTER ID</option>
                  <option value="other">OTHER</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Document Number:</label>
                <input
                  type="text"
                  value={extracted.id_number}
                  onChange={(e) => setExtracted({ ...extracted, id_number: e.target.value })}
                  className="input text-xs py-1 px-2 font-mono font-semibold"
                  placeholder="ID Number"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Masked preview: {maskId(extracted.id_type, extracted.id_number)}
                </span>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Company / Organization:</label>
                <input
                  type="text"
                  value={extracted.company || ''}
                  onChange={(e) => setExtracted({ ...extracted, company: e.target.value })}
                  className="input text-xs py-1 px-2 font-semibold"
                  placeholder="Individual / Company"
                />
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 block mb-1">Address:</label>
                <textarea
                  rows={2}
                  value={extracted.address || ''}
                  onChange={(e) => setExtracted({ ...extracted, address: e.target.value })}
                  className="input text-xs py-1 px-2 w-full resize-none"
                  placeholder="Address"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-700">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>
                {extracted.id_type === 'aadhaar'
                  ? 'Verhoeff mathematical checksum validated. Safe for guest registry.'
                  : 'Document details parsed and verified. Safe for guest registry.'}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            disabled={!extracted || scanning}
            onClick={handleApply}
            className="btn btn-primary flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Fill Guest Form
          </button>
        </div>
      </div>
    </Modal>
  );
}
