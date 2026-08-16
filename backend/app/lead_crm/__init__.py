"""Multi-source lead management CRM (canonical leads + timeline events)."""

from app.lead_crm.service import ingest_lead_event

__all__ = ["ingest_lead_event"]
