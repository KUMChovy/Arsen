import { Capacitor, registerPlugin } from '@capacitor/core'

export type AccountState =
  | { status: 'signed-out' | 'unavailable' | 'verification-required' }
  | { status: 'signed-in'; email: string }

type AccountPlugin = {
  getState(): Promise<AccountState>
  signIn(input: { email: string; password: string }): Promise<AccountState>
  completeVerification(): Promise<AccountState>
  signOut(): Promise<void>
}

export const nativeAccount = registerPlugin<AccountPlugin>('ArsenAccount')
type BackupContextResponse = { status: string; owner?: string; deviceId?: string; baseBackupId?: string | null; summary?: unknown }
type BackupPlugin = {
  prepareContext(): Promise<BackupContextResponse>
  stage(input: { owner: string; revision: number; payload: string; periodic: boolean }): Promise<{ status: string }>
  getPending(): Promise<{ pending: boolean }>
  retryPending(input: { owner: string }): Promise<{ status: string }>
  download(input: { owner: string; backupId: string }): Promise<{ manifest: string; manifestSha256: string; binaries: Array<{ id: string; base64: string }> }>
}
export const nativeBackup = registerPlugin<BackupPlugin>('ArsenBackup')
export const isNativeAccount = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
