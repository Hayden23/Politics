/**
 * Email delivery behind one function. EMAIL_PROVIDER=resend uses the Resend
 * HTTP API (RESEND_API_KEY, EMAIL_FROM); anything else logs and marks the
 * message "skipped" so nothing is silently lost in development.
 */
export async function sendEmail(m: { to: string; subject: string; text: string }): Promise<{ status: "sent" | "failed" | "skipped"; error?: string }> {
  if (process.env.EMAIL_PROVIDER !== "resend" || !process.env.RESEND_API_KEY) {
    console.log(`[email:skipped] to=${m.to.replace(/(.).+@/, "$1***@")} subject="${m.subject}"`);
    return { status: "skipped" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Civic Lens <no-reply@example.com>", to: [m.to], subject: m.subject, text: m.text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { status: "failed", error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { status: "sent" };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}
