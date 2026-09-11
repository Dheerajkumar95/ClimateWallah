# ClimateWallah — Phase 1 Production Upgrade

Implemented on top of the production Razorpay + QR/UPI payment build.

## Added
- Client and reviewer notification center with unread state.
- Notifications for reviewer assignment/reassignment/removal, payment receipt readiness, reviewer plan activation, and project finalization.
- Client and reviewer Invoices & Receipts pages.
- Server-generated PDF receipt/tax-invoice document for verified paid transactions.
- Stable invoice number stored on successful payment application.
- Admin Audit Trail page in Certification workspace.
- Append-only audit records for billing settings, gateway settings, QR approval/rejection, reviewer assignment/unassignment, and final project decisions.
- Sensitive audit metadata redaction for payment secrets/password/bank fields.
- Additional MongoDB indexes for notifications and audit logs.

## Existing workflow preserved
- Draft -> payment -> submitted -> reviewer assigned -> under review -> changes requested/resubmission -> forwarded -> admin finalization.
- Reviewer workload/due-date/priority assignment controls.
- Razorpay verification and QR/UPI manual admin verification.
- Reviewer earnings and payouts.
- Certification certificate and docket PDFs.

## Validation
- Frontend production build: PASS.
- Python compile validation for modified backend modules: PASS.
- Payment invoice PDF generation smoke test: PASS.
- Existing pytest suite could not start in this container because the repository's pytest configuration requires pytest-xdist, which is not installed in the current environment.
