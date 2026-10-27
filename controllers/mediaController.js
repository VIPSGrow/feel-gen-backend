const db = require("../config/db");
const fs = require("fs/promises");
const path = require("path");

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db
      .query(
        `CREATE TABLE IF NOT EXISTS media (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255),
          description TEXT,
          media_type VARCHAR(10) NOT NULL,
          file_url TEXT NOT NULL,
          file_name TEXT NOT NULL,
          mime_type VARCHAR(100),
          file_size BIGINT,
          status VARCHAR(10) NOT NULL DEFAULT 'active',
          uploaded_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      )
      .catch((e) => {
        tableReady = null;
        throw e;
      });
  }
  return tableReady;
}

// POST /api/media (admin) - multipart: file(s) in "media"/any field, optional title, description
exports.uploadMedia = async (req, res) => {
  try {
    await ensureTable();
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const saved = [];
    for (const file of files) {
      const isImage = IMAGE_TYPES.includes(file.mimetype);
      const isVideo = VIDEO_TYPES.includes(file.mimetype);
      if (!isImage && !isVideo) {
        return res.status(400).json({
          success: false,
          message: `Unsupported file type: ${file.mimetype}`,
        });
      }
      const type = isImage ? "image" : "video";
      const dir = `uploads/media/${type}s`;
      await fs.mkdir(dir, { recursive: true });
      const safe = path.basename(file.originalname).replace(/[^\w.\-]/g, "_");
      const fileName = `${Date.now()}_${Math.round(Math.random() * 1e6)}_${safe}`;
      await fs.writeFile(path.join(dir, fileName), file.buffer);
      const url = `${process.env.APP_URL}/${dir}/${fileName}`;

      const r = await db.query(
        `INSERT INTO media (title, description, media_type, file_url, file_name, mime_type, file_size, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          req.body.title || null,
          req.body.description || null,
          type,
          url,
          fileName,
          file.mimetype,
          file.size,
          req.user?.id || null,
        ],
      );
      saved.push(r.rows[0]);
    }
    res.status(201).json({ success: true, data: saved });
  } catch (e) {
    console.error("uploadMedia error:", e);
    res.status(500).json({ success: false, message: "Media upload failed" });
  }
};

function listByType(type, adminView) {
  return async (req, res) => {
    try {
      await ensureTable();
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
      const where = adminView ? "" : "AND status = 'active'";
      const typeClause = type ? "media_type = $1" : "TRUE";
      const params = type ? [type] : [];
      const total = await db.query(
        `SELECT COUNT(*) FROM media WHERE ${typeClause} ${where}`,
        params,
      );
      const rows = await db.query(
        `SELECT * FROM media WHERE ${typeClause} ${where}
         ORDER BY created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      );
      res.json({
        success: true,
        total: parseInt(total.rows[0].count),
        page,
        limit,
        data: rows.rows,
      });
    } catch (e) {
      console.error("listMedia error:", e);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
}

// Public
exports.getImages = listByType("image", false);
exports.getVideos = listByType("video", false);
// Admin (includes inactive, all types)
exports.adminList = (req, res) =>
  listByType(
    ["image", "video"].includes(req.query.type) ? req.query.type : null,
    true,
  )(req, res);

exports.toggleStatus = async (req, res) => {
  try {
    await ensureTable();
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const r = await db.query(
      `UPDATE media SET status = CASE WHEN status='active' THEN 'inactive' ELSE 'active' END
       WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (!r.rows.length) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    console.error("toggleStatus error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    await ensureTable();
    const r = await db.query("DELETE FROM media WHERE id = $1 RETURNING *", [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ success: false, message: "Not found" });
    const m = r.rows[0];
    await fs
      .unlink(path.join("uploads/media", `${m.media_type}s`, m.file_name))
      .catch(() => {});
    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
