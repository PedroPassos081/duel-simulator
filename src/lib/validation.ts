import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(100),
  password: z.string().min(8),
});

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usuário deve ter pelo menos 3 caracteres")
  .max(24, "Usuário deve ter no máximo 24 caracteres")
  .regex(
    /^[a-z0-9_]+$/,
    "Use apenas letras minúsculas, números e sublinhado no usuário"
  );

// mínimo 8 chars, pelo menos 1 letra e 1 número — ajuste a política como quiser
const passwordField = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .regex(/[A-Za-z]/, "Senha deve conter letras")
  .regex(/[0-9]/, "Senha deve conter números");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  username: usernameField,
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: passwordField,
});

// Foto de perfil: imagem já redimensionada no navegador (256x256), como data URL.
const MAX_AVATAR_DATA_URL_LENGTH = 300_000;

export const profileUpdateSchema = z.object({
  username: usernameField.optional(),
  image: z
    .string()
    .max(MAX_AVATAR_DATA_URL_LENGTH, "Imagem muito grande")
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Formato de imagem inválido")
    .nullable()
    .optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordField,
});

export const equipCosmeticSchema = z.object({
  type: z.string().min(1),
  cosmeticId: z.string().min(1).nullable(),
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
