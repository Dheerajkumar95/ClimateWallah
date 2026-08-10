import os
import logging
import httpx

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Resilient Earth Solutions")
NOTIFY_EMAIL = os.environ.get("ENQUIRY_NOTIFY_EMAIL")


async def send_enquiry_notification(enquiry: dict):
    if not EMAIL_KEY or not NOTIFY_EMAIL:
        logger.warning("Email not configured; skipping enquiry notification")
        return
    rows = "".join(
        f"<tr><td style='padding:6px 12px;font-weight:600;color:#133A26'>{k}</td>"
        f"<td style='padding:6px 12px;color:#1C211E'>{v or '-'}</td></tr>"
        for k, v in [
            ("Name", enquiry.get("name")),
            ("Email", enquiry.get("email")),
            ("Phone", enquiry.get("phone")),
            ("Company", enquiry.get("company")),
            ("Subject", enquiry.get("subject")),
            ("Service of Interest", enquiry.get("service_of_interest")),
            ("Source Page", enquiry.get("source_page")),
        ]
    )
    html = f"""
    <table style="width:100%;max-width:600px;font-family:Arial,sans-serif;border-collapse:collapse">
      <tr><td style="background:#133A26;color:#F8F9F7;padding:20px;font-size:18px;font-weight:700">
        New Enquiry — Resilient Earth Solutions</td></tr>
      <tr><td style="padding:16px"><table style="width:100%;border-collapse:collapse">{rows}</table></td></tr>
      <tr><td style="padding:0 16px 20px 16px">
        <div style="font-weight:600;color:#133A26;margin-bottom:6px">Message</div>
        <div style="color:#1C211E;line-height:1.5">{enquiry.get('message','')}</div></td></tr>
    </table>
    """
    payload = {
        "to": [NOTIFY_EMAIL],
        "subject": f"New Enquiry: {enquiry.get('subject') or enquiry.get('name')}",
        "html": html,
        "from_name": EMAIL_FROM_NAME,
    }
    if enquiry.get("email"):
        payload["contact_email"] = enquiry["email"]
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"Enquiry email failed: {e}")


async def send_otp_email(to_email: str, name: str, otp: str) -> bool:
    """Send a 6-digit registration OTP. Returns True on success."""
    if not EMAIL_KEY:
        logger.warning("Email not configured; skipping OTP email")
        return False
    html = f"""
    <table style="width:100%;max-width:560px;margin:0 auto;font-family:Arial,sans-serif;border-collapse:collapse">
      <tr><td style="background:#101827;color:#EAFBF4;padding:24px;font-size:18px;font-weight:700">
        Resilient Earth Solutions — Verify your email</td></tr>
      <tr><td style="padding:24px;color:#1C211E;line-height:1.6">
        <p style="margin:0 0 12px 0">Hi {name or 'there'},</p>
        <p style="margin:0 0 18px 0">Use the verification code below to complete your registration for the RES Client Certification Portal. This code expires in <strong>5 minutes</strong>.</p>
        <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#009C72;background:#EAFBF4;border:1px solid #E2E7EC;border-radius:12px;padding:18px;text-align:center">{otp}</div>
        <p style="margin:18px 0 0 0;color:#64748b;font-size:13px">If you did not request this, you can safely ignore this email.</p>
      </td></tr>
    </table>
    """
    payload = {
        "to": [to_email],
        "subject": f"Your RES verification code: {otp}",
        "html": html,
        "from_name": EMAIL_FROM_NAME,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"OTP email failed: {e}")
        return False
