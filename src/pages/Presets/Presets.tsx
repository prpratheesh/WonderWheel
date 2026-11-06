import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Edit3,
  FolderOpen,
  Plus,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { TEMPLATES } from '../../services/defaults';
import { buildExport, downloadJson, importFile, safeFileName } from '../../services/exportImport';
import { generateShareLink } from '../../services/shareService';
import { getTheme } from '../../services/themes';
import type { WheelConfig } from '../../types/wheel';

interface PresetsProps {
  wheels: WheelConfig[];
  activeId: string;
  onSelectWheel: (id: string) => void;
  onCreateFromTemplate: (key: string, customName?: string) => Promise<WheelConfig>;
  onDuplicateWheel: (id: string) => Promise<void>;
  onRenameWheel: (id: string, name: string) => Promise<void>;
  onDeleteWheel: (id: string) => Promise<void>;
  onImportWheels: (imported: WheelConfig[], replaceExisting: boolean) => Promise<void>;
  onOpenWheel?: () => void;
  embedded?: boolean;
}

export const Presets: React.FC<PresetsProps> = ({
  wheels,
  activeId,
  onSelectWheel,
  onCreateFromTemplate,
  onDuplicateWheel,
  onRenameWheel,
  onDeleteWheel,
  onImportWheels,
  onOpenWheel,
  embedded = false,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WheelConfig | null>(null);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleShareLink = async (wheel: WheelConfig) => {
    try {
      const link = await generateShareLink(wheel);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        // Fallback for older browsers
        const input = document.createElement('textarea');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedId(wheel.id);
      setTimeout(() => setCopiedId(null), 3000);
    } catch {
      setError('Could not copy share link to clipboard.');
    }
  };

  const handleExportOne = async (wheel: WheelConfig) => {
    setBusy(true);
    try {
      const payload = await buildExport([wheel]);
      downloadJson(payload, `classspin-${safeFileName(wheel.name)}.json`);
    } finally {
      setBusy(false);
    }
  };

  const handleExportAll = async () => {
    setBusy(true);
    try {
      const payload = await buildExport(wheels);
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(payload, `classspin-backup-${date}.json`);
    } finally {
      setBusy(false);
    }
  };

  const handleImportChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const imported = await importFile(file, !replaceOnImport);
      await onImportWheels(imported, replaceOnImport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import file.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const startRename = (w: WheelConfig) => {
    setEditingId(w.id);
    setEditName(w.name);
  };

  const commitRename = async (id: string) => {
    if (editName.trim()) await onRenameWheel(id, editName.trim());
    setEditingId(null);
  };

  return (
    <div className={embedded ? 'settings-section' : 'page-container'}>
      <div className="section-header">
        <div>
          <h2>Saved Wheels & Classroom Presets</h2>
          <p className="muted">
            Create, load, duplicate, rename, export or restore classroom wheels. All uploaded images are embedded inside JSON backups.
          </p>
        </div>
        <div className="toolbar-row">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => void handleImportChange(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload size={16} />
            <span>Import JSON</span>
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void handleExportAll()}
            disabled={busy}
          >
            <Download size={16} />
            <span>Backup All ({wheels.length})</span>
          </button>
        </div>
      </div>

      <div className="import-mode-row">
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={replaceOnImport}
            onChange={(e) => setReplaceOnImport(e.target.checked)}
          />
          <span>When importing, replace all existing wheels (restore mode)</span>
        </label>
      </div>

      {error && <div className="callout callout--danger">{error}</div>}

      <div className="preset-grid">
        {wheels.map((w) => {
          const isActive = w.id === activeId;
          const theme = getTheme(w.design.themeId);
          return (
            <div
              key={w.id}
              className={`preset-card ${isActive ? 'is-active' : ''}`}
            >
              <div className="preset-card__swatch-bar">
                {w.segments.slice(0, 12).map((s) => (
                  <span key={s.id} style={{ background: s.bgColor }} />
                ))}
              </div>

              <div className="preset-card__body">
                {editingId === w.id ? (
                  <div className="preset-card__rename">
                    <input
                      type="text"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename(w.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      onClick={() => void commitRename(w.id)}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="preset-card__title-row">
                    <h3>{w.name}</h3>
                    {isActive && <span className="pill-badge">Active</span>}
                  </div>
                )}

                <div className="preset-card__meta">
                  <span>{w.segments.length} partitions</span>
                  <span>•</span>
                  <span>{theme.name} theme</span>
                  <span>•</span>
                  <span>{w.animation.duration}s spin</span>
                </div>

                <div className="preset-card__samples">
                  {w.segments.slice(0, 5).map((s) => (
                    <span key={s.id} className="sample-chip">
                      {s.title}
                    </span>
                  ))}
                  {w.segments.length > 5 && (
                    <span className="sample-chip sample-chip--more">
                      +{w.segments.length - 5} more
                    </span>
                  )}
                </div>
              </div>

              <div className="preset-card__actions">
                <button
                  type="button"
                  className={`btn btn--sm ${isActive ? 'btn--secondary' : 'btn--primary'}`}
                  onClick={() => {
                    onSelectWheel(w.id);
                    onOpenWheel?.();
                  }}
                >
                  <FolderOpen size={15} />
                  <span>{isActive ? 'Loaded' : 'Load Wheel'}</span>
                </button>
                <button
                  type="button"
                  className={`icon-action ${copiedId === w.id ? 'is-copied' : ''}`}
                  onClick={() => void handleShareLink(w)}
                  title={copiedId === w.id ? 'Share link copied!' : 'Copy Shareable Link for another device'}
                  aria-label="Share wheel via link"
                >
                  {copiedId === w.id ? <Check size={16} color="#10b981" /> : <Share2 size={16} />}
                </button>
                <button
                  type="button"
                  className="icon-action"
                  onClick={() => startRename(w)}
                  title="Rename wheel"
                  aria-label="Rename wheel"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  type="button"
                  className="icon-action"
                  onClick={() => void onDuplicateWheel(w.id)}
                  title="Duplicate wheel"
                  aria-label="Duplicate wheel"
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className="icon-action"
                  onClick={() => void handleExportOne(w)}
                  title="Export this wheel as JSON"
                  aria-label="Export wheel"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  className="icon-action icon-action--danger"
                  onClick={() => setDeleteTarget(w)}
                  disabled={wheels.length <= 1}
                  title={wheels.length <= 1 ? 'Cannot delete the only wheel' : 'Delete wheel'}
                  aria-label="Delete wheel"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="templates-block">
        <h3>Quick-Start Classroom Templates</h3>
        <p className="muted">
          Click any template to create a new ready-to-spin classroom wheel:
        </p>
        <div className="template-pills">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              className="template-pill"
              onClick={() => void onCreateFromTemplate(t.key)}
            >
              <span className="template-pill__emoji">{t.emoji}</span>
              <span>{t.name}</span>
              <Plus size={15} />
            </button>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Saved Wheel?"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name ?? ''}"?`}
        confirmLabel="Delete Wheel"
        onConfirm={() => {
          if (deleteTarget) void onDeleteWheel(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

