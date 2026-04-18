import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

app.get("/api/download-codebase", (_req, res) => {
  const filePath = require("path").resolve(__dirname, "../../../full-codebase.txt");
  res.setHeader("Content-Disposition", "attachment; filename=full-codebase.txt");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.sendFile(filePath);
});

app.get("/api/download-project", (_req, res) => {
  const filePath = "/tmp/shevet-manager.tar.gz";
  res.setHeader("Content-Disposition", "attachment; filename=shevet-manager.tar.gz");
  res.setHeader("Content-Type", "application/gzip");
  res.sendFile(filePath);
});

app.get("/api/download-prompt", (_req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.join("/home/runner/workspace", ".local", "shevet-manager-prompt.md");
    const content = fs.readFileSync(filePath, "utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=shevet-manager-prompt.md");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.send(content);
  } catch {
    res.status(500).json({ error: "file not found" });
  }
});

export default app;
