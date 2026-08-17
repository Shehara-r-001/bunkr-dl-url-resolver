import { z } from 'zod';

export const BunkrSignResponseSchema = z.object({
  token: z.string().optional(),
  ex: z.union([z.string(), z.number()]).optional(),
  success: z.boolean().optional(),
  message: z.string().optional()
});

export type BunkrSignResponse = z.infer<typeof BunkrSignResponseSchema>;

export const BunkrDownloadApiResponseSchema = z.object({
  mediafiles: z.string().optional(),
  path: z.string().optional(),
  success: z.boolean().optional(),
  message: z.string().optional()
});

export type BunkrDownloadApiResponse = z.infer<typeof BunkrDownloadApiResponseSchema>;
