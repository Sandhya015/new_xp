"""
Server-side order / tax invoice pricing per Tax Invoice Working Documentation.

- Course catalogue price is GST-inclusive at 18% (SAC 999293).
- Training kit optional add-on is GST-inclusive at 12% (HSN 4820).
- Coupons apply to the course line only (GST-inclusive catalogue price). The training kit
  line is not discounted. Percent-off is computed on the course inclusive amount; flat
  rupees-off is capped at the course inclusive amount.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


COURSE_GST_PERCENT = 18.0
KIT_GST_PERCENT = 12.0
COURSE_SAC = "999293"
KIT_HSN = "4820"


def _gst_factor(gst_percent: float) -> float:
    return 1.0 + max(0.0, float(gst_percent)) / 100.0


def split_inclusive_to_taxable_and_gst(gross: float, gst_percent: float) -> tuple[float, float, float]:
    """Return (taxable_value, gst_amount, gross) for GST-inclusive gross."""
    g = max(0.0, round(float(gross), 2))
    if g <= 0:
        return 0.0, 0.0, 0.0
    f = _gst_factor(gst_percent)
    taxable = round(g / f, 2)
    gst_amt = round(g - taxable, 2)
    return taxable, gst_amt, g


@dataclass(frozen=True)
class AllocatedCouponResult:
    coupon_code: str
    inclusive_subtotal_before: float
    inclusive_discount: float
    course_inclusive_after: float
    kit_inclusive_after: float


def allocate_coupon_inclusive_discount(
    course_gross: float,
    kit_gross: float,
    coupon: dict[str, Any] | None,
    coupon_code: str,
) -> AllocatedCouponResult:
    """Apply coupon to the course inclusive line only; kit gross is unchanged."""
    cg = max(0.0, round(float(course_gross), 2))
    kg = max(0.0, round(float(kit_gross), 2))
    sub = round(cg + kg, 2)
    code = (coupon_code or "").strip().upper()
    disc = 0.0
    if coupon and code:
        if coupon.get("percentOff") is not None:
            try:
                pct = max(0.0, float(coupon.get("percentOff")))
                disc = round(cg * (pct / 100.0), 2)
            except (TypeError, ValueError):
                disc = 0.0
            cap = coupon.get("maxDiscountInr")
            if cap is not None:
                try:
                    disc = min(disc, max(0.0, float(cap)))
                except (TypeError, ValueError):
                    pass
        elif coupon.get("rupeesOff") is not None:
            try:
                disc = max(0.0, float(coupon.get("rupeesOff")))
            except (TypeError, ValueError):
                disc = 0.0
        disc = min(disc, cg)

    course_after = round(cg - disc, 2)
    kit_after = kg
    return AllocatedCouponResult(
        coupon_code=code if disc > 0 else "",
        inclusive_subtotal_before=sub,
        inclusive_discount=disc,
        course_inclusive_after=course_after,
        kit_inclusive_after=kit_after,
    )


@dataclass(frozen=True)
class OrderPricingBreakdown:
    course_list_gross: float
    kit_list_gross: float
    coupon_code: str
    coupon_inclusive_off: float
    course_inclusive_after_coupon: float
    kit_inclusive_after_coupon: float
    grand_total_inclusive: float

    course_taxable_list: float
    kit_taxable_list: float
    taxable_subtotal: float

    course_taxable_after_coupon: float
    kit_taxable_after_coupon: float
    coupon_taxable_discount: float
    net_taxable: float

    course_gst_amount: float
    kit_gst_amount: float
    total_gst: float

    course_gst_rate: float
    kit_gst_rate: float

    round_off: float


def build_order_pricing_breakdown(
    course_gross: float,
    kit_gross_if_included: float,
    include_kit: bool,
    coupon: dict[str, Any] | None,
    coupon_code: str,
) -> OrderPricingBreakdown:
    cg = max(0.0, round(float(course_gross), 2))
    kg = max(0.0, round(float(kit_gross_if_included), 2)) if include_kit else 0.0

    alloc = allocate_coupon_inclusive_discount(cg, kg, coupon, coupon_code)

    c_list_tx, _, _ = split_inclusive_to_taxable_and_gst(cg, COURSE_GST_PERCENT)
    k_list_tx, _, _ = split_inclusive_to_taxable_and_gst(kg, KIT_GST_PERCENT) if kg > 0 else (0.0, 0.0, 0.0)

    c_after_tx, c_gst, _ = split_inclusive_to_taxable_and_gst(
        alloc.course_inclusive_after, COURSE_GST_PERCENT
    )
    k_after_tx, k_gst, _ = (
        split_inclusive_to_taxable_and_gst(alloc.kit_inclusive_after, KIT_GST_PERCENT)
        if alloc.kit_inclusive_after > 0
        else (0.0, 0.0, 0.0)
    )

    coupon_taxable = round(max(0.0, (c_list_tx - c_after_tx) + (k_list_tx - k_after_tx)), 2)
    taxable_sub = round(c_list_tx + k_list_tx, 2)
    net_taxable = round(c_after_tx + k_after_tx, 2)
    total_gst = round(c_gst + k_gst, 2)
    grand = round(alloc.course_inclusive_after + alloc.kit_inclusive_after, 2)
    recomposed = round(net_taxable + total_gst, 2)
    round_off = round(grand - recomposed, 2)

    return OrderPricingBreakdown(
        course_list_gross=cg,
        kit_list_gross=kg,
        coupon_code=alloc.coupon_code,
        coupon_inclusive_off=alloc.inclusive_discount,
        course_inclusive_after_coupon=alloc.course_inclusive_after,
        kit_inclusive_after_coupon=alloc.kit_inclusive_after,
        grand_total_inclusive=grand,
        course_taxable_list=round(c_list_tx, 2),
        kit_taxable_list=round(k_list_tx, 2),
        taxable_subtotal=taxable_sub,
        course_taxable_after_coupon=round(c_after_tx, 2),
        kit_taxable_after_coupon=round(k_after_tx, 2),
        coupon_taxable_discount=coupon_taxable,
        net_taxable=net_taxable,
        course_gst_amount=round(c_gst, 2),
        kit_gst_amount=round(k_gst, 2),
        total_gst=total_gst,
        course_gst_rate=COURSE_GST_PERCENT,
        kit_gst_rate=KIT_GST_PERCENT,
        round_off=round_off,
    )


def breakdown_to_pricing_dict(b: OrderPricingBreakdown) -> dict[str, Any]:
    """Shape returned to frontend at create-order (extends legacy keys)."""
    return {
        "courseListGross": b.course_list_gross,
        "courseGstPercent": b.course_gst_rate,
        "courseBaseInr": b.course_taxable_list,
        "courseGstInr": round(b.course_list_gross - b.course_taxable_list, 2),
        "afterCouponGross": b.course_inclusive_after_coupon,
        "afterCouponBaseInr": b.course_taxable_after_coupon,
        "afterCouponGstInr": b.course_gst_amount,
        "couponCode": b.coupon_code,
        "couponInclusiveOffInr": b.coupon_inclusive_off,
        "couponTaxableDiscountInr": b.coupon_taxable_discount,
        "trainingKitGross": b.kit_list_gross,
        "kitGstPercent": b.kit_gst_rate,
        "trainingKitBaseInr": b.kit_taxable_list,
        "trainingKitGstInr": round(b.kit_list_gross - b.kit_taxable_list, 2) if b.kit_list_gross > 0 else 0.0,
        "afterCouponKitGross": b.kit_inclusive_after_coupon,
        "afterCouponKitBaseInr": b.kit_taxable_after_coupon,
        "afterCouponKitGstInr": b.kit_gst_amount,
        "totalGrossInr": b.grand_total_inclusive,
        "totalBaseInr": b.net_taxable,
        "totalGstInr": b.total_gst,
        "taxableSubtotalInr": b.taxable_subtotal,
        "netTaxableInr": b.net_taxable,
        "roundOffInr": b.round_off,
        "gstPercent": b.course_gst_rate,
    }
