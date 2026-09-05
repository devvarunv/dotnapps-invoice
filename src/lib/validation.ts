import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That password is too long");
const name = z.string().trim().min(2, "Enter a name").max(120);

export const signupSchema = z
  .object({
    name,
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const credentialsSchema = z.object({
  email,
  password: z.string().min(1),
});

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
});

export const renameBusinessSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
});

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(120),
  contactEmail: z.string().trim().toLowerCase().email().or(z.literal("")).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(2).default("IN"),
  gstin: z.string().trim().max(20).optional(),
  registrationType: z.enum(["UNREGISTERED", "REGULAR", "COMPOSITION"]),
  currency: z.string().trim().max(6).default("INR"),
  quotationPrefix: z.string().trim().max(12).optional(),
  invoicePrefix: z.string().trim().max(12).optional(),
  bankAccountName: z.string().trim().max(120).optional(),
  bankAccountNumber: z.string().trim().max(40).optional(),
  bankIfsc: z.string().trim().max(20).optional(),
  bankName: z.string().trim().max(120).optional(),
  upiId: z.string().trim().max(80).optional(),
});

// Assignable roles only — OWNER is never assigned through the invite / role UI.
const assignableRole = z.enum(["ADMIN", "ACCOUNTANT", "SALES", "STAFF"]);

export const inviteSchema = z.object({
  email,
  role: assignableRole,
});

export const changeRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: assignableRole,
});

export const membershipIdSchema = z.object({
  membershipId: z.string().min(1),
});

export const inviteIdSchema = z.object({
  inviteId: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const requestPasswordResetSchema = z.object({
  email,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Core billing — Customers, Products & Services, Quotations, Invoices
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(150),
  companyName: z.string().trim().max(150).optional(),
  email: z.string().trim().toLowerCase().email().or(z.literal("")).optional(),
  phone: z.string().trim().max(30).optional(),
  gstin: z.string().trim().max(20).optional(),
  billingAddressLine1: z.string().trim().max(200).optional(),
  billingAddressLine2: z.string().trim().max(200).optional(),
  billingCity: z.string().trim().max(100).optional(),
  billingState: z.string().trim().max(100).optional(),
  billingPostalCode: z.string().trim().max(20).optional(),
  billingCountry: z.string().trim().max(2).default("IN"),
  shippingSameAsBilling: z.coerce.boolean().default(true),
  shippingAddressLine1: z.string().trim().max(200).optional(),
  shippingAddressLine2: z.string().trim().max(200).optional(),
  shippingCity: z.string().trim().max(100).optional(),
  shippingState: z.string().trim().max(100).optional(),
  shippingPostalCode: z.string().trim().max(20).optional(),
  shippingCountry: z.string().trim().max(2).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const productServiceSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(150),
  description: z.string().trim().max(2000).optional(),
  sku: z.string().trim().max(60).optional(),
  hsnSac: z.string().trim().max(20).optional(),
  unit: z.string().trim().max(20).default("unit"),
  defaultPrice: z.coerce.number().min(0, "Must be zero or more"),
  taxRatePercent: z.coerce.number().min(0).max(100).default(0),
  isActive: z.coerce.boolean().default(true),
});

export const lineItemInputSchema = z.object({
  productServiceId: z.string().trim().optional(),
  description: z.string().trim().min(1, "Enter a description").max(300),
  quantity: z.coerce.number().positive("Must be greater than zero"),
  unit: z.string().trim().max(20).default("unit"),
  rate: z.coerce.number().min(0, "Must be zero or more"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  taxRatePercent: z.coerce.number().min(0).max(100).default(0),
});

export type LineItemInputForm = z.infer<typeof lineItemInputSchema>;

export const documentFormSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  notes: z.string().trim().max(2000).optional(),
  termsAndConditions: z.string().trim().max(2000).optional(),
  items: z.array(lineItemInputSchema).min(1, "Add at least one line item"),
});

export const quotationFormSchema = documentFormSchema.extend({
  quotationDate: z.string().min(1, "Pick a date"),
  validUntil: z.string().trim().optional(),
});

export const invoiceFormSchema = documentFormSchema.extend({
  invoiceDate: z.string().min(1, "Pick a date"),
  dueDate: z.string().trim().optional(),
  paymentTerms: z.string().trim().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Collections — Payments & Reminders
// ---------------------------------------------------------------------------

export const paymentMethodEnum = z.enum([
  "UPI",
  "BANK_TRANSFER",
  "CARD",
  "CASH",
  "CHEQUE",
  "OTHER",
]);

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  paymentDate: z.string().min(1, "Pick a date"),
  method: paymentMethodEnum,
  referenceId: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const reversePaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const reminderRuleUpdateSchema = z.object({
  ruleId: z.string().min(1),
  enabled: z.coerce.boolean(),
  channel: z.enum(["EMAIL", "WHATSAPP", "SMS"]),
  template: z.string().trim().min(1, "Template can't be empty").max(1000),
});

export const sendReminderSchema = z.object({
  invoiceId: z.string().min(1),
  kind: z.enum([
    "BEFORE_DUE_7",
    "BEFORE_DUE_2",
    "ON_DUE_DATE",
    "OVERDUE_3",
    "OVERDUE_7",
    "OVERDUE_30",
  ]),
});

// ---------------------------------------------------------------------------
// Bulk — Phase 4
// ---------------------------------------------------------------------------

const invoiceIdList = z
  .array(z.string().min(1))
  .min(1, "Select at least one invoice");

export const createBulkBatchSchema = z.object({
  invoiceIds: invoiceIdList,
  action: z.enum(["SEND_INVOICE", "SEND_REMINDER"]),
  channel: z.enum(["EMAIL", "WHATSAPP", "SMS"]),
});

export const bulkMarkPaidSchema = z.object({
  invoiceIds: invoiceIdList,
});

export const bulkIdListSchema = z.object({
  invoiceIds: invoiceIdList,
});

// ---------------------------------------------------------------------------
// Finance — Expenses (Phase 5)
// ---------------------------------------------------------------------------

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name").max(80),
});

export const expenseSchema = z.object({
  vendorName: z.string().trim().min(1, "Enter a vendor").max(150),
  amount: z.coerce.number().positive("Enter an amount greater than zero"),
  taxAmount: z.coerce.number().min(0).default(0),
  expenseDate: z.string().min(1, "Pick a date"),
  method: paymentMethodEnum,
  categoryId: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// SaaS — Subscriptions & Super Admin (Phase 6)
// ---------------------------------------------------------------------------

export const changePlanSchema = z.object({
  planId: z.string().min(1),
});

export const planFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a plan name").max(60),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  priceMonthly: z.coerce.number().min(0),
  sortOrder: z.coerce.number().int().min(0).default(0),
  maxUsers: z.string().trim().optional(),
  maxCustomers: z.string().trim().optional(),
  maxInvoicesPerMonth: z.string().trim().optional(),
  maxQuotationsPerMonth: z.string().trim().optional(),
  maxBulkSendsPerMonth: z.string().trim().optional(),
  maxStorageMB: z.string().trim().optional(),
});

export const setSubscriptionStatusSchema = z.object({
  businessId: z.string().min(1),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELED"]),
});
