import React, { useMemo, useState } from 'react';
import { ArrowLeft, Eye, RotateCcw, Save, Play } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import {
  SettingsPanel,
  type SettingsTab,
} from '../../components/SettingsPanel/SettingsPanel';
import { Wheel } from '../../components/Wheel/Wheel';
import type { AppStore } from '../../hooks/useAppStore';
import { useWheelAnimation } from '../../hooks/useWheelAnimation';
import { computeArcs } from '../../services/wheelEngine';
import type { SoundKey } from '../../types/settings';

interface SettingsPageProps {
  store: AppStore;
  onTestSound: (key: SoundKey) => void;
}

const emptySet = new Set<string>();

export const Settings: React.FC<SettingsPageProps> = ({ store, onTestSound }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const wheel = store.draft ?? store.savedWheel;
  const activeTab = (store.prefs.settingsTab as SettingsTab) || 'general';

  const arcs = useMemo(
    () => (wheel ? computeArcs(wheel.segments, wheel.design.sizeByWeight) : []),
    [wheel],
  );

  const previewAnim = useWheelAnimation({
    arcs,
    excludedIds: emptySet,
    animation: wheel
      ? {
          ...wheel.animation,
          duration: Math.min(3, wheel.animation.duration),
          revolutions: Math.min(3, wheel.animation.revolutions),
        }
      : {
          duration: 2,
          revolutions: 2,
          direction: 'cw',
          easing: 'smooth',
          acceleration: 0.06,
          deceleration: 3,
          stopBehaviour: 'smooth',
          spinMode: 'auto',
          effects: {
            confetti: false,
            fireworks: false,
            stars: false,
            sparkles: false,
            glow: true,
            pointerBounce: true,
            vibration: false,
            popupAnimation: false,
            imageAnimation: false,
            backgroundCelebration: false,
          },
          intensity: 'low',
        },
    pointerPosition: wheel?.design.pointerPosition ?? 'top',
    showLiveLabel: true,
    hideUntilStop: false,
    reducedMotion: store.effectiveReducedMotion,
    onWin: () => undefined,
  });

  if (!wheel) return null;

  return (
    <div className="settings-page">
      <div className="settings-topbar">
        <div className="settings-topbar__left">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              store.setPreviewingDraft(false);
              store.navigate('wheel');
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Wheel</span>
          </button>
          <div className="settings-topbar__title">
            <h1>Wheel Settings</h1>
            {store.isDirty && (
              <span className="unsaved-pill">Unsaved edits</span>
            )}
          </div>
        </div>

        <div className="settings-topbar__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              store.setPreviewingDraft(true);
              store.navigate('wheel');
            }}
            title="Test your unsaved settings on the full classroom wheel"
          >
            <Eye size={16} />
            <span>Preview on Main Wheel</span>
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setConfirmReset(true)}
            title="Reset current wheel to defaults"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>

          {store.isDirty && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={store.discardDraft}
            >
              Discard
            </button>
          )}

          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => void store.saveDraftToWheel()}
          >
            <Save size={16} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <div className="settings-workspace">
        <SettingsPanel
          activeTab={activeTab}
          onTabChange={(tab) => store.updatePrefs({ settingsTab: tab })}
          wheel={wheel}
          onChange={store.updateDraft}
          appSettings={store.appSettings}
          onUpdateAppSettings={store.updateAppSettings}
          muted={store.prefs.muted}
          onToggleMute={() => store.updatePrefs({ muted: !store.prefs.muted })}
          onTestSound={onTestSound}
          wheels={store.wheels}
          activeWheelId={store.activeId}
          onSelectWheel={store.selectWheel}
          onCreateFromTemplate={store.createFromTemplate}
          onDuplicateWheel={store.duplicateWheel}
          onRenameWheel={store.renameWheel}
          onDeleteWheel={store.deleteWheel}
          onImportWheels={store.addImportedWheels}
        />

        <aside className="settings-preview-pane" aria-label="Live wheel preview">
          <div className="preview-card">
            <div className="preview-card__header">
              <div>
                <strong>Live Wheel Preview</strong>
                <span className="muted">{wheel.name}</span>
              </div>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={() => previewAnim.startSpin()}
                disabled={previewAnim.phase !== 'idle'}
              >
                <Play size={14} fill="currentColor" />
                <span>Test Spin</span>
              </button>
            </div>
            <div className="preview-card__stage">
              <Wheel
                arcs={arcs}
                design={wheel.design}
                dimmedIds={emptySet}
                winningArc={previewAnim.winningArc}
                glowWinner={wheel.animation.effects.glow}
                vibrateOnWin={false}
                phase={previewAnim.phase}
                rotorRef={previewAnim.rotorRef}
                pointerKickRef={previewAnim.pointerKickRef}
                performanceMode={store.effectivePerformanceMode}
                onHubClick={() => previewAnim.startSpin()}
              />
            </div>
            <div className="preview-card__footer">
              <span>Pointer read-out:</span>
              <strong ref={previewAnim.liveLabelRef} className="preview-card__readout">
                —
              </strong>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset Wheel to Default?"
        message="This will replace the current wheel's partitions and design with the default Student Names template. You can still cancel before saving."
        confirmLabel="Reset Wheel"
        onConfirm={() => {
          setConfirmReset(false);
          store.resetCurrentToDefault();
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
};

