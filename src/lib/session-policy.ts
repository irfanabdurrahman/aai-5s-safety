export type SessionVersion = { sv?: number };
export type SessionUserState = { isActive: boolean; mustChangePassword: boolean; sessionVersion: number };
export function isSessionUserValid(session: SessionVersion, user: SessionUserState, allowPasswordChange = false): boolean {
  return user.isActive && (allowPasswordChange || !user.mustChangePassword) && Number.isInteger(session.sv) && session.sv === user.sessionVersion;
}
