import React from 'react';
import type { PointerPosition, PointerStyle } from '../../types/wheel';
import { shade } from '../../utils/colors';

interface PointerProps {
  position: PointerPosition;
  styleType: PointerStyle;
  color: string;
  size: number;
  kickRef?: React.RefObject<HTMLDivElement | null>;
}

const POS_ROTATION: Record<PointerPosition, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
};

export const Pointer: React.FC<PointerProps> = ({ position, styleType, color, size, kickRef }) => {
  const w = Math.max(36, Math.round(size * 0.095));
  const h = Math.max(44, Math.round(size * 0.115));
  const dark = shade(color, -0.32);
  const light = shade(color, 0.38);

  return (
    <div
      className={`wheel-pointer wheel-pointer--${position}`}
      style={{
        width: w,
        height: h,
        transform: `rotate(${POS_ROTATION[position]}deg)`,
      }}
      aria-hidden="true"
    >
      <div ref={kickRef} className="wheel-pointer__kick">
        <svg viewBox="0 0 64 80" width={w} height={h} className="wheel-pointer__svg">
          <defs>
            <linearGradient id={`ptrGrad-${position}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={light} />
              <stop offset="55%" stopColor={color} />
              <stop offset="100%" stopColor={dark} />
            </linearGradient>
          </defs>
          {styleType === 'classic' && (
            <>
              <path
                d="M10 8 H54 A6 6 0 0 1 59 17 L36 71 A4.5 4.5 0 0 1 28 71 L5 17 A6 6 0 0 1 10 8 Z"
                fill={`url(#ptrGrad-${position})`}
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <circle cx="32" cy="22" r="7" fill="#ffffff" opacity="0.92" />
            </>
          )}
          {styleType === 'arrow' && (
            <path
              d="M22 6 H42 V36 H56 L32 74 L8 36 H22 Z"
              fill={`url(#ptrGrad-${position})`}
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          )}
          {styleType === 'pin' && (
            <>
              <path
                d="M32 74 C24 54 10 42 10 26 A22 22 0 1 1 54 26 C54 42 40 54 32 74 Z"
                fill={`url(#ptrGrad-${position})`}
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <circle cx="32" cy="26" r="8" fill="#ffffff" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

