import { Router } from "express";
import multer from "multer";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

router.post("/convert-video", upload.single("video"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No video file provided" });
    return;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kontra-video-"));
  const inputPath = path.join(tmpDir, "input.webm");
  const outputPath = path.join(tmpDir, "kontra-pitch.mp4");

  try {
    await fs.writeFile(inputPath, req.file.buffer);

    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        [
          "-y",
          "-i", inputPath,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "22",
          "-pix_fmt", "yuv420p",
          "-movflags", "+faststart",
          "-an",
          outputPath,
        ],
        { maxBuffer: 200 * 1024 * 1024 },
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });

    const mp4Buffer = await fs.readFile(outputPath);
    res.set({
      "Content-Type": "video/mp4",
      "Content-Disposition": 'attachment; filename="kontra-pitch.mp4"',
      "Content-Length": String(mp4Buffer.length),
    });
    res.send(mp4Buffer);
  } catch (err: any) {
    console.error("[convert-video] Error:", err.message);
    res.status(500).json({ error: "Video conversion failed: " + err.message });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

export default router;
