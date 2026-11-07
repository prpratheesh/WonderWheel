import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RotateCcw,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  FolderKanban,
  Save,
  ArrowLeft,
  Share2,
  Sparkles,
  EyeOff,
  Repeat,
} from 'lucide-react';
import { Celebration, type CelebrationBurst } from '../../components/Celebration/Celebration';
import { FullScreenToggle } from '../../components/FullScreen/FullScreenToggle';
import { ResultPopup } from '../../components/ResultPopup/ResultPopup';
import { SpinButton } from '../../components/SpinButton/SpinButton';
import { Wheel } from '../../components/Wheel/Wheel';
import type { AppStore } from '../../hooks/useAppStore';
import { useImageUrl } from '../../hooks/useImageUrl';
import { useWheelAnimation } from '../../hooks/useWheelAnimation';
import { sound } from '../../services/soundEngine';
import { getTheme } from '../../services/themes';
import { computeArcs, eligibleArcs, type SegmentArc } from '../../services/wheelEngine';
import { generateShareLink } from '../../services/shareService';
import type { Segment } from '../../types/segment';
import { isTypingTarget } from '../../utils/misc';

interface HomeProps {
  store: AppStore;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onExitFullScreen: () => void;
}

export const Home: React.FC<HomeProps> = ({
  store,
  isFullScreen,
  onToggleFullScreen,
  onExitFullScreen,
}) => {
  const wheel = store.displayedWheel;
  const [popupWinner, setPopupWinner] = useState<Segment | null>(null);
  const [lastSelected, setLastSelected] = useState<Segment | null>(null);
  const [burst, setBurst] = useState<CelebrationBurst | null>(null);

  const handleShareCurrentWheel = async () => {
    if (!wheel) return;
    try {
      const link = await generateShareLink(wheel);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement('textarea');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      store.showToast('Share link copied to clipboard!');
    } catch {
      store.showToast('Could not generate share link.');
    }
  };

  const emptySet = useMemo(() => new Set<string>(), []);
  const noRepeatActive = Boolean(wheel?.result.removeWinner || wheel?.result.hideSelected);
  const hideSelectedActive = Boolean(wheel?.result.hideSelected);

  const fullArcs = useMemo(
    () => (wheel ? computeArcs(wheel.segments, wheel.design.sizeByWeight) : []),
    [wheel],
  );

  const arcs = useMemo(
    () =>
      wheel
        ? computeArcs(
            wheel.segments,
            wheel.design.sizeByWeight,
            hideSelectedActive ? store.excludedIds : undefined,
          )
        : [],
    [wheel, hideSelectedActive, store.excludedIds],
  );

  const totalSessionEligible = useMemo(
    () => eligibleArcs(fullArcs, emptySet),
    [fullArcs, emptySet],
  );

  const eligible = useMemo(
    () => eligibleArcs(arcs, store.excludedIds),
    [arcs, store.excludedIds],
  );

  const isSessionComplete =
    totalSessionEligible.length > 0 && eligible.length === 0 && store.excludedIds.size > 0;

  const handleWin = useCallback(
    (segment: Segment, _arc: SegmentArc) => {
      if (!wheel) return;
      setLastSelected(segment);
      if (wheel.result.showPopup) {
        setPopupWinner(segment);
      }
      store.recordWin(segment, wheel.result.removeWinner || wheel.result.hideSelected);
      sound.win();
      const fx = wheel.animation.effects;
      if (fx.confetti || fx.fireworks || fx.stars || fx.sparkles) {
        sound.celebrate();
        const theme = getTheme(wheel.design.themeId);
        setBurst({ id: Date.now(), colors: theme.palette });
      }
    },
    [store, wheel],
  );

  const anim = useWheelAnimation({
    arcs,
    excludedIds: store.excludedIds,
    animation: wheel?.animation ?? {
      duration: 6,
      revolutions: 6,
      direction: 'cw',
      easing: 'smooth',
      acceleration: 0.08,
      deceleration: 3,
      stopBehaviour: 'smooth',
      spinMode: 'auto',
      effects: {
        confetti: true,
        fireworks: false,
        stars: true,
        sparkles: true,
        glow: true,
        pointerBounce: true,
        vibration: true,
        popupAnimation: true,
        imageAnimation: true,
        backgroundCelebration: true,
      },
      intensity: 'medium',
    },
    pointerPosition: wheel?.design.pointerPosition ?? 'top',
    showLiveLabel: wheel?.result.showLiveLabel ?? true,
    hideUntilStop: wheel?.result.hideUntilStop ?? false,
    reducedMotion: store.effectiveReducedMotion,
    onWin: handleWin,
    onSlowDeviceDetected: store.markSlowDevice,
  });

  const triggerSpin = useCallback(() => {
    setPopupWinner(null);
    if (isSessionComplete && fullArcs.length > 0) {
      store.startNextSession();
      anim.startSpin(fullArcs, emptySet);
    } else {
      anim.startSpin();
    }
  }, [anim, emptySet, fullArcs, isSessionComplete, store]);

  const handleSpinAgain = useCallback(() => {
    setPopupWinner(null);
    setTimeout(() => {
      if (isSessionComplete && fullArcs.length > 0) {
        store.startNextSession();
        anim.startSpin(fullArcs, emptySet);
      } else {
        anim.startSpin();
      }
    }, 40);
  }, [anim, emptySet, fullArcs, isSessionComplete, store]);

  const handleNextSelection = useCallback(() => {
    const nextExcluded = new Set(store.excludedIds);
    if (popupWinner) {
      store.excludeSegment(popupWinner.id);
      nextExcluded.add(popupWinner.id);
    }
    setPopupWinner(null);
    setTimeout(() => {
      const nextArcs = wheel
        ? computeArcs(
            wheel.segments,
            wheel.design.sizeByWeight,
            hideSelectedActive ? nextExcluded : undefined,
          )
        : [];
      const nextPool = eligibleArcs(nextArcs, nextExcluded);
      if (nextPool.length === 0 && fullArcs.length > 0) {
        store.startNextSession();
        anim.startSpin(fullArcs, emptySet);
      } else {
        anim.startSpin(nextArcs, nextExcluded);
      }
    }, 50);
  }, [anim, emptySet, fullArcs, hideSelectedActive, popupWinner, store, wheel]);

  // Classroom keyboard shortcuts: Space, R, M, Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (anim.phase === 'freeSpin') {
          anim.stopManualSpin();
        } else if (anim.phase === 'idle') {
          triggerSpin();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (anim.phase === 'idle') {
          e.preventDefault();
          triggerSpin();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        store.updatePrefs({ muted: !store.prefs.muted });
      } else if (e.key === 'Escape') {
        if (popupWinner) {
          setPopupWinner(null);
        } else if (isFullScreen) {
          onExitFullScreen();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anim, isFullScreen, onExitFullScreen, popupWinner, store, triggerSpin]);

  const bgImageUrl = useImageUrl(
    wheel?.design.background.type === 'image' ? wheel.design.background.imageId : null,
  );

  if (!wheel) return null;

  const theme = getTheme(wheel.design.themeId);
  const bg = wheel.design.background;
  let stageBackground: string;
  if (bg.type === 'color') {
    stageBackground = bg.color;
  } else if (bg.type === 'gradient') {
    stageBackground = `radial-gradient(circle at 50% 38%, ${bg.gradientFrom}, ${bg.gradientTo})`;
  } else if (bg.type === 'image' && bgImageUrl) {
    const alpha = (bg.overlay / 100).toFixed(2);
    stageBackground = `linear-gradient(rgba(12, 10, 29, ${alpha}), rgba(12, 10, 29, ${alpha})), url("${bgImageUrl}") center / cover no-repeat`;
  } else {
    stageBackground = `radial-gradient(circle at 50% 38%, ${theme.bgFrom}, ${theme.bgTo})`;
  }

  return (
    <section
      className={`wheel-screen ${isFullScreen ? 'wheel-screen--fullscreen' : ''}`}
      style={{ background: stageBackground }}
    >
      {/* Preview banner when testing unsaved settings */}
      {store.previewingDraft && !isFullScreen && (
        <div className="preview-banner">
          <span>
            <Sparkles size={16} /> Previewing unsaved settings for <strong>{wheel.name}</strong>
          </span>
          <div className="preview-banner__actions">
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => store.navigate('settings')}
            >
              <ArrowLeft size={14} />
              <span>Back to Settings</span>
            </button>
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => void store.saveDraftToWheel()}
            >
              <Save size={14} />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Top HUD bar */}
      <div className="wheel-hud">
        <div className="wheel-hud__left">
          {!isFullScreen ? (
            <label className="wheel-switcher" title="Switch active classroom wheel">
              <span className="sr-only">Active Wheel</span>
              <select
                value={store.activeId}
                onChange={(e) => {
                  setPopupWinner(null);
                  setLastSelected(null);
                  store.selectWheel(e.target.value);
                }}
              >
                {store.wheels.map((w) => (
                  <option key={w.id} value={w.id}>
                    🎡 {w.name} ({w.segments.length})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="fullscreen-wheel-title">{wheel.name}</div>
          )}

          <button
            type="button"
            className={`hud-pill hud-pill--toggle ${noRepeatActive ? 'is-active' : ''}`}
            onClick={() => {
              const next = !noRepeatActive;
              void store.updateWheelResultSettings({
                removeWinner: next,
                hideSelected: next ? wheel.result.hideSelected : false,
              });
              store.showToast(
                next
                  ? 'No-Repeat enabled: options will not repeat in the same session'
                  : 'No-Repeat disabled: all options can appear on every spin',
              );
            }}
            title="Do not repeat answers which already occurred once until the next session"
          >
            <Repeat size={14} />
            <span>No Repeat: {noRepeatActive ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            className={`hud-pill hud-pill--toggle ${hideSelectedActive ? 'is-active' : ''}`}
            onClick={() => {
              const next = !hideSelectedActive;
              void store.updateWheelResultSettings({
                hideSelected: next,
                removeWinner: next ? true : wheel.result.removeWinner,
              });
              store.showToast(
                next
                  ? 'Hide Selected enabled: selected options are completely hidden until next session'
                  : 'Hide Selected disabled: selected options remain visible on the wheel',
              );
            }}
            title="Completely hide the selected option from the wheel once selected"
          >
            <EyeOff size={14} />
            <span>Hide Selected: {hideSelectedActive ? 'ON' : 'OFF'}</span>
          </button>

          {(noRepeatActive || store.excludedIds.size > 0) && (
            <button
              type="button"
              className="hud-pill hud-pill--action"
              onClick={store.resetExclusions}
              title="Click to reset session and restore all options immediately"
            >
              <RotateCcw size={14} />
              <span>
                Session #{store.sessionRound} ({eligible.length}/{totalSessionEligible.length} left)
              </span>
            </button>
          )}
        </div>

        {/* Live pointer / selected result pill */}
        <div className="wheel-hud__center" aria-live="polite">
          <div className="live-banner">
            <span className="live-banner__dot" style={{ background: theme.accent }} />
            <span ref={anim.liveLabelRef} className="live-banner__text">
              {lastSelected?.title ?? wheel.segments[0]?.title ?? 'Ready to Spin!'}
            </span>
          </div>
        </div>

        <div className="wheel-hud__right">
          <button
            type="button"
            className="icon-btn"
            onClick={() => store.updatePrefs({ muted: !store.prefs.muted })}
            title={store.prefs.muted ? 'Unmute sounds (M)' : 'Mute sounds (M)'}
            aria-label={store.prefs.muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {store.prefs.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            <span className="icon-btn__label">{store.prefs.muted ? 'Muted' : 'Sound'}</span>
          </button>

          {!isFullScreen && (
            <>
              <button
                type="button"
                className="icon-btn"
                onClick={() => void handleShareCurrentWheel()}
                title="Share this wheel via link to another device"
                aria-label="Share wheel"
              >
                <Share2 size={20} />
                <span className="icon-btn__label">Share</span>
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => store.navigate('presets')}
                title="Saved wheels & templates"
              >
                <FolderKanban size={20} />
                <span className="icon-btn__label">Presets</span>
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => store.navigate('settings')}
                title="Customize wheel settings"
              >
                <SettingsIcon size={20} />
                <span className="icon-btn__label">Settings</span>
              </button>
            </>
          )}

          <FullScreenToggle isFullScreen={isFullScreen} onToggle={onToggleFullScreen} />
        </div>
      </div>

      {/* Main Wheel Center Stage */}
      <div className="wheel-center-area">
        <Wheel
          arcs={isSessionComplete && hideSelectedActive ? fullArcs : arcs}
          design={wheel.design}
          dimmedIds={store.excludedIds}
          winningArc={hideSelectedActive ? null : anim.winningArc}
          glowWinner={wheel.animation.effects.glow}
          vibrateOnWin={wheel.animation.effects.vibration && !store.effectiveReducedMotion}
          phase={anim.phase}
          rotorRef={anim.rotorRef}
          pointerKickRef={anim.pointerKickRef}
          performanceMode={store.effectivePerformanceMode}
          onHubClick={() => {
            if (anim.phase === 'freeSpin') anim.stopManualSpin();
            else triggerSpin();
          }}
          hubLabelOverride={anim.phase === 'freeSpin' ? 'STOP' : undefined}
        />
      </div>

      {/* Bottom control dock */}
      <div className="wheel-dock">
        {isSessionComplete && anim.phase === 'idle' && (
          <div className="session-complete-pill">
            <span>
              🎉 Session #{store.sessionRound} complete! All {totalSessionEligible.length} options occurred once. Next spin starts Session #{store.sessionRound + 1}!
            </span>
          </div>
        )}
        <SpinButton
          phase={anim.phase}
          spinMode={wheel.animation.spinMode}
          disabled={totalSessionEligible.length === 0}
          onSpin={triggerSpin}
          onStop={anim.stopManualSpin}
        />

        {lastSelected && anim.phase === 'idle' && (
          <button
            type="button"
            className="last-winner-chip"
            onClick={() => setPopupWinner(lastSelected)}
            title="Click to re-open winner screen"
          >
            <span
              className="color-dot"
              style={{ background: lastSelected.bgColor }}
            />
            <span>Selected:</span>
            <strong>{lastSelected.title}</strong>
          </button>
        )}

        <div className="shortcut-hint" aria-hidden="true">
          <span>Space</span> Spin • <span>R</span> Repeat • <span>M</span> Sound • <span>Esc</span> Exit Full Screen
        </div>
      </div>

      {/* Celebration particle canvas */}
      <Celebration
        burst={burst}
        effects={wheel.animation.effects}
        intensity={wheel.animation.intensity}
        reducedMotion={store.effectiveReducedMotion}
        performanceMode={store.effectivePerformanceMode}
      />

      {/* Winner presentation popup */}
      <ResultPopup
        winner={popupWinner}
        settings={wheel.result}
        popupAnimation={wheel.animation.effects.popupAnimation}
        imageAnimation={wheel.animation.effects.imageAnimation}
        backgroundCelebration={wheel.animation.effects.backgroundCelebration}
        reducedMotion={store.effectiveReducedMotion}
        onSpinAgain={handleSpinAgain}
        onNextSelection={handleNextSelection}
        onClose={() => setPopupWinner(null)}
      />
    </section>
  );
};

