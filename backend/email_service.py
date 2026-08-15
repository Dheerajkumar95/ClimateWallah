# import os
# import logging
# import httpx

# logger = logging.getLogger(__name__)

# EMAIL_BASE_URL = "https://integrations.emergentagent.com"
# EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
# EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Resilient Earth Solutions")
# NOTIFY_EMAIL = os.environ.get("ENQUIRY_NOTIFY_EMAIL")


# async def send_enquiry_notification(enquiry: dict):
#     if not EMAIL_KEY or not NOTIFY_EMAIL:
#         logger.warning("Email not configured; skipping enquiry notification")
#         return
#     rows = "".join(
#         f"<tr><td style='padding:6px 12px;font-weight:600;color:#133A26'>{k}</td>"
#         f"<td style='padding:6px 12px;color:#1C211E'>{v or '-'}</td></tr>"
#         for k, v in [
#             ("Name", enquiry.get("name")),
#             ("Email", enquiry.get("email")),
#             ("Phone", enquiry.get("phone")),
#             ("Company", enquiry.get("company")),
#             ("Subject", enquiry.get("subject")),
#             ("Service of Interest", enquiry.get("service_of_interest")),
#             ("Source Page", enquiry.get("source_page")),
#         ]
#     )
#     html = f"""
#     <table style="width:100%;max-width:600px;font-family:Arial,sans-serif;border-collapse:collapse">
#       <tr><td style="background:#133A26;color:#F8F9F7;padding:20px;font-size:18px;font-weight:700">
#         New Enquiry — Resilient Earth Solutions</td></tr>
#       <tr><td style="padding:16px"><table style="width:100%;border-collapse:collapse">{rows}</table></td></tr>
#       <tr><td style="padding:0 16px 20px 16px">
#         <div style="font-weight:600;color:#133A26;margin-bottom:6px">Message</div>
#         <div style="color:#1C211E;line-height:1.5">{enquiry.get('message','')}</div></td></tr>
#     </table>
#     """
#     payload = {
#         "to": [NOTIFY_EMAIL],
#         "subject": f"New Enquiry: {enquiry.get('subject') or enquiry.get('name')}",
#         "html": html,
#         "from_name": EMAIL_FROM_NAME,
#     }
#     if enquiry.get("email"):
#         payload["contact_email"] = enquiry["email"]
#     try:
#         async with httpx.AsyncClient(timeout=30) as client:
#             resp = await client.post(
#                 f"{EMAIL_BASE_URL}/api/v1/email/send",
#                 headers={"X-Email-Key": EMAIL_KEY},
#                 json=payload,
#             )
#         resp.raise_for_status()
#     except Exception as e:
#         logger.error(f"Enquiry email failed: {e}")


# async def send_otp_email(to_email: str, name: str, otp: str) -> bool:
#     """Send a 6-digit registration OTP. Returns True on success."""
#     if not EMAIL_KEY:
#         logger.warning("Email not configured; skipping OTP email")
#         return False
#     html = f"""
#     <table style="width:100%;max-width:560px;margin:0 auto;font-family:Arial,sans-serif;border-collapse:collapse">
#       <tr><td style="background:#101827;color:#EAFBF4;padding:24px;font-size:18px;font-weight:700">
#         Resilient Earth Solutions — Verify your email</td></tr>
#       <tr><td style="padding:24px;color:#1C211E;line-height:1.6">
#         <p style="margin:0 0 12px 0">Hi {name or 'there'},</p>
#         <p style="margin:0 0 18px 0">Use the verification code below to complete your registration for the RES Client Certification Portal. This code expires in <strong>5 minutes</strong>.</p>
#         <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#009C72;background:#EAFBF4;border:1px solid #E2E7EC;border-radius:12px;padding:18px;text-align:center">{otp}</div>
#         <p style="margin:18px 0 0 0;color:#64748b;font-size:13px">If you did not request this, you can safely ignore this email.</p>
#       </td></tr>
#     </table>
#     """
#     payload = {
#         "to": [to_email],
#         "subject": f"Your RES verification code: {otp}",
#         "html": html,
#         "from_name": EMAIL_FROM_NAME,
#     }
#     try:
#         async with httpx.AsyncClient(timeout=30) as client:
#             resp = await client.post(
#                 f"{EMAIL_BASE_URL}/api/v1/email/send",
#                 headers={"X-Email-Key": EMAIL_KEY},
#                 json=payload,
#             )
#         resp.raise_for_status()
#         return True
#     except Exception as e:
#         logger.error(f"OTP email failed: {e}")
#         return False
import os
import ssl
import asyncio
import smtplib
import logging
from pathlib import Path
from html import escape
from email.message import EmailMessage
from email.utils import formataddr

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

logger = logging.getLogger(__name__)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


EMAIL_ENABLED = env_bool("EMAIL_ENABLED", False)

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()

# Google App Password mein visible spaces automatically remove honge.
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()

SMTP_FROM_EMAIL = (
    os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_USERNAME
)

SMTP_FROM_NAME = (
    os.getenv("SMTP_FROM_NAME", "").strip()
    or os.getenv("EMAIL_FROM_NAME", "").strip()
    or "Resilient Earth Solutions"
)

SMTP_REPLY_TO = os.getenv("SMTP_REPLY_TO", "").strip()
SMTP_USE_TLS = env_bool("SMTP_USE_TLS", True)
SMTP_USE_SSL = env_bool("SMTP_USE_SSL", False)
SMTP_TIMEOUT_SECONDS = int(os.getenv("SMTP_TIMEOUT_SECONDS", "20"))

NOTIFY_EMAIL = (
    os.getenv("ENQUIRY_NOTIFY_EMAIL", "").strip()
    or SMTP_REPLY_TO
    or SMTP_FROM_EMAIL
)


def missing_email_settings() -> list[str]:
    if not EMAIL_ENABLED:
        return ["EMAIL_ENABLED=true"]

    required = {
        "SMTP_HOST": SMTP_HOST,
        "SMTP_USERNAME": SMTP_USERNAME,
        "SMTP_PASSWORD": SMTP_PASSWORD,
        "SMTP_FROM_EMAIL": SMTP_FROM_EMAIL,
    }

    return [name for name, value in required.items() if not value]


def send_email_sync(
    to_email: str,
    subject: str,
    plain_body: str,
    html_body: str,
) -> None:
    if SMTP_USE_TLS and SMTP_USE_SSL:
        raise RuntimeError(
            "SMTP_USE_TLS and SMTP_USE_SSL cannot both be true."
        )

    message = EmailMessage()
    message["From"] = formataddr(
        (SMTP_FROM_NAME, SMTP_FROM_EMAIL)
    )
    message["To"] = to_email
    message["Subject"] = subject

    if SMTP_REPLY_TO:
        message["Reply-To"] = SMTP_REPLY_TO

    message.set_content(plain_body)
    message.add_alternative(html_body, subtype="html")

    ssl_context = ssl.create_default_context()

    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(
            SMTP_HOST,
            SMTP_PORT,
            timeout=SMTP_TIMEOUT_SECONDS,
            context=ssl_context,
        ) as smtp:
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        return

    with smtplib.SMTP(
        SMTP_HOST,
        SMTP_PORT,
        timeout=SMTP_TIMEOUT_SECONDS,
    ) as smtp:
        smtp.ehlo()

        if SMTP_USE_TLS:
            smtp.starttls(context=ssl_context)
            smtp.ehlo()

        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message)


async def send_email(
    to_email: str,
    subject: str,
    plain_body: str,
    html_body: str,
) -> bool:
    missing = missing_email_settings()

    if missing:
        logger.warning(
            "Email not configured; missing settings: %s",
            ", ".join(missing),
        )
        return False

    try:
        await asyncio.to_thread(
            send_email_sync,
            to_email,
            subject,
            plain_body,
            html_body,
        )
        logger.info("Email sent successfully.")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error(
            "SMTP authentication failed. Check SMTP_USERNAME "
            "and Google App Password."
        )
        return False

    except Exception as exc:
        logger.error(
            "SMTP email delivery failed: %s",
            type(exc).__name__,
        )
        return False


async def send_otp_email(
    to_email: str,
    name: str,
    otp: str,
) -> bool:
    safe_name = escape(name or "there")
    safe_otp = escape(otp)

    plain_body = (
        f"Hi {name or 'there'},\n\n"
        f"Your RES verification code is: {otp}\n"
        "This code expires in 5 minutes.\n\n"
        "If you did not request this, ignore this email."
    )

    html_body = f"""
    <div style="
        max-width:560px;
        margin:0 auto;
        font-family:Arial,sans-serif;
        border:1px solid #E4E7EC;
        border-radius:14px;
        overflow:hidden;
    ">
        <div style="
            background:#172033;
            color:#FFFFFF;
            padding:24px;
            font-size:18px;
            font-weight:700;
        ">
            Resilient Earth Solutions
        </div>

        <div style="
            padding:24px;
            color:#111827;
            line-height:1.6;
        ">
            <p>Hi {safe_name},</p>

            <p>
                Use the verification code below to complete
                your RES Client Portal registration.
            </p>

            <div style="
                background:#E9FFF2;
                border:1px solid #27F580;
                border-radius:12px;
                color:#172033;
                font-size:34px;
                font-weight:800;
                letter-spacing:10px;
                padding:18px;
                text-align:center;
                margin:20px 0;
            ">
                {safe_otp}
            </div>

            <p>
                This verification code expires in
                <strong>5 minutes</strong>.
            </p>

            <p style="color:#667085;font-size:13px;">
                If you did not request this, you can safely
                ignore this email.
            </p>
        </div>
    </div>
    """

    return await send_email(
        to_email=to_email,
        subject="Your RES email verification code",
        plain_body=plain_body,
        html_body=html_body,
    )


async def send_enquiry_notification(enquiry: dict) -> bool:
    if not NOTIFY_EMAIL:
        logger.warning(
            "ENQUIRY_NOTIFY_EMAIL is not configured."
        )
        return False

    details = [
        ("Name", enquiry.get("name")),
        ("Email", enquiry.get("email")),
        ("Phone", enquiry.get("phone")),
        ("Company", enquiry.get("company")),
        ("Subject", enquiry.get("subject")),
        (
            "Service of Interest",
            enquiry.get("service_of_interest"),
        ),
        ("Source Page", enquiry.get("source_page")),
    ]

    rows = "".join(
        f"""
        <tr>
            <td style="
                padding:8px 12px;
                font-weight:600;
                color:#172033;
            ">
                {escape(str(key))}
            </td>
            <td style="
                padding:8px 12px;
                color:#111827;
            ">
                {escape(str(value or "-"))}
            </td>
        </tr>
        """
        for key, value in details
    )

    safe_message = escape(
        str(enquiry.get("message") or "-")
    ).replace("\n", "<br>")

    html_body = f"""
    <div style="
        max-width:600px;
        margin:0 auto;
        font-family:Arial,sans-serif;
        border:1px solid #E4E7EC;
        border-radius:14px;
        overflow:hidden;
    ">
        <div style="
            background:#172033;
            color:#FFFFFF;
            padding:20px;
            font-size:18px;
            font-weight:700;
        ">
            New RES Website Enquiry
        </div>

        <div style="padding:20px;">
            <table style="
                width:100%;
                border-collapse:collapse;
            ">
                {rows}
            </table>

            <div style="
                margin-top:18px;
                padding:14px;
                background:#F6F8FA;
                border-radius:10px;
                color:#111827;
            ">
                <strong>Message</strong>
                <div style="margin-top:8px;">
                    {safe_message}
                </div>
            </div>
        </div>
    </div>
    """

    plain_body = (
        "A new RES website enquiry has been received.\n\n"
        f"Name: {enquiry.get('name') or '-'}\n"
        f"Email: {enquiry.get('email') or '-'}\n"
        f"Phone: {enquiry.get('phone') or '-'}\n"
        f"Message: {enquiry.get('message') or '-'}"
    )

    return await send_email(
        to_email=NOTIFY_EMAIL,
        subject=(
            "New RES enquiry: "
            f"{enquiry.get('subject') or enquiry.get('name') or 'Website'}"
        ),
        plain_body=plain_body,
        html_body=html_body,
    )