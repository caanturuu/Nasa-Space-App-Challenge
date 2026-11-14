"use client";

import { ThemeTokens } from "@/oop/MarsWorkbenchOOP";

interface MarsMissionBriefingViewProps {
  themeTokens: ThemeTokens;
  onEnterWorkbench: (initialTab?: "overview" | "route" | "science") => void;
  onToggleTheme: () => void;
}

const COG_PATH =
  "M 13.55 6.77 L 16.24 6.98 L 16.24 9.26 L 13.55 9.47 L 12.92 11 L 14.67 13.05 L 13.05 14.67 L 11 12.92 L 9.47 13.55 L 9.26 16.24 L 6.98 16.24 L 6.77 13.55 L 5.24 12.92 L 3.19 14.67 L 1.57 13.05 L 3.32 11 L 2.69 9.47 L 0 9.26 L 0 6.98 L 2.69 6.77 L 3.32 5.24 L 1.57 3.19 L 3.19 1.57 L 5.24 3.32 L 6.77 2.69 L 6.98 0 L 9.26 0 L 9.47 2.69 L 11 3.32 L 13.05 1.57 L 14.67 3.19 L 12.92 5.24 Z";

export function MarsMissionBriefingView({
  themeTokens,
  onEnterWorkbench,
  onToggleTheme,
}: MarsMissionBriefingViewProps) {
  const isDark = themeTokens.mode === "dark";

  return (
    <div
      style={{
        backgroundColor: isDark ? "#0B0D12" : themeTokens.canvasBg,
        color: themeTokens.textPrimary,
      }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none"
    >
      {/* ================= TOP DOCKED HEADER (56px) ================= */}
      <header
        style={{
          backgroundColor: themeTokens.panelBg,
          borderColor: themeTokens.borderColor,
        }}
        className="h-[56px] w-full border-b px-6 flex items-center justify-between shrink-0"
      >
        <div className="flex items-center gap-3">
          <span className="w-[10px] h-[10px] bg-[#E86A33] rounded-[1px] inline-block" />
          <span className="font-bold text-[14px] tracking-wider uppercase">
            MARSWALK EXPLORER
          </span>
          <span
            style={{ color: themeTokens.textMuted }}
            className="font-mono text-[10.5px] tracking-wider uppercase ml-1"
          >
            // JEZERO CRATER SURFACE OPS
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Exact Gear Button (Node 1773) */}
          <button
            onClick={onToggleTheme}
            style={{
              backgroundColor: themeTokens.controlBg,
              borderColor: themeTokens.borderColor,
            }}
            className="w-[36px] h-[36px] border rounded-[2px] flex items-center justify-center cursor-pointer hover:border-[#E86A33] transition-colors"
            title="Switch Dark / Light Workbench Theme"
          >
            <svg width="17" height="17" viewBox="-1 -1 18.24 18.24" fill="none">
              <path
                d={COG_PATH}
                stroke={isDark ? "#CBD5E1" : "#334155"}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle
                cx="8.12"
                cy="8.12"
                r="2.4"
                stroke={isDark ? "#CBD5E1" : "#334155"}
                strokeWidth="1.5"
              />
            </svg>
          </button>

          <button
            onClick={() => onEnterWorkbench("overview")}
            className="h-[36px] px-5 rounded-[2px] bg-[#E86A33] hover:bg-[#f0753e] text-[#090B0F] font-bold text-[12px] tracking-wide cursor-pointer transition-colors"
          >
            Enter Tactical Workbench -&gt;
          </button>
        </div>
      </header>

      {/* ================= MAIN 2-COLUMN BODY ================= */}
      <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {/* Left Briefing Column (620px) */}
        <div
          style={{
            backgroundColor: isDark ? "#0B0D12" : themeTokens.panelBg,
            borderColor: themeTokens.borderColor,
          }}
          className="w-[620px] h-full border-r px-11 py-12 flex flex-col justify-between shrink-0"
        >
          <div className="space-y-6">
            {/* Orange Outlined Tag Pill */}
            <div className="inline-flex items-center px-3.5 py-1.5 bg-[#1A110D] border border-[#542916] rounded-[2px]">
              <span className="font-mono text-[10px] font-bold text-[#E86A33] tracking-wider uppercase">
                NASA SPACE APPS // EVA MISSION CONTROL
              </span>
            </div>

            {/* Hero Heading */}
            <h1 className="text-[42px] font-bold leading-[1.12] tracking-tight">
              Plan Safe Marswalks
              <br />
              Across Jezero Crater
            </h1>

            {/* Subtitle */}
            <p
              style={{ color: themeTokens.textSecondary }}
              className="text-[14px] leading-[1.6] max-w-[490px]"
            >
              Integrated Martian terrain mapping, slope-coded A* pathfinding,
              and suit O2 range estimation built for EVA crews and lab
              scientists.
            </p>

            {/* Primary & Secondary Buttons */}
            <div className="pt-2 flex items-center gap-3.5">
              <button
                onClick={() => onEnterWorkbench("overview")}
                className="h-[46px] px-7 rounded-[2px] bg-[#E86A33] hover:bg-[#f0753e] text-[#090B0F] font-bold text-[12.5px] cursor-pointer transition-colors"
              >
                Enter Tactical Workbench -&gt;
              </button>
              <button
                onClick={() => onEnterWorkbench("route")}
                style={{
                  backgroundColor: themeTokens.controlBg,
                  borderColor: themeTokens.borderColor,
                  color: themeTokens.textPrimary,
                }}
                className="h-[46px] px-9 border rounded-[2px] font-bold text-[12.5px] hover:border-[#38BDF8] cursor-pointer transition-colors"
              >
                Mission Specs
              </button>
            </div>
          </div>

          {/* Bottom 3 Baseline KPIs with Top Divider */}
          <div
            style={{ borderColor: themeTokens.borderColor }}
            className="pt-7 border-t grid grid-cols-3 gap-4"
          >
            <div>
              <div className="font-mono text-[20px] font-bold text-[#38BDF8]">
                84% (5h 12m)
              </div>
              <div
                style={{ color: themeTokens.textMuted }}
                className="text-[11.5px] mt-1"
              >
                Suit O2 Reserve Baseline
              </div>
            </div>

            <div>
              <div className="font-mono text-[20px] font-bold text-[#22C55E]">
                5.5 km SAFE
              </div>
              <div
                style={{ color: themeTokens.textMuted }}
                className="text-[11.5px] mt-1"
              >
                Safe EVA Perimeter
              </div>
            </div>

            <div>
              <div className="font-mono text-[20px] font-bold text-[#F59E0B]">
                15.0° MAX
              </div>
              <div
                style={{ color: themeTokens.textMuted }}
                className="text-[11.5px] mt-1"
              >
                Slope Alert Threshold
              </div>
            </div>
          </div>
        </div>

        {/* Right Map Preview Column (Node 1361) */}
        <div className="flex-1 h-full flex flex-col overflow-hidden bg-[#0E1117]">
          {/* Map Preview Graphic */}
          <div className="relative flex-1 w-full overflow-hidden">
            {/* Exact Extracted Mars Terrain Image from UI1.figcraft */}
            <img
              src="/figcraft/2d187f3e77a98eaa8cea5f4cc722f633c122ef170b9e94ace6b5fb6cbc3f8e01.png"
              alt="Jezero Crater Surface"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Exact 4-Waypoint Route Overlay (Nodes 1560..1572) */}
            <svg
              viewBox="0 0 820 592"
              className="relative z-10 w-full h-full"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Subtle Graticule Lines */}
              <line
                x1="270"
                y1="0"
                x2="270"
                y2="592"
                stroke="#FFFFFF"
                strokeOpacity="0.06"
                strokeWidth="1"
              />
              <line
                x1="540"
                y1="0"
                x2="540"
                y2="592"
                stroke="#FFFFFF"
                strokeOpacity="0.06"
                strokeWidth="1"
              />
              <line
                x1="0"
                y1="296"
                x2="820"
                y2="296"
                stroke="#FFFFFF"
                strokeOpacity="0.06"
                strokeWidth="1"
              />

              {/* Route Outer Dark Casing (Node 1560) */}
              <polyline
                points="220,390 470,355 580,215 495,185 405,155"
                fill="none"
                stroke="#090B0F"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Seg 1-2 Green (Node 1561) */}
              <line
                x1="220"
                y1="390"
                x2="470"
                y2="355"
                stroke="#22C55E"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Seg 2-3 Orange (Node 1562) */}
              <line
                x1="470"
                y1="355"
                x2="580"
                y2="215"
                stroke="#F59E0B"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Seg 3-P Red (Node 1563) */}
              <line
                x1="580"
                y1="215"
                x2="495"
                y2="185"
                stroke="#EF4444"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Seg P-4 Green (Node 1564) */}
              <line
                x1="495"
                y1="185"
                x2="405"
                y2="155"
                stroke="#22C55E"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Filled Waypoint Circles 1, 2, 3, 4 (Nodes 1565..1572) */}
              {[
                { x: 220, y: 390, n: "1", fill: "#22C55E" },
                { x: 470, y: 355, n: "2", fill: "#22C55E" },
                { x: 580, y: 215, n: "3", fill: "#F59E0B" },
                { x: 405, y: 155, n: "4", fill: "#38BDF8" },
              ].map((wp) => (
                <g key={wp.n}>
                  <circle
                    cx={wp.x}
                    cy={wp.y}
                    r="11.5"
                    fill={wp.fill}
                    stroke="#090B0F"
                    strokeWidth="2"
                  />
                  <text
                    x={wp.x}
                    y={wp.y + 4}
                    textAnchor="middle"
                    fill="#090B0F"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="Consolas, monospace"
                  >
                    {wp.n}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Right Map Bottom Dock Strip (Node 1373, h: 64px) */}
          <div
            style={{
              backgroundColor: themeTokens.panelBg,
              borderColor: themeTokens.borderColor,
            }}
            className="h-[64px] w-full border-t px-6 grid grid-cols-3 items-center shrink-0"
          >
            <div>
              <div
                style={{ color: themeTokens.textMuted }}
                className="font-mono text-[9.5px] font-bold uppercase tracking-wider"
              >
                SAMPLE CORRIDOR
              </div>
              <div className="font-bold text-[12.5px] mt-0.5">
                Hab -&gt; Hawksbill Delta (4 pts · 2.42 km)
              </div>
            </div>

            <div className="pl-6">
              <div
                style={{ color: themeTokens.textMuted }}
                className="font-mono text-[9.5px] font-bold uppercase tracking-wider"
              >
                O2 TRIP ESTIMATE
              </div>
              <div className="font-mono text-[13px] font-bold text-[#38BDF8] mt-0.5">
                -18% O2 (66% Left)
              </div>
            </div>

            <div className="pl-6">
              <div
                style={{ color: themeTokens.textMuted }}
                className="font-mono text-[9.5px] font-bold uppercase tracking-wider"
              >
                PEAK SLOPE RISK
              </div>
              <div className="font-mono text-[13px] font-bold text-[#EF4444] mt-0.5">
                16.2° (&gt;15° RED)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM 3-COLUMN CAPABILITY FOOTER (h: 132px) ================= */}
      <footer
        style={{
          backgroundColor: isDark ? "#0B0D12" : themeTokens.panelBg,
          borderColor: themeTokens.borderColor,
        }}
        className="h-[132px] w-full border-t grid grid-cols-3 shrink-0"
      >
        <div
          style={{ borderColor: themeTokens.borderColor }}
          className="px-7 py-5 border-r flex flex-col justify-center"
        >
          <div className="font-mono text-[10px] font-bold text-[#E86A33] uppercase tracking-wider">
            01 // NASA TREK CARTOGRAPHY
          </div>
          <div className="font-bold text-[15px] mt-1">
            Multi-Layer Jezero Basemaps
          </div>
          <p
            style={{ color: themeTokens.textSecondary }}
            className="text-[12px] mt-1 leading-relaxed"
          >
            Switch cleanly between MOLA elevation, 6m CTX orthomosaic, and
            Viking color with hazard overlays.
          </p>
        </div>

        <div
          style={{ borderColor: themeTokens.borderColor }}
          className="px-7 py-5 border-r flex flex-col justify-center"
        >
          <div className="font-mono text-[10px] font-bold text-[#E86A33] uppercase tracking-wider">
            02 // O2 FUEL &amp; SLOPE CODING
          </div>
          <div className="font-bold text-[15px] mt-1">
            O2 Range &amp; Green/Orange/Red Slopes
          </div>
          <p
            style={{ color: themeTokens.textSecondary }}
            className="text-[12px] mt-1 leading-relaxed"
          >
            Track suit oxygen consumption like a fuel gauge while coloring steep
            terrain (&gt;15° Red, 10-15° Orange).
          </p>
        </div>

        <div className="px-7 py-5 flex flex-col justify-center">
          <div className="font-mono text-[10px] font-bold text-[#E86A33] uppercase tracking-wider">
            03 // ENVIRONMENTAL CONTINGENCY
          </div>
          <div className="font-bold text-[15px] mt-1">
            Live MEDA Weather &amp; Abort Return
          </div>
          <p
            style={{ color: themeTokens.textSecondary }}
            className="text-[12px] mt-1 leading-relaxed"
          >
            Real-time Sol dust tau, wind, and solar radiation monitoring with
            instant safe-return routing on ABORT.
          </p>
        </div>
      </footer>
    </div>
  );
}
