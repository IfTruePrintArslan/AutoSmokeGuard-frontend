/* Left panel for auth pages — extracted verbatim from 01_login.html .l-left */

export default function AuthHero() {
  return (
    <div className="l-left">
      {/* Logo */}
      <div className="l-logo">
        <div className="logo-mark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 5.5v5.2c0 4.9 3.4 9.5 8 10.8 4.6-1.3 8-5.9 8-10.8V5.5z" />
            <path d="m9 12 2 2 4-4.5" />
          </svg>
        </div>
        <div className="logo-name">
          AutoSmoke<span>Guard</span>
        </div>
      </div>

      {/* Hero copy + detection preview card */}
      <div className="l-hero">
        <h2>
          Vehicle smoke detection,<br />
          automated end to end.
        </h2>
        <p>
          Upload traffic footage and get severity-graded emission reports powered by
          deep-learning vehicle detection and smoke segmentation.
        </p>

        {/* Detection preview card */}
        <div className="l-card auth-card">
          <div className="l-frame">
            {/* Bounding box — truck */}
            <div className="bbox" style={{ left: '18%', top: '30%', width: '38%', height: '46%' }}>
              <span>truck · 0.97</span>
            </div>
            {/* Smoke box */}
            <div className="sbox" style={{ left: '50%', top: '18%', width: '26%', height: '34%' }}>
              <span>smoke · 0.92</span>
            </div>
          </div>

          <div className="l-meta">
            <div>
              <b>Report #1042</b>
              <span>traffic_cam_03.mp4</span>
            </div>
            <span className="auth-sev auth-sev-high">
              <i></i>High severity
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="l-stats">
        <div>
          <b>1.2M+</b>
          <span>frames analyzed</span>
        </div>
        <div>
          <b>94.6%</b>
          <span>detection accuracy</span>
        </div>
        <div>
          <b>~90s</b>
          <span>avg. processing</span>
        </div>
      </div>
    </div>
  )
}
