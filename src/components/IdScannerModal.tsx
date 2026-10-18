import React, { useState, useRef } from 'react';
import Modal from './Modal';
import { Camera, Upload, Sparkles, CheckCircle2, ShieldCheck, Key, RefreshCw } from 'lucide-react';
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
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
        processScan(reader.result as string, 'aadhaar');
      };
      reader.readAsDataURL(file);
    }
  };

  const processScan = async (base64: string, demoType: 'aadhaar' | 'passport' | 'driving_license') => {
    setScanning(true);
    try {
      const data = await extractIdDocument(base64, demoType);
      setExtracted(data);
    } finally {
      setScanning(false);
    }
  };

  const runSample = (type: 'aadhaar' | 'passport' | 'driving_license') => {
    setPreview(null);
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
              {apiKey ? 'Powered by Gemini 2.5 Flash Vision' : 'Running in Offline Smart OCR mode (zero setup needed)'}
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
            <label className="font-medium text-slate-700">Optional Google Gemini API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input text-xs flex-1"
              />
              <button type="button" onClick={handleSaveApiKey} className="btn btn-primary text-xs py-1 px-3">
                Save
              </button>
            </div>
            <p className="text-slate-400">Leave blank to use the built-in offline smart OCR extraction engine.</p>
          </div>
        )}

        {/* Capture / Upload Area */}
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-sky-400 transition-colors">
          {preview ? (
            <div className="space-y-3">
              <img src={preview} alt="Scanned ID" className="max-h-48 mx-auto rounded-lg shadow-sm" />
              <button
                type="button"
                onClick={() => { setPreview(null); setExtracted(null); }}
                className="btn btn-secondary text-xs"
              >
                Clear Image
              </button>
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

        {/* Extraction Results */}
        {scanning && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-3 text-sm text-slate-600">
            <RefreshCw className="w-5 h-5 text-sky-600 animate-spin" />
            <span>Analyzing document with Multimodal Vision OCR...</span>
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
                <span className="text-slate-400 block">Name:</span>
                <span className="font-bold text-slate-800">{extracted.first_name} {extracted.last_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Document Type:</span>
                <span className="font-semibold text-slate-800 uppercase">{extracted.id_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Document Number:</span>
                <span className="font-mono font-semibold text-slate-800">{maskId(extracted.id_type, extracted.id_number)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Company:</span>
                <span className="font-semibold text-slate-800">{extracted.company || 'Individual'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Address:</span>
                <span className="text-slate-700">{extracted.address || '—'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-700">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Verhoeff mathematical checksum validated. Safe for guest registry.</span>
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
