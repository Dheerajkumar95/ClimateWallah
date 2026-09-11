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


def build_payment_invoice(order: dict, owner: dict, company: dict | None = None) -> bytes:
    """Generate a compact professional payment receipt/invoice for a paid order."""
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                            leftMargin=18 * mm, rightMargin=18 * mm, title="Payment Receipt")
    styles = getSampleStyleSheet()
    title = ParagraphStyle("invoice_title", parent=styles["Heading1"], textColor=NAVY, fontSize=20)
    small = ParagraphStyle("invoice_small", parent=styles["Normal"], textColor=GREY, fontSize=9)
    body = ParagraphStyle("invoice_body", parent=styles["Normal"], textColor=NAVY, fontSize=10)
    company = company or {}
    quote = order.get("quote") or {}
    invoice_no = order.get("invoice_number") or f"CW-{str(order.get('id') or '')[:8].upper()}"
    amount = int(order.get("amount_paise") or 0) / 100
    paid_at = order.get("paid_at") or order.get("updated_at") or order.get("created_at")
    kind = "Project Review Fee" if order.get("kind") == "client_review_fee" else "Reviewer Monthly Plan"

    story = [Paragraph("ClimateWallah", title),
             Paragraph("Payment Receipt / Tax Invoice", small), Spacer(1, 10)]
    meta = [
        ["Invoice No.", invoice_no], ["Payment Status", str(order.get("status") or "paid").upper()],
        ["Paid At", paid_at or "—"], ["Customer", owner.get("name") or "—"],
        ["Email", owner.get("email") or "—"], ["Payment Method", "Razorpay" if order.get("provider") == "razorpay" else "QR / UPI"],
        ["Transaction ID", order.get("transaction_id") or order.get("payment_id") or "—"],
    ]
    mt = Table(meta, colWidths=[45 * mm, 120 * mm])
    mt.setStyle(TableStyle([("FONTNAME", (0,0),(0,-1), "Helvetica-Bold"), ("TEXTCOLOR", (0,0),(0,-1), GREY),
                            ("TEXTCOLOR", (1,0),(1,-1), NAVY), ("FONTSIZE", (0,0),(-1,-1), 9),
                            ("LINEBELOW", (0,0),(-1,-1), 0.35, LIGHT), ("BOTTOMPADDING", (0,0),(-1,-1), 6)]))
    story += [mt, Spacer(1, 14)]

    base = int(quote.get("base_paise") or quote.get("subtotal_paise") or order.get("amount_paise") or 0) / 100
    gst = int(quote.get("gst_paise") or quote.get("tax_paise") or 0) / 100
    rows = [["Description", "Amount (INR)"], [kind, f"₹{base:,.2f}"]]
    if gst:
        rows.append([f"GST ({quote.get('gst_rate', '')}%)".replace(" (%)", ""), f"₹{gst:,.2f}"])
    rows.append(["Total Paid", f"₹{amount:,.2f}"])
    t = Table(rows, colWidths=[125 * mm, 40 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0,0),(-1,0), NAVY), ("TEXTCOLOR", (0,0),(-1,0), colors.white),
                           ("FONTNAME", (0,0),(-1,0), "Helvetica-Bold"), ("FONTNAME", (0,-1),(-1,-1), "Helvetica-Bold"),
                           ("ALIGN", (1,0),(1,-1), "RIGHT"), ("TEXTCOLOR", (0,1),(-1,-1), NAVY),
                           ("FONTSIZE", (0,0),(-1,-1), 9), ("ROWBACKGROUNDS", (0,1),(-1,-1), [colors.white, LIGHT]),
                           ("TOPPADDING", (0,0),(-1,-1), 7), ("BOTTOMPADDING", (0,0),(-1,-1), 7)]))
    story += [t, Spacer(1, 18), Paragraph("This document was generated electronically after successful payment verification.", small)]
    if company.get("gstin"):
        story += [Paragraph(f"GSTIN: {company['gstin']}", small)]
    doc.build(story)
    return buf.getvalue()


def build_review_report(project: dict, reviewer: dict | None = None, client: dict | None = None) -> bytes:
    """Professional reviewer assessment report generated from the frozen project checklist."""
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    buf = BytesIO()
    styles = getSampleStyleSheet()
    title = ParagraphStyle('ReviewTitle', parent=styles['Title'], textColor=NAVY, fontSize=20, leading=24, spaceAfter=8)
    h2 = ParagraphStyle('ReviewH2', parent=styles['Heading2'], textColor=NAVY, fontSize=12, leading=15, spaceBefore=10, spaceAfter=6)
    body = ParagraphStyle('ReviewBody', parent=styles['BodyText'], textColor=GREY, fontSize=9, leading=13)
    small = ParagraphStyle('ReviewSmall', parent=body, fontSize=8, leading=11)
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=16*mm, leftMargin=16*mm, topMargin=16*mm, bottomMargin=16*mm)
    story = [Paragraph('CLIMATEWALLAH', title), Paragraph('Professional Sustainability Review Report', h2)]
    meta = [
        ['Project', _project_title(project)], ['Certification', project.get('certification_type') or project.get('certification_code') or '—'],
        ['Project type', project.get('project_type') or '—'], ['Occupancy', project.get('occupancy_type') or '—'],
        ['Client', (client or {}).get('name') or '—'], ['Reviewer', (reviewer or {}).get('name') or '—'],
        ['Status', str(project.get('status') or '—').replace('_',' ').title()], ['Generated', datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')],
    ]
    mt = Table(meta, colWidths=[30*mm, 55*mm, 30*mm, 55*mm])
    mt.setStyle(TableStyle([('FONTNAME',(0,0),(0,-1),'Helvetica-Bold'),('FONTNAME',(2,0),(2,-1),'Helvetica-Bold'),('TEXTCOLOR',(0,0),(-1,-1),NAVY),('FONTSIZE',(0,0),(-1,-1),8),('GRID',(0,0),(-1,-1),.3,LIGHT),('BACKGROUND',(0,0),(-1,-1),colors.white),('BOTTOMPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5)]))
    story += [mt, Spacer(1, 10)]
    template = project.get('template_snapshot') or project.get('template') or {}
    categories = template.get('categories') or []
    recs = project.get('reviewer_recommendations') or {}
    responses = project.get('responses') or {}
    total = 0.0; total_max = float(template.get('total_max') or 0)
    rows = [['Section / Criterion', 'Client', 'Reviewer', 'Evidence']]
    for cat in categories:
        rows.append([str(cat.get('name') or 'Section'), '', '', ''])
        for cr in cat.get('criteria') or []:
            cid = cr.get('id'); client_r = responses.get(cid) or {}; review_r = recs.get(cid) or {}
            if cr.get('mandatory'):
                cv = 'Met' if client_r.get('met') else 'Not met'; rv = 'Met' if review_r.get('met') else 'Not met'
            else:
                cv = str(client_r.get('claimed_points', client_r.get('recommended_points', 0)) or 0)
                val = float(review_r.get('recommended_points', 0) or 0); total += min(max(val,0), float(cr.get('max_points') or 0)); rv = f"{val:g}/{float(cr.get('max_points') or 0):g}"
            ev = [f for f in (project.get('files') or []) if f.get('criterion_id') == cid]
            approved = sum(1 for f in ev if f.get('status') == 'approved')
            rows.append([Paragraph(f"{cr.get('code') or ''} {cr.get('name') or ''}", small), cv, rv, f"{approved}/{len(ev)} approved" if ev else 'None'])
    story += [Paragraph('Reviewer Scorecard', h2)]
    table = Table(rows, colWidths=[88*mm, 24*mm, 28*mm, 34*mm], repeatRows=1)
    style = [('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),7.5),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.25,LIGHT),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]
    for i,row in enumerate(rows[1:],1):
        if row[1] == '' and row[2] == '': style += [('BACKGROUND',(0,i),(-1,i),LIGHT),('FONTNAME',(0,i),(-1,i),'Helvetica-Bold'),('TEXTCOLOR',(0,i),(-1,i),NAVY)]
    table.setStyle(TableStyle(style)); story += [table, Spacer(1,10)]
    story += [Paragraph(f"Recommended score: <b>{total:g}/{total_max:g}</b>", h2)]
    comment = project.get('reviewer_comment') or 'No reviewer comments were recorded.'
    story += [Paragraph('Reviewer observations', h2), Paragraph(str(comment).replace('\n','<br/>'), body)]
    official = project.get('official_record') or {}
    if official:
        story += [Paragraph('Final decision', h2), Paragraph(f"Decision: <b>{str(official.get('decision') or '').title()}</b> &nbsp;&nbsp; Band: <b>{official.get('band') or '—'}</b> &nbsp;&nbsp; Final score: <b>{official.get('final_total',0)}/{official.get('total_max',0)}</b>", body)]
        if official.get('notes'): story += [Spacer(1,4), Paragraph(str(official['notes']), body)]
    story += [Spacer(1,12), Paragraph('This report is system-generated from the project checklist, reviewer recommendations and recorded evidence statuses. The final certification decision remains with the authorised administrator.', small)]
    doc.build(story)
    return buf.getvalue()
