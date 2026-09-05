export function defaultBulkInvoiceTemplate(): string {
  return "Hi {{customerName}}, please find invoice {{invoiceNumber}} for {{amount}}, due {{dueDate}}. View and pay: {{link}}";
}

export function defaultBulkReminderTemplate(): string {
  return "Hi {{customerName}}, this is a reminder that invoice {{invoiceNumber}} for {{amount}} is outstanding (due {{dueDate}}). View and pay: {{link}}";
}
