"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, User, Calendar, Tag } from "lucide-react";
import { saveInvoiceAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field, Card, CardHeader, CardTitle, CardContent } from "@/components/ui/primitives";
import { IconField } from "@/components/ui/icon-field";
import { buttonClassName } from "@/components/ui/button";
import { FormError } from "@/components/form";
import { LineItemEditor, type EditableProduct, type EditableLineItem } from "@/components/app/line-item-editor";
import { DocumentPreviewCard } from "@/components/app/document-preview-card";
import { todayDateInputValue, cn } from "@/lib/utils";

export type InvoiceFormValues = {
  id: string;
  customerId: string;
  invoiceDate: string;
  dueDate: string | null;
  paymentTerms: string | null;
  notes: string | null;
  termsAndConditions: string | null;
  items: EditableLineItem[];
};

export function InvoiceForm({
  customers,
  products,
  currency,
  businessName,
  defaultCustomerId,
  invoice,
  title,
  backHref,
  backLabel,
  headerBadge,
}: {
  customers: { id: string; name: string; companyName: string | null }[];
  products: EditableProduct[];
  currency: string;
  businessName: string;
  defaultCustomerId?: string;
  invoice?: InvoiceFormValues;
  title: string;
  backHref: string;
  backLabel: string;
  headerBadge?: React.ReactNode;
}) {
  const [state, action, isPending] = useActionState(saveInvoiceAction, IDLE);
  const today = todayDateInputValue();
  const formId = "invoice-form";

  const [customerId, setCustomerId] = useState(invoice?.customerId ?? defaultCustomerId ?? "");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoiceDate ?? today);
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [paymentTerms, setPaymentTerms] = useState(invoice?.paymentTerms ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [termsAndConditions, setTermsAndConditions] = useState(invoice?.termsAndConditions ?? "");
  const [items, setItems] = useState<EditableLineItem[]>(invoice?.items ?? []);

  const customerName = useMemo(() => {
    const c = customers.find((c) => c.id === customerId);
    return c ? `${c.name}${c.companyName ? ` (${c.companyName})` : ""}` : undefined;
  }, [customers, customerId]);

  return (
    <div>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {backLabel}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {headerBadge}
        </div>
        <button
          type="submit"
          form={formId}
          disabled={isPending}
          className={cn(buttonClassName({ size: "lg" }), "disabled:opacity-70")}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? "Saving…" : invoice ? "Save changes" : "Save as draft"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <form id={formId} action={action} className="min-w-0 space-y-6">
          <input type="hidden" name="invoiceId" value={invoice?.id ?? ""} />

          <Card>
            <CardHeader>
              <CardTitle>Invoice information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Customer" htmlFor="customerId" error={state.fieldErrors?.customerId}>
                <IconField icon={User}>
                  <Select
                    id="customerId"
                    name="customerId"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a customer
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.companyName ? ` (${c.companyName})` : ""}
                      </option>
                    ))}
                  </Select>
                </IconField>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Invoice date" htmlFor="invoiceDate" error={state.fieldErrors?.invoiceDate}>
                  <IconField icon={Calendar}>
                    <Input
                      id="invoiceDate"
                      name="invoiceDate"
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      required
                    />
                  </IconField>
                </Field>
                <Field label="Due date" htmlFor="dueDate">
                  <IconField icon={Calendar}>
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </IconField>
                </Field>
              </div>

              <Field label="Payment terms" htmlFor="paymentTerms">
                <IconField icon={Tag}>
                  <Input
                    id="paymentTerms"
                    name="paymentTerms"
                    placeholder="e.g. Net 15"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  />
                </IconField>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice items</CardTitle>
            </CardHeader>
            <CardContent>
              <LineItemEditor
                name="items"
                products={products}
                currency={currency}
                fieldError={state.fieldErrors?.items}
                initialItems={invoice?.items}
                onChange={setItems}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes &amp; terms</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Notes" htmlFor="notes">
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Visible to the customer"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <Field label="Terms & conditions" htmlFor="termsAndConditions">
                <Textarea
                  id="termsAndConditions"
                  name="termsAndConditions"
                  rows={3}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <FormError message={state.error} />
        </form>

        <div className="lg:sticky lg:top-6">
          <DocumentPreviewCard
            kind="Invoice"
            numberLabel={invoice ? "Editing existing invoice" : "Number assigned on save"}
            businessName={businessName}
            customerName={customerName}
            primaryDateLabel="Invoice date"
            primaryDateValue={invoiceDate}
            secondaryDateLabel="Due date"
            secondaryDateValue={dueDate}
            items={items}
            currency={currency}
            notes={notes}
          />
        </div>
      </div>
    </div>
  );
}
