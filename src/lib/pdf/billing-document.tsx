import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

/**
 * A4 print-ready quotation/invoice PDF (spec §10). Web preview (the detail
 * page) and this PDF both read the same stored totals and re-derive line
 * tax the same way (`src/lib/billing/tax.ts`), so a PDF generated today
 * always matches what's on screen (spec §33 "PDFs match on-screen totals").
 */

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  businessName: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  muted: { color: "#6b7280" },
  docTitle: { fontSize: 16, fontWeight: 700, textAlign: "right" },
  docMeta: { textAlign: "right", marginTop: 4 },
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, gap: 20 },
  partyBlock: { width: "48%" },
  partyLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  partyName: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 6,
  },
  th: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" },
  td: { fontSize: 9 },
  colDesc: { width: "34%", paddingRight: 6 },
  colQty: { width: "10%", textAlign: "right" },
  colRate: { width: "14%", textAlign: "right" },
  colDisc: { width: "10%", textAlign: "right" },
  colTax: { width: "12%", textAlign: "right" },
  colAmount: { width: "20%", textAlign: "right" },
  totalsBlock: { marginTop: 12, alignSelf: "flex-end", width: "45%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: "#6b7280" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#111827",
    marginTop: 4,
    paddingTop: 4,
  },
  grandLabel: { fontWeight: 700 },
  section: { marginTop: 16 },
  sectionLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#9ca3af", textAlign: "center" },
});

export type PdfLineItem = {
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  discountPercent: string;
  taxRatePercent: string;
  taxableAmount: string;
  taxAmount: string;
  lineTotal: string;
};

export type PdfParty = {
  name: string;
  addressLines: string[];
  gstin?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type PdfPaymentDetails = {
  bankAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  upiId?: string | null;
};

export function BillingDocumentPdf({
  kind,
  number,
  status,
  primaryDate,
  secondaryDate,
  business,
  customer,
  items,
  currency,
  subtotal,
  discountTotal,
  taxableValue,
  cgstTotal,
  sgstTotal,
  igstTotal,
  grandTotal,
  notes,
  termsAndConditions,
  payment,
}: {
  kind: "Quotation" | "Tax Invoice";
  number: string;
  status: string;
  primaryDate: { label: string; value: string };
  secondaryDate?: { label: string; value: string };
  business: PdfParty;
  customer: PdfParty;
  items: PdfLineItem[];
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxableValue: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  grandTotal: string;
  notes?: string | null;
  termsAndConditions?: string | null;
  payment?: PdfPaymentDetails;
}) {
  const hasCgstSgst = Number(cgstTotal) > 0 || Number(sgstTotal) > 0;
  const hasIgst = Number(igstTotal) > 0;
  const hasPaymentDetails =
    payment &&
    (payment.bankAccountName || payment.bankAccountNumber || payment.upiId);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.businessName}>{business.name}</Text>
            {business.addressLines.map((line, i) => (
              <Text key={i} style={styles.muted}>{line}</Text>
            ))}
            {business.gstin ? <Text style={styles.muted}>GSTIN: {business.gstin}</Text> : null}
            {business.email ? <Text style={styles.muted}>{business.email}</Text> : null}
            {business.phone ? <Text style={styles.muted}>{business.phone}</Text> : null}
          </View>
          <View>
            <Text style={styles.docTitle}>{kind.toUpperCase()}</Text>
            <Text style={styles.docMeta}>#{number}</Text>
            <Text style={[styles.docMeta, styles.muted]}>{status}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Bill to</Text>
            <Text style={styles.partyName}>{customer.name}</Text>
            {customer.addressLines.map((line, i) => (
              <Text key={i} style={styles.muted}>{line}</Text>
            ))}
            {customer.gstin ? <Text style={styles.muted}>GSTIN: {customer.gstin}</Text> : null}
            {customer.email ? <Text style={styles.muted}>{customer.email}</Text> : null}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>{primaryDate.label}</Text>
            <Text style={styles.partyName}>{primaryDate.value}</Text>
            {secondaryDate ? (
              <>
                <Text style={[styles.partyLabel, { marginTop: 8 }]}>{secondaryDate.label}</Text>
                <Text style={styles.partyName}>{secondaryDate.value}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDesc]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colRate]}>Rate</Text>
            <Text style={[styles.th, styles.colDisc]}>Disc</Text>
            <Text style={[styles.th, styles.colTax]}>Tax</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.td, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.td, styles.colQty]}>{item.quantity} {item.unit}</Text>
              <Text style={[styles.td, styles.colRate]}>{currency} {item.rate}</Text>
              <Text style={[styles.td, styles.colDisc]}>{item.discountPercent}%</Text>
              <Text style={[styles.td, styles.colTax]}>{item.taxRatePercent}%</Text>
              <Text style={[styles.td, styles.colAmount]}>{currency} {item.lineTotal}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{currency} {subtotal}</Text>
          </View>
          {Number(discountTotal) > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text>-{currency} {discountTotal}</Text>
            </View>
          ) : null}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Taxable value</Text>
            <Text>{currency} {taxableValue}</Text>
          </View>
          {hasCgstSgst ? (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>CGST</Text>
                <Text>{currency} {cgstTotal}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>SGST</Text>
                <Text>{currency} {sgstTotal}</Text>
              </View>
            </>
          ) : null}
          {hasIgst ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>IGST</Text>
              <Text>{currency} {igstTotal}</Text>
            </View>
          ) : null}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Grand total</Text>
            <Text style={styles.grandLabel}>{currency} {grandTotal}</Text>
          </View>
        </View>

        {notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text>{notes}</Text>
          </View>
        ) : null}

        {termsAndConditions ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Terms & conditions</Text>
            <Text>{termsAndConditions}</Text>
          </View>
        ) : null}

        {hasPaymentDetails ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Payment details</Text>
            {payment?.bankAccountName ? <Text>Account name: {payment.bankAccountName}</Text> : null}
            {payment?.bankName ? <Text>Bank: {payment.bankName}</Text> : null}
            {payment?.bankAccountNumber ? <Text>Account no.: {payment.bankAccountNumber}</Text> : null}
            {payment?.bankIfsc ? <Text>IFSC: {payment.bankIfsc}</Text> : null}
            {payment?.upiId ? <Text>UPI: {payment.upiId}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.footer}>Generated by Dotnapps Invoice</Text>
      </Page>
    </Document>
  );
}
