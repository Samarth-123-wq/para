export type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'unsupported'

export type AudioDevice = {
  deviceId: string
  label: string
}

export type ConversationLine = {
  id: string
  text: string
}
