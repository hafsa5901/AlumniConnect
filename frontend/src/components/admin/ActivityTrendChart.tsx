import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { DailyActivityItem } from '../../types/adminAnalytics';
import { Activity, UserPlus, Handshake, MessageSquare } from 'lucide-react';

interface ActivityTrendChartProps {
  timeline: DailyActivityItem[];
  days: number;
  onDaysChange: (days: number) => void;
  isLoading?: boolean;
}

export const ActivityTrendChart: React.FC<ActivityTrendChartProps> = ({
  timeline,
  days,
  onDaysChange,
  isLoading = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute totals for summary
  const totals = timeline.reduce(
    (acc, curr) => ({
      newUsers: acc.newUsers + curr.newUsers,
      newConnections: acc.newConnections + curr.newConnections,
      messagesSent: acc.messagesSent + curr.messagesSent,
    }),
    { newUsers: 0, newConnections: 0, messagesSent: 0 }
  );

  // Chart dimensions & scaling
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(
    1,
    ...timeline.map((d) => Math.max(d.newUsers, d.newConnections, d.messagesSent))
  );

  const getY = (val: number) => {
    return innerHeight - (val / maxVal) * innerHeight + padding.top;
  };

  const getX = (idx: number) => {
    if (timeline.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (idx / (timeline.length - 1)) * innerWidth;
  };

  const createLinePath = (key: keyof Pick<DailyActivityItem, 'newUsers' | 'newConnections' | 'messagesSent'>) => {
    if (timeline.length === 0) return '';
    return timeline
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`)
      .join(' ');
  };

  const usersPath = createLinePath('newUsers');
  const connectionsPath = createLinePath('newConnections');
  const messagesPath = createLinePath('messagesSent');

  return (
    <Card className="border border-slate-200/80 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          <div>
            <CardTitle className="text-base font-bold text-navy-900">Activity Timeline & Trends</CardTitle>
            <p className="text-xs text-slate-500">Platform engagement over time</p>
          </div>
        </div>

        {/* Days selector buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDaysChange(d)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                days === d
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900 hover:bg-slate-200/60'
              }`}
            >
              {d} Days
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Totals Banner */}
        <div className="grid grid-cols-3 gap-3 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <div>
              <div className="text-xs text-slate-500 font-medium">New Users</div>
              <div className="text-lg font-bold text-navy-900">{totals.newUsers.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <div>
              <div className="text-xs text-slate-500 font-medium">Connections</div>
              <div className="text-lg font-bold text-navy-900">{totals.newConnections.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <div>
              <div className="text-xs text-slate-500 font-medium">Messages</div>
              <div className="text-lg font-bold text-navy-900">{totals.messagesSent.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="h-60 flex items-center justify-center text-slate-400 text-sm">
            Loading activity trends...
          </div>
        ) : timeline.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-slate-400 text-sm">
            No activity data recorded for this time range.
          </div>
        ) : (
          <div className="relative">
            {/* SVG Chart */}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-64 overflow-visible"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Y-axis grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = padding.top + innerHeight * (1 - pct);
                const label = Math.round(maxVal * pct);
                return (
                  <g key={pct}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Data Lines */}
              <path
                d={messagesPath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={connectionsPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={usersPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Hover vertical indicator and points */}
              {timeline.map((d, i) => {
                const x = getX(i);
                const isHovered = hoveredIndex === i;
                return (
                  <g key={d.date} onMouseEnter={() => setHoveredIndex(i)} className="cursor-pointer">
                    {/* Transparent bar for hover target */}
                    <rect
                      x={x - (innerWidth / timeline.length) / 2}
                      y={padding.top}
                      width={innerWidth / timeline.length}
                      height={innerHeight}
                      fill="transparent"
                    />

                    {isHovered && (
                      <>
                        <line
                          x1={x}
                          y1={padding.top}
                          x2={x}
                          y2={height - padding.bottom}
                          stroke="#94a3b8"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                        <circle cx={x} cy={getY(d.newUsers)} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
                        <circle cx={x} cy={getY(d.newConnections)} r="4" fill="#10b981" stroke="#fff" strokeWidth="2" />
                        <circle cx={x} cy={getY(d.messagesSent)} r="4" fill="#6366f1" stroke="#fff" strokeWidth="2" />
                      </>
                    )}
                  </g>
                );
              })}

              {/* X-axis labels (sparse to prevent overlap) */}
              {timeline.map((d, i) => {
                const step = days <= 7 ? 1 : days <= 30 ? 5 : 15;
                if (i % step !== 0 && i !== timeline.length - 1) return null;
                const x = getX(i);
                return (
                  <text
                    key={d.date}
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-400 font-mono"
                  >
                    {d.date.slice(5)}
                  </text>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredIndex !== null && timeline[hoveredIndex] && (
              <div
                className="absolute top-2 bg-navy-900/95 backdrop-blur-xs text-white p-2.5 rounded-lg shadow-lg text-xs z-10 pointer-events-none transition-all duration-75"
                style={{
                  left: `${(hoveredIndex / (timeline.length - 1 || 1)) * 80 + 10}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="font-semibold border-b border-white/20 pb-1 mb-1 text-slate-200">
                  {timeline[hoveredIndex].date}
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-slate-300">New Users:</span>
                  <span className="font-bold text-white ml-auto">{timeline[hoveredIndex].newUsers}</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-300">Connections:</span>
                  <span className="font-bold text-white ml-auto">{timeline[hoveredIndex].newConnections}</span>
                </div>
                <div className="flex items-center gap-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span className="text-slate-300">Messages:</span>
                  <span className="font-bold text-white ml-auto">{timeline[hoveredIndex].messagesSent}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
