"""Bank EDC provider contract. Unavailable integrations never approve a charge.

Manual terminal payments are recorded only after the cashier confirms the bank
terminal approved them. Connected processing requires a certified bank SDK.
"""
from __future__ import annotations
from typing import Optional, Protocol


class EDCResult:
    def __init__(
        self,
        success: bool,
        provider: str,
        transaction_id: Optional[str] = None,
        approval_code: Optional[str] = None,
        card_type: Optional[str] = None,
        last4: Optional[str] = None,
        raw: Optional[dict] = None,
        error: Optional[str] = None,
    ):
        self.success = success
        self.provider = provider
        self.transaction_id = transaction_id
        self.approval_code = approval_code
        self.card_type = card_type
        self.last4 = last4
        self.raw = raw or {}
        self.error = error

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "provider": self.provider,
            "transaction_id": self.transaction_id,
            "approval_code": self.approval_code,
            "card_type": self.card_type,
            "last4": self.last4,
            "error": self.error,
        }


class EDCProvider(Protocol):
    """Contract every real bank EDC integration must implement."""
    name: str

    async def charge(self, amount: int, order_ref: str) -> EDCResult: ...
    async def void(self, transaction_id: str) -> EDCResult: ...
    async def status(self, transaction_id: str) -> EDCResult: ...


class NotConfiguredProvider:
    """Honest stub for a bank whose SDK isn't wired in yet -- every method fails clearly
    instead of pretending to process a card."""

    def __init__(self, name: str):
        self.name = name

    async def charge(self, amount: int, order_ref: str) -> EDCResult:
        return EDCResult(False, self.name, error=f"Integrasi EDC {self.name} belum tersedia -- SDK & sertifikasi bank belum terpasang.")

    async def void(self, transaction_id: str) -> EDCResult:
        return EDCResult(False, self.name, error=f"Integrasi EDC {self.name} belum tersedia.")

    async def status(self, transaction_id: str) -> EDCResult:
        return EDCResult(False, self.name, error=f"Integrasi EDC {self.name} belum tersedia.")




BANK_LABELS = {"bca": "BCA", "mandiri": "Mandiri", "bri": "BRI", "bni": "BNI"}


def get_edc_provider(provider_id: str) -> EDCProvider:
    provider_id = (provider_id or "").lower().strip()
    label = BANK_LABELS.get(provider_id)
    if not label:
        return NotConfiguredProvider(provider_id or "(belum dipilih)")
    return NotConfiguredProvider(label)
