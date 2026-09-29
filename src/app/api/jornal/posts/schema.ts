import { z } from "zod";
import { POST_CONTENT_MAX, POST_SUMMARY_MAX, POST_TITLE_MAX } from "@/lib/news";

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).transform((v) => v || null).nullable().optional();

export const postSchema = z.object({
  type: z.enum(["news", "notice", "tournament"]),
  title: z.string().trim().min(3, "Dê um título à publicação.").max(POST_TITLE_MAX, `Título com no máximo ${POST_TITLE_MAX} caracteres.`),
  summary: optionalText(POST_SUMMARY_MAX, `Resumo com no máximo ${POST_SUMMARY_MAX} caracteres.`),
  content: z.string().trim().min(1, "Escreva o texto da publicação.").max(POST_CONTENT_MAX, "Texto muito longo."),
  imageUrl: z
    .string()
    .trim()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\/\S+$/.test(v), "A imagem precisa ser um link https://")
    .nullable()
    .optional(),
  pinned: z.boolean().optional(),
});
