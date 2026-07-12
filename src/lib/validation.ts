import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  // mínimo 8 chars, pelo menos 1 letra e 1 número — ajuste a política como quiser
  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .regex(/[A-Za-z]/, "Senha deve conter letras")
    .regex(/[0-9]/, "Senha deve conter números"),
});

export const purchaseSchema = z.object({
  cardId: z.number().int().positive(),
  currency: z.enum(["gold", "cash"]),
});

export const deckSaveSchema = z.object({
  name: z.string().min(1).max(80),
  cards: z.array(
    z.object({
      cardId: z.number().int().positive(),
      section: z.enum(["main", "extra", "side"]),
      quantity: z.number().int().min(1).max(3),
    })
  ),
});
