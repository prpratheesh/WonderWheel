import React, { useEffect, useRef, useState } from 'react';
import { getCachedImage, subscribeImages } from '../../services/imageCache';
import { renderHighlight, renderWheel, wheelMetrics } from '../../services/wheelRenderer';
import type { SegmentArc } from '../../services/wheelEngine';
import type { WheelDesign } from '../../types/wheel';
import { contrastText, shade } from '../../utils/colors';
import { Pointer } from '../Pointer/Pointer';
import type { SpinPhase } from '../../hooks/useWheelAnimation';

interface WheelProps {
  arcs: readonly SegmentArc[];
  design: WheelDesign;
  dimmedIds: ReadonlySet<string>;
  winningArc: SegmentArc | null;
  glowWinner: boolean;
  vibrateOnWin: boolean;
  phase: SpinPhase;
  rotorRef: React.RefObject<HTMLDivElement | null>;
  pointerKickRef?: React.RefObject<HTMLDivElement | null>;
  initialRotation?: number;
  performanceMode: boolean;
  onHubClick?: () => void;
  hubInteractive?: boolean;
  hubLabelOverride?: string;
}

export const Wheel: React.FC<WheelProps> = ({
  arcs,
  design,
  dimmedIds,
  winningArc,
  glowWinner,
  vibrateOnWin,
  phase,
  rotorRef,
  pointerKickRef,
  initialRotation = 0,
  performanceMode,
  onHubClick,
  hubInteractive = true,
  hubLabelOverride,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stageDim, setStageDim] = useState<number>(480);
  const [imgTick, setImgTick] = useState(0);

  // Measure available stage container
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const d = Math.floor(Math.min(rect.width, rect.height));
      if (d > 60) setStageDim(d);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-paint when decoded images finish loading
  useEffect(() => subscribeImages(() => setImgTick((n) => n + 1)), []);

  const pixelSize = Math.max(140, Math.round(stageDim * (design.size / 100)));
  // Cap DPR to avoid excessive GPU memory on 3x/4x displays
  const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const maxDpr = performanceMode ? 1.25 : pixelSize > 780 ? 1.75 : 2;
  const dpr = Math.min(rawDpr, maxDpr);

  // Paint the static wheel canvas only when configuration or size changes
  useEffect(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    renderWheel(canvas, {
      size: pixelSize,
      dpr,
      arcs,
      design,
      dimmed: dimmedIds,
      getImage: getCachedImage,
    });
  }, [pixelSize, dpr, arcs, design, dimmedIds, imgTick]);

  // Paint winning segment highlight overlay
  useEffect(() => {
    const canvas = highlightCanvasRef.current;
    if (!canvas) return;
    renderHighlight(
      canvas,
      { size: pixelSize, dpr, design },
      glowWinner ? winningArc : null,
    );
  }, [pixelSize, dpr, design, winningArc, glowWinner]);

  // Sync initial transform when mounting
  useEffect(() => {
    if (rotorRef.current && phase === 'idle' && !winningArc) {
      rotorRef.current.style.transform = `rotate3d(0, 0, 1, ${initialRotation.toFixed(3)}deg)`;
    }
  }, [initialRotation, phase, rotorRef, winningArc]);

  const metrics = wheelMetrics(pixelSize, design);
  const hubDiameter = Math.round(metrics.hubR * 2);
  const shadowAlpha = (design.shadow / 100) * 0.55;
  const hubText = hubLabelOverride ?? design.hubText;
  const hubTextColor = contrastText(design.hubColor);

  return (
    <div ref={stageRef} className="wheel-stage">
      <div
        className={`wheel-frame ${winningArc && vibrateOnWin ? 'wheel-frame--vibrate' : ''}`}
        style={{
          width: pixelSize,
          height: pixelSize,
          filter:
            design.shadow > 0 && !performanceMode
              ? `drop-shadow(0 ${Math.round(pixelSize * 0.028)}px ${Math.round(pixelSize * 0.055)}px rgba(10, 6, 30, ${shadowAlpha.toFixed(2)}))`
              : undefined,
        }}
      >
        <div ref={rotorRef} className="wheel-rotor">
          <canvas
            ref={wheelCanvasRef}
            className="wheel-canvas"
            style={{ width: pixelSize, height: pixelSize }}
          />
          <canvas
            ref={highlightCanvasRef}
            className={`wheel-highlight-canvas ${winningArc && glowWinner ? 'is-visible' : ''}`}
            style={{ width: pixelSize, height: pixelSize }}
          />
        </div>

        {/* Non-rotating glossy lighting overlay */}
        {design.gloss && !performanceMode && (
          <div className="wheel-gloss" aria-hidden="true" />
        )}

        {/* Center hub */}
        {design.hubStyle !== 'none' && hubDiameter > 16 && (
          <button
            type="button"
            className={`wheel-hub wheel-hub--${design.hubStyle} ${hubInteractive ? 'is-interactive' : ''}`}
            style={{
              width: hubDiameter,
              height: hubDiameter,
              background:
                design.hubStyle === 'gradient'
                  ? `radial-gradient(circle at 32% 28%, ${shade(design.hubColor, 0.38)}, ${design.hubColor} 62%, ${shade(design.hubColor, -0.35)})`
                  : design.hubColor,
              color: hubTextColor,
              borderWidth: Math.max(3, Math.round(hubDiameter * 0.075)),
            }}
            onClick={hubInteractive ? onHubClick : undefined}
            disabled={!hubInteractive || (phase !== 'idle' && phase !== 'freeSpin')}
            aria-label={phase === 'freeSpin' ? 'Stop wheel' : 'Spin wheel'}
          >
            {design.hubStyle === 'star' && (
              <svg viewBox="0 0 100 100" className="wheel-hub__star" aria-hidden="true">
                <polygon
                  points="50,8 61,36 91,38 67,57 75,87 50,70 25,87 33,57 9,38 39,36"
                  fill={shade(design.hubColor, 0.32)}
                  opacity="0.45"
                />
              </svg>
            )}
            {hubText && (
              <span
                className="wheel-hub__text"
                style={{ fontSize: Math.max(11, Math.round(hubDiameter * 0.22)) }}
              >
                {hubText}
              </span>
            )}
          </button>
        )}

        {/* Fixed pointer */}
        <Pointer
          position={design.pointerPosition}
          styleType={design.pointerStyle}
          color={design.pointerColor}
          size={pixelSize}
          kickRef={pointerKickRef}
        />
      </div>
    </div>
  );
};

