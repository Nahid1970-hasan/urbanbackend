import { Router } from "express";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "urbanbackend" });
});

router.get("/", (_req, res) => {
  res.json({ message: "Urban backend API" });
});
