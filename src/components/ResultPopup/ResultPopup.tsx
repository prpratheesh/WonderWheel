import React, { useEffect, useState } from 'react';
import { RotateCw, SkipForward, X, Maximize2, Minimize2 } from 'lucide-react';
import { useImageUrl } from '../../hooks/useImageUrl';
import type { Segment } from '../../types/segment';
import type { ResultSettings } from '../../types/wheel';
import { contrastText, shade } from '../../utils/colors';

interface ResultPopupProps {
  winner: Segment | null;
  settings: ResultSettings;
  popupAnimation: boolean;
  imageAnimation: boolean;
  backgroundCelebration: boolean;
  reducedMotion: boolean;
  onSpinAgain: () => void;
  onNextSelection: () => void;
  onClose: () => void;
}

export const ResultPopup: React.FC<ResultPopupProps> = ({
  winner,
  settings,
  popupAnimation,
  imageAnimation,
  backgroundCelebration,
  reducedMotion,
  onSpinAgain,
  onNextSelection,
  onClose,
}) => {
  const imageUrl = useImageUrl(winner?.imageId);
  const [expanded, setExpanded] = useState(settings.fullScreenResult);

  useEffect(() => {
    setExpanded(settings.fullScreenResult);
  }, [settings.fullScreenResult, winner?.id]);

  // Auto-close timer if configured
  useEffect(() => {
    if (!winner || settings.autoCloseSeconds <= 0) return;
    const t = setTimeout(onClose, settings.autoCloseSeconds * 1000);
    return () => clearTimeout(t);
  }, [winner, settings.autoCloseSeconds, onClose]);

  if (!winner || !settings.showPopup) return null;

  const badgeBg = winner.bgColor;
  const badgeText = contrastText(badgeBg);
  const animateCard = popupAnimation && !reducedMotion;
  const animateImg = imageAnimation && !reducedMotion;

  return (
    <div
      className={`result-backdrop ${backgroundCelebration && !reducedMotion ? 'result-backdrop--celebrate' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-winner-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`result-card ${expanded ? 'result-card--fullscreen' : ''} ${animateCard ? 'result-card--animate' : ''}`}
        style={{
          '--winner-color': badgeBg,
          '--winner-dark': shade(badgeBg, -0.25),
        } as React.CSSProperties}
      >
        <div className="result-card__top-actions">
          <button
            type="button"
            className="result-card__icon-btn"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Standard popup size' : 'Large full-screen presentation'}
            aria-label={expanded ? 'Shrink result view' : 'Expand result view'}
          >
            {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            type="button"
            className="result-card__icon-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close result"
          >
            <X size={20} />
          </button>
        </div>

        <div className="result-card__heading">{settings.heading || '🎉 CONGRATULATIONS! 🎉'}</div>

        {imageUrl && (
          <div className={`result-card__media ${animateImg ? 'result-card__media--bounce' : ''}`}>
            <img
              src={imageUrl}
              alt={winner.title || 'Selected segment'}
              style={{ objectFit: winner.imageFit }}
            />
          </div>
        )}

        <div
          id="result-winner-title"
          className="result-card__winner-pill"
          style={{ background: badgeBg, color: badgeText }}
        >
          {winner.title || 'Winner!'}
        </div>

        {winner.subtitle && (
          <p className="result-card__subtitle">{winner.subtitle}</p>
        )}

        <div className="result-card__actions">
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={onSpinAgain}
          >
            <RotateCw size={20} />
            <span>SPIN AGAIN</span>
          </button>

          <button
            type="button"
            className="btn btn--accent btn--lg"
            onClick={onNextSelection}
            title="Remove this choice for the next spin and spin again"
          >
            <SkipForward size={20} />
            <span>NEXT SELECTION</span>
          </button>

          <button
            type="button"
            className="btn btn--ghost btn--lg"
            onClick={onClose}
          >
            <span>CLOSE</span>
          </button>
        </div>
      </div>
    </div>
  );
};

