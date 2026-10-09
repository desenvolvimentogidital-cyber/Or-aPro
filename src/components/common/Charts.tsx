import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const SparklineRevenue: React.FC<{ height?: number; width?: number; className?: string; values?: number[] }> = ({
  height = 50,
  width = 160,
  className = '',
  values = []
}) => {
  const { theme } = useTheme();

  const chartValues = values;
  const maxValue = Math.max(...chartValues, 1);
  const points = chartValues.map((value, index) => ({
    x: chartValues.length === 1 ? 80 : 160 * index / (chartValues.length - 1),
    y: (height - 6) - (Math.max(0, value) / maxValue) * (height - 14)
  }));
  const pathD = `M ${points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ')}`;
  const areaD = `${pathD} L 160,${height} L 0,${height} Z`;
  const last = points[points.length - 1];

  if (!values.length) return <div className={`text-[10px] text-slate-500 flex h-full items-center justify-center ${className}`}>Sem histórico</div>;
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 160 ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={theme.secondaryColor || '#ffa114'} stopOpacity="0.55" />
            <stop offset="60%" stopColor={theme.primaryColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={theme.primaryColor} stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.secondaryColor || '#ffa114'} />
            <stop offset="100%" stopColor={theme.primaryColor} />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Filled area */}
        <path d={areaD} fill="url(#revenueGradient)" />
        
        {/* Glow Line */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        
        {/* Crisp Line with Gradient */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End dot with gradient ring */}
        <circle
          cx={last.x}
          cy={last.y}
          r="4.5"
          fill={theme.primaryColor}
          className="animate-pulse"
        />
        <circle
          cx={last.x}
          cy={last.y}
          r="2"
          fill="#ffffff"
        />
      </svg>
    </div>
  );
};

export const DonutStatusChart: React.FC<{
  approvedCount: number;
  sentCount: number;
  draftCount: number;
  rejectedCount?: number;
  size?: number;
}> = ({
  approvedCount,
  sentCount,
  draftCount,
  rejectedCount = 0,
  size = 130
}) => {
  const { theme } = useTheme();
  const total = Math.max(1, approvedCount + sentCount + draftCount + rejectedCount);

  // Percentages
  const pApproved = approvedCount / total;
  const pSent = sentCount / total;
  const pDraft = draftCount / total;
  const pRejected = rejectedCount / total;

  // SVG circle calculations
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Offsets
  const dashApproved = circumference * pApproved;
  const dashSent = circumference * pSent;
  const dashDraft = circumference * pDraft;
  const dashRejected = circumference * pRejected;

  const offsetApproved = 0;
  const offsetSent = -dashApproved;
  const offsetDraft = -(dashApproved + dashSent);
  const offsetRejected = -(dashApproved + dashSent + dashDraft);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="donutOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.secondaryColor || '#ffa114'} />
            <stop offset="100%" stopColor={theme.primaryColor || '#ff4500'} />
          </linearGradient>
        </defs>
        {/* Base background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#262b36"
          strokeWidth={strokeWidth}
        />
        
        {/* Draft segment (gray/neutral) */}
        {dashDraft > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#64748b"
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashDraft} ${circumference - dashDraft}`}
            strokeDashoffset={offsetDraft}
            strokeLinecap="round"
          />
        )}

        {/* Sent segment (primary / orange gradient) */}
        {dashSent > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#donutOrangeGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashSent} ${circumference - dashSent}`}
            strokeDashoffset={offsetSent}
            strokeLinecap="round"
          />
        )}

        {/* Approved segment (green / emerald) */}
        {dashApproved > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#10b981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashApproved} ${circumference - dashApproved}`}
            strokeDashoffset={offsetApproved}
            strokeLinecap="round"
          />
        )}

        {/* Rejected segment (red) */}
        {dashRejected > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ef4444"
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashRejected} ${circumference - dashRejected}`}
            strokeDashoffset={offsetRejected}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-xs text-slate-400 font-medium leading-none">Total</span>
        <span className="text-lg font-bold text-white leading-tight">{total}</span>
      </div>
    </div>
  );
};
