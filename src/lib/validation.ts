import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(100),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Usuário deve ter pelo menos 3 caracteres")
    .max(24, "Usuário deve ter no máximo 24 caracteres")
    .regex(
      /^[a-z0-9_]+$/,
      "Use apenas letras minúsculas, números e sublinhado no usuário"
    ),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  // mínimo 8 chars, pelo menos 1 letra e 1 número — ajuste a política como quiser
  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Za-z]/, "Senha deve conter letras")
    .regex(/[0-9]/, "Senha deve conter números"),
});

export const verificationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/, "Digite o código de 6 dígitos"),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const purchaseSchema = z.object({
  cardId: z.number().int().positive(),
  currency: z.enum(["gold", "cash"]),
});

export const deckSaveSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(80),
  cards: z.array(
    z.object({
      cardId: z.number().int().positive(),
      section: z.enum(["main", "extra", "side"]),
      quantity: z.number().int().min(1).max(3),
    })
  ),
});
