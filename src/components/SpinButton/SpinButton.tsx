import React from 'react';
import { Play, Square, RotateCw } from 'lucide-react';
import type { SpinPhase } from '../../hooks/useWheelAnimation';
import type { SpinMode } from '../../types/animation';

interface SpinButtonProps {
  phase: SpinPhase;
  spinMode: SpinMode;
  disabled: boolean;
  onSpin: () => void;
  onStop: () => void;
  size?: 'lg' | 'md';
}

export const SpinButton: React.FC<SpinButtonProps> = ({
  phase,
  spinMode,
  disabled,
  onSpin,
  onStop,
  size = 'lg',
}) => {
  const isFreeSpin = phase === 'freeSpin';
  const isBusy = phase === 'spinning' || phase === 'stopping';

  const handleClick = () => {
    if (isFreeSpin) onStop();
    else if (phase === 'idle') onSpin();
  };

  return (
    <button
      type="button"
      className={`spin-cta spin-cta--${size} ${isFreeSpin ? 'spin-cta--stop' : ''} ${isBusy ? 'spin-cta--busy' : ''}`}
      disabled={disabled || isBusy}
      onClick={handleClick}
      aria-label={isFreeSpin ? 'Stop the wheel' : 'Spin the wheel'}
    >
      <span className="spin-cta__shine" aria-hidden="true" />
      <span className="spin-cta__icon" aria-hidden="true">
        {isFreeSpin ? (
          <Square size={22} fill="currentColor" />
        ) : isBusy ? (
          <RotateCw size={22} className="spin-cta__spinner" />
        ) : (
          <Play size={22} fill="currentColor" />
        )}
      </span>
      <span className="spin-cta__label">
        {isFreeSpin
          ? 'STOP!'
          : isBusy
            ? 'SPINNING…'
            : spinMode === 'manual'
              ? 'START SPIN'
              : 'SPIN!'}
      </span>
    </button>
  );
};

