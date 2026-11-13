type HeaderProps = {
  onOpenSettings: () => void
}

export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <MicIcon />
        <h1>Interview Assistant</h1>
      </div>
      <div className="row">
        <span className="status-chip">
          <span className="dot" />
          Ready
        </span>
        <button className="icon-btn" type="button" aria-label="Settings" onClick={onOpenSettings}>
          <SettingsIcon />
        </button>
      </div>
    </header>
  )
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="#cfc8ff" strokeWidth="1.8" />
      <path d="M6.5 11a5.5 5.5 0 0 0 11 0" stroke="#cfc8ff" strokeWidth="1.8" />
      <path d="M12 16.5v3.5" stroke="#cfc8ff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.2M12 18.3V20.5M4.9 6.8l1.6 1.6M17.5 15.6l1.6 1.6M3.5 12h2.2M18.3 12H20.5M4.9 17.2l1.6-1.6M17.5 8.4l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
