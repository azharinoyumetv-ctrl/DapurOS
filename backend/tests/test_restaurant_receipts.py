"""Inspect actual generated PDF/ESC-POS streams; no printer or provider calls."""
import base64
import re
import zlib
import pytest
from routes_pdf import _thermal_pdf, _invoice_pdf
from escpos import build_receipt_escpos

ORDER = {"id":"fixture-order", "order_no":"DP-FIXTURE", "created_at":"2026-10-29T00:00:00+00:00",
         "items":[{"product_id":"meal","name":"Menu fixture","quantity":2,"price":10000,"subtotal":20000}],
         "subtotal":20000,"discount":0,"service_charge":1000,"tax_percent":10,"tax_amount":2100,"tax_pb1":2100,
         "total":23100,"payment_method":"cash","payment_status":"paid","cash_received":25000,"change":1900}


def pdf_streams(data):
    content = []
    for stream in re.findall(rb"stream\r?\n(.*?)endstream", data, re.S):
        try:
            content.append(zlib.decompress(base64.a85decode(stream.strip(), adobe=True)))
        except (ValueError, zlib.error):
            pass
    return b"\n".join(content)


@pytest.mark.parametrize("renderer", [_thermal_pdf, _invoice_pdf])
def test_actual_receipt_pdf_has_one_service_line_and_balanced_restaurant_total(renderer):
    data = renderer(ORDER.copy(), {"name":"DapurOS fixture"})
    assert data.startswith(b"%PDF-")
    text = pdf_streams(data)
    assert text.count(b"Layanan") == 1
    assert b"PB1" in text and b"23.100" in text and b"1.000" in text and b"2.100" in text


def test_backend_thermal_commands_include_service_charge():
    result = build_receipt_escpos(ORDER.copy(), {"name":"DapurOS fixture"})
    assert result.count(b"Layanan") == 1 and b"23.100" in result and b"1.000" in result
