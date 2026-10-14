import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "hr_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 天

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("缺少环境变量 AUTH_SECRET，请先在 .env.local 中配置");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
