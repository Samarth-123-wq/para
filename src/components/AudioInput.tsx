import type { AudioDevice, PermissionStatus } from '../types'

type AudioInputProps = {
  devices: AudioDevice[]
  selectedDeviceId: string
  selectedDeviceName: string
  permissionStatus: PermissionStatus
  isListening: boolean
  error: string | null
  onSelectDevice: (deviceId: string) => void
  onRequestPermission: () => void
  onRefresh: () => void
  onStart: () => void
  onStop: () => void
}

const permissionLabel: Record<PermissionStatus, string> = {
  unknown: 'Not requested',
  granted: 'Granted',
  denied: 'Denied',
  unsupported: 'Unsupported',
}

export function AudioInput({
  devices,
  selectedDeviceId,
  selectedDeviceName,
  permissionStatus,
  isListening,
  error,
  onSelectDevice,
  onRequestPermission,
  onRefresh,
  onStart,
  onStop,
}: AudioInputProps) {
  return (
    <section className="card">
      <h2 className="card-title">Audio Input</h2>
      {isListening ? (
        <div className="listening-banner">
          <span className="dot listening" />
          Listening with selected microphone
        </div>
      ) : null}
      <div className="row">
        <select
          className="select"
          value={selectedDeviceId}
          onChange={(event) => onSelectDevice(event.target.value)}
          aria-label="Audio input device"
        >
          {devices.length === 0 ? <option value="">No devices listed</option> : null}
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" type="button" onClick={onStart} disabled={isListening}>
          Start Listening
        </button>
        <button className="btn btn-secondary" type="button" onClick={onStop} disabled={!isListening}>
          Stop Listening
        </button>
      </div>
      {permissionStatus === 'unknown' || permissionStatus === 'denied' ? (
        <div className="btn-row">
          <button className="btn btn-ghost" type="button" onClick={onRequestPermission}>
            Request Microphone Access
          </button>
        </div>
      ) : null}
      <div className="meta">
        <span>Microphone permission: {permissionLabel[permissionStatus]}</span>
        <span>Selected device: {selectedDeviceName}</span>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}
