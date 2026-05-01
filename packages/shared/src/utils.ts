const REFERRAL_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/I/1

export function generateReferralCode(length = 6): string {
  let code = ""
  for (let i = 0; i < length; i++) {
    code += REFERRAL_CHARS[Math.floor(Math.random() * REFERRAL_CHARS.length)]
  }
  return code
}
