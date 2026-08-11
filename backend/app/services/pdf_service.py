"""Branded PDF generation for the certification portal.

- ``build_certificate``: a single-page landscape Certificate of Green Building
  Assessment (navy + bright-green RES branding).
- ``build_docket``: a portrait multi-section assessment docket with the final
  category-by-category scoring table.

Both return raw PDF bytes; callers persist them to GridFS.
"""
from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

NAVY = colors.HexColor("#172033")
GREEN = colors.HexColor("#27F580")
GREY = colors.HexColor("#5B6472")
LIGHT = colors.HexColor("#EEF1F4")


def _project_title(project: dict) -> str:
    return (project.get("name") or project.get("title")
            or project.get("project_name") or "Untitled Project")


def build_certificate(project: dict, record: dict) -> bytes:
    buf = BytesIO()
    W, H = landscape(A4)
    c = canvas.Canvas(buf, pagesize=(W, H))

    # Outer navy frame
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.rect(14 * mm, 14 * mm, W - 28 * mm, H - 28 * mm, fill=1, stroke=0)
    # Accent bars
    c.setFillColor(GREEN)
    c.rect(14 * mm, H - 20 * mm, W - 28 * mm, 6 * mm, fill=1, stroke=0)
    c.rect(14 * mm, 14 * mm, W - 28 * mm, 6 * mm, fill=1, stroke=0)

    cx = W / 2
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(cx, H - 40 * mm, "RESILIENT EARTH SOLUTIONS")
    c.setFillColor(GREY)
    c.setFont("Helvetica", 11)
    c.drawCentredString(cx, H - 47 * mm, "Green Building & Sustainability Certification")

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(cx, H - 68 * mm, "Certificate of Green Building Assessment")

    c.setFillColor(GREY)
    c.setFont("Helvetica", 13)
    c.drawCentredString(cx, H - 82 * mm, "This certifies that")

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(cx, H - 95 * mm, _project_title(project)[:70])

    meta = " · ".join(x for x in [project.get("organization"), project.get("location"),
                                  project.get("project_type")] if x)
    if meta:
        c.setFillColor(GREY)
        c.setFont("Helvetica", 12)
        c.drawCentredString(cx, H - 103 * mm, meta[:90])

    band = record.get("band", "Certified")
    total = record.get("final_total", 0)
    tmax = record.get("total_max", 100)
    c.setFillColor(GREEN)
    c.roundRect(cx - 55 * mm, H - 128 * mm, 110 * mm, 16 * mm, 4, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(cx, H - 122 * mm, f"RATING: {str(band).upper()}   |   SCORE: {total} / {tmax}")

    # Footer meta row
    y = 30 * mm
    c.setFillColor(GREY)
    c.setFont("Helvetica", 10)
    c.drawString(30 * mm, y, f"Certificate No: {record.get('certificate_number', '—')}")
    c.drawCentredString(cx, y, f"Issued: {record.get('issued_date') or '—'}")
    c.drawRightString(W - 30 * mm, y, f"Valid Until: {record.get('valid_until') or '—'}")

    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(GREY)
    c.drawCentredString(cx, 24 * mm,
                        "Issued by Resilient Earth Solutions Pvt. Ltd. — assessment based on the applicable IGBC-aligned rating framework.")
    c.showPage()
    c.save()
    return buf.getvalue()


def build_docket(project: dict, record: dict, category_names: dict) -> bytes:
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                    TableStyle)
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                            leftMargin=18 * mm, rightMargin=18 * mm, title="Certification Docket")
    styles = getSampleStyleSheet()
    h = ParagraphStyle("h", parent=styles["Heading1"], textColor=NAVY, fontSize=18)
    sub = ParagraphStyle("sub", parent=styles["Normal"], textColor=GREY, fontSize=10)
    sec = ParagraphStyle("sec", parent=styles["Heading2"], textColor=NAVY, fontSize=13, spaceBefore=10)
    body = ParagraphStyle("body", parent=styles["Normal"], textColor=NAVY, fontSize=10)

    story = [Paragraph("Certification Docket", h),
             Paragraph("Resilient Earth Solutions — Green Building Assessment Record", sub),
             Spacer(1, 8)]

    meta_rows = [
        ["Project", _project_title(project)],
        ["Organization", project.get("organization") or "—"],
        ["Location", project.get("location") or "—"],
        ["Project Type", project.get("project_type") or "—"],
        ["Occupancy", project.get("occupancy_type") or "—"],
        ["Decision", str(record.get("decision", "—")).title()],
        ["Rating Band", record.get("band") or "—"],
        ["Final Score", f"{record.get('final_total', 0)} / {record.get('total_max', 100)}"],
        ["Certificate No.", record.get("certificate_number") or "—"],
        ["Issued", record.get("issued_date") or "—"],
        ["Valid Until", record.get("valid_until") or "—"],
    ]
    mt = Table(meta_rows, colWidths=[45 * mm, 120 * mm])
    mt.setStyle(TableStyle([
        ("TEXTCOLOR", (0, 0), (0, -1), GREY),
        ("TEXTCOLOR", (1, 0), (1, -1), NAVY),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LIGHT),
    ]))
    story += [mt, Spacer(1, 6), Paragraph("Category Scores (Admin-certified)", sec)]

    cats = record.get("categories") or {}
    rows = [["Category", "Points"]]
    for cid, score in cats.items():
        rows.append([category_names.get(cid, cid), str(score)])
    if len(rows) == 1:
        rows.append(["—", "—"])
    ct = Table(rows, colWidths=[130 * mm, 35 * mm])
    ct.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 1), (-1, -1), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [ct, Spacer(1, 8)]

    if record.get("notes"):
        story += [Paragraph("Admin Notes", sec), Paragraph(str(record["notes"]), body), Spacer(1, 6)]

    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    story += [Spacer(1, 10),
              Paragraph(f"Generated {gen}. Assessment based on the applicable IGBC-aligned rating "
                        "framework. This document is an internal RES certification record.", sub)]
    doc.build(story)
    return buf.getvalue()
