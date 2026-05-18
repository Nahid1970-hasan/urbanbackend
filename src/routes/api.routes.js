import { Router } from "express";
import { createItem, findAllItems } from "../models/item.model.js";

export const apiRouter = Router();

apiRouter.get("/items", async (_req, res, next) => {
  try {
    const items = await findAllItems();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

apiRouter.post("/items", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const item = await createItem({ name });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});
