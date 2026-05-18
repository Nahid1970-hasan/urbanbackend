import express from "express";
import cors from "cors";
import { router } from "./routes/index.js";
import { apiRouter } from "./routes/api.routes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/", router);
  app.use("/api", apiRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
