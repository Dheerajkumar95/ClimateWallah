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
