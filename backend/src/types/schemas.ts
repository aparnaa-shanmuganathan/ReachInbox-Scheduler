import { z } from "zod";

export const CreateCampaignSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(255),
  body: z.string().min(1, "Body is required"),
  startTime: z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), "Invalid startTime"),
  delayBetweenEmailsMs: z.coerce.number().int().min(0).default(2000),
  hourlyLimitPerSender: z.coerce.number().int().min(1).default(200),
  // Recipients arrive from the frontend as a JSON-encoded string (multipart/form-data
  // fields are always strings — there's no native array type on the wire), so we parse
  // it before validating shape. Also accepts a real array for non-multipart JSON callers.
  recipients: z.preprocess((val) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return undefined;
      }
    }
    return val;
  }, z.array(z.string().email()).optional()),
});

export const ListEmailsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
