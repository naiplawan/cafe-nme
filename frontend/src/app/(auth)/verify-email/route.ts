import { requestAuthApi } from "@/server/auth-api";

const responseHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
};

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  let verified = false;
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    try {
      const response = await requestAuthApi("/verify-email", { method: "POST", body: { token } });
      if (response.ok) verified = await response.json() === true;
    } catch {
      verified = false;
    }
  }
  return new Response(null, {
    status: 303,
    headers: { ...responseHeaders, location: new URL(`/login?verified=${verified ? "1" : "0"}`, request.url).toString() },
  });
}
