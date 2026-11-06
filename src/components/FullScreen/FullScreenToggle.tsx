import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullScreenToggleProps {
  isFullScreen: boolean;
  onToggle: () => void;
}

export const FullScreenToggle: React.FC<FullScreenToggleProps> = ({ isFullScreen, onToggle }) => (
  <button
    type="button"
    className="icon-btn"
    onClick={onToggle}
    title={isFullScreen ? 'Exit full screen (Esc)' : 'Full-screen classroom mode'}
    aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
  >
    {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
    <span className="icon-btn__label">{isFullScreen ? 'Exit Full Screen' : 'Full Screen'}</span>
  </button>
);

