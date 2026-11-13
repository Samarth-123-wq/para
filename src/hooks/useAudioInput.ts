import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioDevice, PermissionStatus } from '../types'

function mediaSupported(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof navigator.mediaDevices?.enumerateDevices === 'function'
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

export function useAudioInput() {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown')
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const selectedDeviceIdRef = useRef(selectedDeviceId)

  selectedDeviceIdRef.current = selectedDeviceId

  const refreshDevices = useCallback(async () => {
    if (!mediaSupported()) {
      setPermissionStatus('unsupported')
      setError('Microphone APIs are not supported in this environment.')
      return
    }

    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      const inputs = list
        .filter((device) => device.kind === 'audioinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        }))

      setDevices(inputs)
      setSelectedDeviceId((current) => {
        if (current && inputs.some((device) => device.deviceId === current)) {
          return current
        }
        return inputs[0]?.deviceId ?? ''
      })
    } catch {
      setError('Could not list audio input devices.')
    }
  }, [])

  const requestPermission = useCallback(async () => {
    setError(null)

    if (!mediaSupported()) {
      setPermissionStatus('unsupported')
      setError('Microphone APIs are not supported in this environment.')
      return false
    }

    try {
      if (window.desktopApi?.requestMicrophoneAccess) {
        const result = await window.desktopApi.requestMicrophoneAccess()
        if (!result.granted) {
          setPermissionStatus('denied')
          setError('Microphone access was denied. Enable it in system settings and try again.')
          return false
        }
      }

      const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
      stopStream(probe)
      setPermissionStatus('granted')
      await refreshDevices()
      return true
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      setPermissionStatus('denied')
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone access was denied. Enable it in system settings and try again.')
      } else if (name === 'NotFoundError') {
        setError('No microphone was found on this device.')
      } else {
        setError('Could not access the microphone.')
      }
      return false
    }
  }, [refreshDevices])

  const startListening = useCallback(
    async (deviceId = selectedDeviceIdRef.current) => {
      setError(null)

      if (!mediaSupported()) {
        setPermissionStatus('unsupported')
        setError('Microphone APIs are not supported in this environment.')
        return
      }

      try {
        stopStream(streamRef.current)
        streamRef.current = null

        const audio: boolean | MediaTrackConstraints = deviceId
          ? { deviceId: { exact: deviceId } }
          : true
        const stream = await navigator.mediaDevices.getUserMedia({ audio })
        streamRef.current = stream
        setIsListening(true)
        setPermissionStatus('granted')
        await refreshDevices()
      } catch (err) {
        stopStream(streamRef.current)
        streamRef.current = null
        setIsListening(false)
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setPermissionStatus('denied')
          setError('Microphone access was denied. Enable it in system settings and try again.')
        } else if (name === 'OverconstrainedError' || name === 'NotFoundError') {
          setError('The selected microphone is not available. Refresh devices and try another input.')
        } else {
          setError('Could not start microphone capture.')
        }
      }
    },
    [refreshDevices],
  )

  const stopListening = useCallback(() => {
    stopStream(streamRef.current)
    streamRef.current = null
    setIsListening(false)
  }, [])

  const selectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId)
      if (streamRef.current) {
        void startListening(deviceId)
      }
    },
    [startListening],
  )

  useEffect(() => {
    if (!mediaSupported()) {
      setPermissionStatus('unsupported')
      setError('Microphone APIs are not supported in this environment.')
      return
    }

    const onDeviceChange = () => {
      void refreshDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [refreshDevices])

  const selectedDeviceName =
    devices.find((device) => device.deviceId === selectedDeviceId)?.label ?? 'None selected'

  return {
    devices,
    selectedDeviceId,
    selectedDeviceName,
    permissionStatus,
    isListening,
    error,
    isSupported: mediaSupported(),
    requestPermission,
    refreshDevices,
    startListening,
    stopListening,
    selectDevice,
  }
}
