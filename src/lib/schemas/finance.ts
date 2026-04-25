import { z } from "zod"

export const txnKindSchema = z.enum(["income", "expense", "transfer", "tax"])
export type TxnKind = z.infer<typeof txnKindSchema>

export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  kind: z.string().optional().nullable(),
  currency: z.string().default("BRL"),
  opening_balance: z.number().default(0),
})
export type Account = z.infer<typeof accountSchema>

export const transactionSchema = z.object({
  id: z.string().uuid().optional(),
  account_id: z.string().uuid().optional().nullable(),
  kind: txnKindSchema,
  amount: z.number().min(0.01),
  currency: z.string().default("BRL"),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  occurred_on: z.string(), // date ISO YYYY-MM-DD
})
export type Transaction = z.infer<typeof transactionSchema>
