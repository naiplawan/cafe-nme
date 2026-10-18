export function loginRateLimitKey(clientAddress: string) {
  return `login-ip:${clientAddress}`;
}

export function signupRateLimitKey(clientAddress: string) {
  return `signup-ip:${clientAddress}`;
}
