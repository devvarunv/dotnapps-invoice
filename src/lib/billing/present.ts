import type { Prisma } from "@prisma/client";
import { computeLineItem } from "./tax";
import type { PdfLineItem, PdfParty } from "@/lib/pdf/billing-document";

type RawItem = {
  description: string;
  quantity: Prisma.Decimal;
  unit: string;
  rate: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  taxRatePercent: Prisma.Decimal;
};

/** Re-derive each line's tax/total for display from its stored inputs — see
 * schema comment on QuotationItem/InvoiceItem for why we don't persist
 * per-line tax/total separately. */
export function toPdfItems(items: RawItem[]): PdfLineItem[] {
  return items.map((item) => {
    const computed = computeLineItem({
      quantity: item.quantity.toString(),
      rate: item.rate.toString(),
      discountPercent: item.discountPercent.toString(),
      taxRatePercent: item.taxRatePercent.toString(),
    });
    return {
      description: item.description,
      quantity: item.quantity.toString(),
      unit: item.unit,
      rate: item.rate.toString(),
      discountPercent: item.discountPercent.toString(),
      taxRatePercent: item.taxRatePercent.toString(),
      taxableAmount: computed.amount.toString(),
      taxAmount: computed.taxAmount.toString(),
      lineTotal: computed.lineTotal.toString(),
    };
  });
}

export function businessAddressLines(business: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
}): string[] {
  const cityLine = [business.city, business.state, business.postalCode].filter(Boolean).join(", ");
  return [business.addressLine1, business.addressLine2, cityLine, business.country]
    .filter((l): l is string => Boolean(l && l.trim()));
}

export function customerAddressLines(customer: {
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string;
}): string[] {
  const cityLine = [customer.billingCity, customer.billingState, customer.billingPostalCode]
    .filter(Boolean)
    .join(", ");
  return [customer.billingAddressLine1, customer.billingAddressLine2, cityLine, customer.billingCountry]
    .filter((l): l is string => Boolean(l && l.trim()));
}

export function toPdfBusinessParty(business: {
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  gstin: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}): PdfParty {
  return {
    name: business.name,
    addressLines: businessAddressLines(business),
    gstin: business.gstin,
    email: business.contactEmail,
    phone: business.contactPhone,
  };
}

export function toPdfCustomerParty(customer: {
  name: string;
  companyName: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string;
  gstin: string | null;
  email: string | null;
  phone: string | null;
}): PdfParty {
  return {
    name: customer.companyName ? `${customer.name} (${customer.companyName})` : customer.name,
    addressLines: customerAddressLines(customer),
    gstin: customer.gstin,
    email: customer.email,
    phone: customer.phone,
  };
}
