import type { Receipt } from '../types';

export const GST_RATE = 0.15;

/**
 * Extract GST from a GST-inclusive amount (NZ 15% GST).
 * GST = inclusive * 15/115
 */
export function gstFromInclusive(inclusive: number): number {
  return Math.round(((inclusive * 15) / 115) * 100) / 100;
}

/**
 * Get net (ex-GST) amount from a GST-inclusive amount.
 * Net = inclusive * 100/115
 */
export function netFromInclusive(inclusive: number): number {
  return Math.round(((inclusive * 100) / 115) * 100) / 100;
}

/**
 * NZ GST bimonthly periods: Jan-Feb, Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec.
 * Returns ISO date strings for start/end of the period containing `date`.
 */
export function gstPeriod(date: Date): { start: string; end: string; label: string } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed

  // Bimonthly index: 0 = Jan-Feb, 1 = Mar-Apr, 2 = May-Jun, 3 = Jul-Aug, 4 = Sep-Oct, 5 = Nov-Dec
  const periodIndex = Math.floor(month / 2);
  const startMonth = periodIndex * 2; // 0-indexed
  const endMonth = startMonth + 1; // 0-indexed

  const startDate = new Date(Date.UTC(year, startMonth, 1));
  // Last day of endMonth
  const endDate = new Date(Date.UTC(year, endMonth + 1, 0));

  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${MONTH_NAMES[startMonth]}-${MONTH_NAMES[endMonth]} ${year}`;

  return { start: startStr, end: endStr, label };
}

export interface GSTSummary {
  period_start: string;
  period_end: string;
  total_purchases_inclusive: number;
  total_gst_claimable: number;
  total_gst_non_claimable: number;
  special_adjustments_count: number;
  box_11: number;
  box_12: number;
  box_13_adjustments: number;
  receipt_count: number;
}

interface ReceiptWithCategory extends Receipt {
  category_gst_claim_mode: string | null;
}

/**
 * Summarize GST for a set of confirmed receipts.
 * Receipts must include category_gst_claim_mode joined from final_category.
 */
export function summarizeGST(
  receipts: ReceiptWithCategory[],
  periodStart: string,
  periodEnd: string
): GSTSummary {
  let totalPurchasesInclusive = 0;
  let totalGstClaimable = 0;
  let totalGstNonClaimable = 0;
  let specialAdjustmentsCount = 0;

  for (const r of receipts) {
    const amount = r.total_amount ?? 0;
    const gst = r.gst_amount ?? gstFromInclusive(amount);

    totalPurchasesInclusive += amount;

    // Determine effective GST claim mode from receipt's gst_treatment first,
    // then fall back to category setting.
    const treatment = r.gst_treatment;
    const categoryMode = r.category_gst_claim_mode;

    if (treatment === 'special_adjustment' || categoryMode === 'special_adjustment') {
      specialAdjustmentsCount += 1;
      // NZ meals/entertainment: only 50% of GST is claimable (IRD rule)
      totalGstClaimable += gst * 0.5;
      totalGstNonClaimable += gst * 0.5;
    } else if (treatment === '100_claimable') {
      totalGstClaimable += gst;
    } else if (treatment === '0_claimable') {
      totalGstNonClaimable += gst;
    } else {
      // Fallback to category mode
      if (categoryMode === 'claimable') {
        totalGstClaimable += gst;
      } else if (categoryMode === 'non_claimable') {
        totalGstNonClaimable += gst;
      } else if (categoryMode === 'mixed') {
        // 50/50 split for mixed (entertainment-style)
        totalGstClaimable += gst * 0.5;
        totalGstNonClaimable += gst * 0.5;
      } else {
        // No category — default to claimable
        totalGstClaimable += gst;
      }
    }
  }

  // Round to 2 decimal places
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    period_start: periodStart,
    period_end: periodEnd,
    total_purchases_inclusive: round2(totalPurchasesInclusive),
    total_gst_claimable: round2(totalGstClaimable),
    total_gst_non_claimable: round2(totalGstNonClaimable),
    special_adjustments_count: specialAdjustmentsCount,
    // Box 11: Total taxable sales/supplies (this app tracks purchases, not sales — always 0)
    box_11: 0,
    // Box 12: Total purchases and expenses (inclusive of GST)
    box_12: round2(totalPurchasesInclusive),
    // Box 13: Adjustments for private use (not auto-calculated here)
    box_13_adjustments: 0,
    receipt_count: receipts.length,
  };
}
