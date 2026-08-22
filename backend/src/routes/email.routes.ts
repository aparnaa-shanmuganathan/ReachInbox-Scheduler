import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.middleware";
import {
  listScheduledEmails,
  listSenders,
  listSentEmails,
  scheduleCampaign,
} from "../controllers/email.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  // 50MB — enough for the leads file plus short video-clip attachments, not just images.
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const emailRouter = Router();

emailRouter.use(requireAuth);

emailRouter.post(
  "/campaigns",
  upload.fields([
    { name: "leadsFile", maxCount: 1 },
    { name: "attachments", maxCount: 10 },
  ]),
  scheduleCampaign,
);
emailRouter.get("/emails/scheduled", listScheduledEmails);
emailRouter.get("/emails/sent", listSentEmails);
emailRouter.get("/senders", listSenders);
