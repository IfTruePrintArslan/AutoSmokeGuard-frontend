/* Left panel for auth pages — Tailwind utility version of the mockup .l-left */

export default function AuthHero() {
  return (
    <div
      className="hidden md:flex w-full md:w-[54%] py-12 px-14 flex-col relative overflow-hidden text-white border-r border-line"
      style={{
        background:
          'radial-gradient(800px 600px at 20% -10%, rgba(255,255,255,.03), transparent 55%), radial-gradient(700px 500px at 110% 80%, rgba(255,255,255,.02), transparent 55%), #101010',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-[11px]">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-[#fafafa] flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 5.5v5.2c0 4.9 3.4 9.5 8 10.8 4.6-1.3 8-5.9 8-10.8V5.5z" />
            <path d="m9 12 2 2 4-4.5" />
          </svg>
        </div>
        <div className="font-bold text-[15px] tracking-[-0.02em]">
          AutoSmoke<span className="text-text-2">Guard</span>
        </div>
      </div>

      {/* Hero copy + detection preview card */}
      <div className="my-auto max-w-[520px]">
        <h2 className="text-[34px] font-[680] tracking-[-0.03em] leading-[1.18]">
          Vehicle smoke detection,<br />
          automated end to end.
        </h2>
        <p className="text-[#a3a3a3] text-[14.5px] leading-[1.65] mt-4 mb-[30px] max-w-[460px]">
          Upload traffic footage and get severity-graded emission reports powered by
          deep-learning vehicle detection and smoke segmentation.
        </p>

        {/* Detection preview card */}
        <div className="card max-w-[440px] p-0 overflow-hidden">
          <div className="h-[200px] relative bg-[linear-gradient(160deg,#2c2c2c_0%,#1e1e1e_45%,#151515_100%)]">
            <div className="absolute inset-0 bg-[radial-gradient(280px_120px_at_70%_30%,rgba(148,163,184,.18),transparent_70%)]" />
            {/* Bounding box — truck */}
            <div className="absolute border-2 border-[#fafafa] rounded-[4px]" style={{ left: '18%', top: '30%', width: '38%', height: '46%' }}>
              <span className="absolute -top-[22px] -left-0.5 text-[10.5px] font-semibold py-0.5 px-[7px] rounded-[4px] bg-[#fafafa] text-[#0a0a0a] whitespace-nowrap">truck · 0.97</span>
            </div>
            {/* Smoke box */}
            <div className="absolute border-2 border-dashed border-[#f59e0b] rounded-[4px] bg-[rgba(251,191,36,.08)]" style={{ left: '50%', top: '18%', width: '26%', height: '34%' }}>
              <span className="absolute -top-[22px] -left-0.5 text-[10.5px] font-semibold py-0.5 px-[7px] rounded-[4px] bg-[#f59e0b] text-[#221a04] whitespace-nowrap">smoke · 0.92</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-[13px] px-4">
            <div>
              <b className="text-[13px] font-semibold block">Report #1042</b>
              <span className="text-[11.5px] text-muted">traffic_cam_03.mp4</span>
            </div>
            <span className="sev sev-high">
              <i></i>High severity
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-[44px]">
        <div>
          <b className="text-[19px] font-[650] block tracking-[-0.02em]">1.2M+</b>
          <span className="text-[12px] text-[#8a8a8a]">frames analyzed</span>
        </div>
        <div>
          <b className="text-[19px] font-[650] block tracking-[-0.02em]">94.6%</b>
          <span className="text-[12px] text-[#8a8a8a]">detection accuracy</span>
        </div>
        <div>
          <b className="text-[19px] font-[650] block tracking-[-0.02em]">~90s</b>
          <span className="text-[12px] text-[#8a8a8a]">avg. processing</span>
        </div>
      </div>
    </div>
  )
}
