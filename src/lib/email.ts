/**
 * Sends email through Resend when RESEND_API_KEY is configured; otherwise logs
 * to the server console so development never sends real mail.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<"sent" | "logged"> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL ?? "Case Control <onboarding@resend.dev>";
  if (!key) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${html.replace(/<[^>]+>/g, "")}`);
    return "logged";
  }
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) throw new Error(`Email failed: ${error.message}`);
  return "sent";
}
