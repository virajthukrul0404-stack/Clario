const FALLBACK_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.METERED_API_KEY?.trim();
  const domain = process.env.TURN_SERVER_URL?.trim();

  if (!apiKey || !domain) {
    return Response.json({
      iceServers: FALLBACK_ICE_SERVERS,
    });
  }

  try {
    const response = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return Response.json({
        iceServers: FALLBACK_ICE_SERVERS,
      });
    }

    const iceServers = await response.json();

    return Response.json({
      iceServers:
        Array.isArray(iceServers) && iceServers.length > 0
          ? iceServers
          : FALLBACK_ICE_SERVERS,
    });
  } catch {
    return Response.json({
      iceServers: FALLBACK_ICE_SERVERS,
    });
  }
}
