const pool = require("../config/db");
const slugify = require("slugify");
const fs = require("fs/promises");
const path = require("path");

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function saveBlogFile(file) {
  const uploadDir = path.join("uploads", "blog");
  await fs.mkdir(uploadDir, { recursive: true });

  const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
  const filePath = path.join(uploadDir, fileName);

  await fs.writeFile(filePath, file.buffer);

  // Fallback if APP_URL is not set in .env
  const baseUrl = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, "")
    : "";
  return `${baseUrl}/uploads/blog/${fileName}`;
}

function validateBlogFile(file, fieldName) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return `Invalid file type for ${fieldName}: ${file.mimetype}. Allowed types: jpeg, jpg, png, webp, gif`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large for ${fieldName} (max 10MB)`;
  }
  return null;
}

const blogController = {
  // ==================== CATEGORY METHODS ====================
  getAllCategories: async (req, res) => {
    try {
      const query = `SELECT * FROM blog_categories ORDER BY name ASC;`;
      const { rows } = await pool.query(query);
      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getCategoryById: async (req, res) => {
    const { id } = req.params;
    try {
      const query = `SELECT * FROM blog_categories WHERE id = $1`;
      const { rows } = await pool.query(query, [id]);

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Category not found" });
      }

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  createCategory: async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }
    const slug = slugify(name, { lower: true, strict: true });

    try {
      const query = `
        INSERT INTO blog_categories (name, slug)
        VALUES ($1, $2) RETURNING *;
      `;
      const { rows } = await pool.query(query, [name, slug]);
      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return res
          .status(400)
          .json({ success: false, message: "Category already exists" });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  updateCategory: async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const slug = name ? slugify(name, { lower: true, strict: true }) : null;

    try {
      const query = `
        UPDATE blog_categories 
        SET name = COALESCE($1, name), slug = COALESCE($2, slug)
        WHERE id = $3 RETURNING *;
      `;
      const { rows } = await pool.query(query, [name, slug, id]);

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Category not found" });
      }

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return res
          .status(400)
          .json({ success: false, message: "Category name already exists" });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  },

  deleteCategory: async (req, res) => {
    const { id } = req.params;
    try {
      const query = `DELETE FROM blog_categories WHERE id = $1 RETURNING id`;
      const { rows } = await pool.query(query, [id]);

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Category not found" });
      }

      res
        .status(200)
        .json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ==================== POST METHODS ====================
  getAllPosts: async (req, res) => {
    try {
      const query = `
        SELECT bp.*, bc.name as category_name 
        FROM blog_posts bp
        LEFT JOIN blog_categories bc ON bp.category_id = bc.id
        WHERE bp.status = 'published'
        ORDER BY bp.created_at DESC;
      `;
      const { rows: posts } = await pool.query(query);

      for (const post of posts) {
        const commentQuery = `
          SELECT user_full_name, comment_text, created_at 
          FROM blog_comments 
          WHERE post_id = $1 AND is_approved = true 
          ORDER BY created_at DESC;
        `;
        const { rows: comments } = await pool.query(commentQuery, [post.id]);
        post.comments = comments;
      }

      res.status(200).json({ success: true, data: posts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getPostBySlug: async (req, res) => {
    const { slug } = req.params;
    try {
      const blogQuery = `
        SELECT bp.*, bc.name as category_name 
        FROM blog_posts bp
        LEFT JOIN blog_categories bc ON bp.category_id = bc.id 
        WHERE bp.slug = $1 AND bp.status = 'published';
      `;
      const blogResult = await pool.query(blogQuery, [slug]);

      if (blogResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }
      const post = blogResult.rows[0];

      const productQuery = `
        SELECT id, name, f_image, slug 
        FROM products 
        WHERE status = 'active' 
        ORDER BY created_at DESC 
        LIMIT 6;
      `;
      const products = await pool.query(productQuery);

      const commentQuery = `
        SELECT user_full_name, comment_text, created_at 
        FROM blog_comments 
        WHERE post_id = $1 AND is_approved = true 
        ORDER BY created_at DESC;
      `;
      const comments = await pool.query(commentQuery, [post.id]);

      res.status(200).json({
        success: true,
        data: {
          post,
          relatedProducts: products.rows,
          comments: comments.rows,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getPostDetails: async (req, res) => {
    const { slug } = req.params;
    try {
      const blogQuery = `SELECT * FROM blog_posts WHERE slug = $1`;
      const blogResult = await pool.query(blogQuery, [slug]);

      if (blogResult.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }
      const post = blogResult.rows[0];

      const commentQuery = `
        SELECT user_full_name, comment_text, created_at 
        FROM blog_comments 
        WHERE post_id = $1 AND is_approved = true 
        ORDER BY created_at DESC;
      `;
      const comments = await pool.query(commentQuery, [post.id]);

      res.status(200).json({
        success: true,
        data: {
          ...post,
          comments: comments.rows,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  addComment: async (req, res) => {
    const { post_id, user_full_name, user_phone, user_email, comment_text } =
      req.body;
    try {
      const query = `
        INSERT INTO blog_comments (post_id, user_full_name, user_phone, user_email, comment_text)
        VALUES ($1, $2, $3, $4, $5) RETURNING id;
      `;
      await pool.query(query, [
        post_id,
        user_full_name,
        user_phone,
        user_email,
        comment_text,
      ]);
      res.status(201).json({
        success: true,
        message: "Comment submitted. Waiting for admin approval.",
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create Post (Admin)
  createPost: async (req, res) => {
    try {
      const {
        title,
        content,
        category_id,
        featured_image,
        is_published,
        status,
      } = req.body;

      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title is required and must be a non-empty string.",
        });
      }

      const slug = slugify(title.trim(), { lower: true, strict: true });
      let imageUrl = null;

      // 1. Process uploaded file via Multer
      if (req.file) {
        const validationError = validateBlogFile(req.file, "featured_image");
        if (validationError) {
          return res
            .status(400)
            .json({ success: false, message: validationError });
        }
        imageUrl = await saveBlogFile(req.file);
      }
      // 2. Process base64 string fallback
      else if (
        featured_image &&
        typeof featured_image === "string" &&
        featured_image.startsWith("data:image")
      ) {
        const uploadDir = path.join("uploads", "blog");
        await fs.mkdir(uploadDir, { recursive: true });

        const base64Data = featured_image.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");
        const extMatch = featured_image.match(/^data:image\/(\w+);base64,/);
        const ext = extMatch ? extMatch[1] : "jpg";

        const fileName = `${Date.now()}_${slug}.${ext}`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);
        const baseUrl = process.env.APP_URL
          ? process.env.APP_URL.replace(/\/$/, "")
          : "";
        imageUrl = `${baseUrl}/uploads/blog/${fileName}`;
      } else if (typeof featured_image === "string") {
        imageUrl = featured_image;
      }

      // Map is_published boolean/string to status column
      const postStatus =
        status ||
        (is_published === true || is_published === "true"
          ? "published"
          : "draft");

      const query = `
        INSERT INTO blog_posts (title, slug, content, category_id, featured_image,  status)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
      `;
      const { rows } = await pool.query(query, [
        title,
        slug,
        content,
        category_id || null,
        imageUrl,
        postStatus,
      ]);

      res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error("createPost error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update Post (Admin)
  updatePost: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        content,
        category_id,
        featured_image,

        is_published,
        status,
      } = req.body;

      const slug =
        title && typeof title === "string" && title.trim()
          ? slugify(title.trim(), { lower: true, strict: true })
          : null;

      let imageUrl = null;

      if (req.file) {
        const validationError = validateBlogFile(req.file, "featured_image");
        if (validationError) {
          return res
            .status(400)
            .json({ success: false, message: validationError });
        }
        imageUrl = await saveBlogFile(req.file);
      } else if (
        featured_image &&
        typeof featured_image === "string" &&
        featured_image.startsWith("data:image")
      ) {
        const uploadDir = path.join("uploads", "blog");
        await fs.mkdir(uploadDir, { recursive: true });

        const base64Data = featured_image.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");
        const extMatch = featured_image.match(/^data:image\/(\w+);base64,/);
        const ext = extMatch ? extMatch[1] : "jpg";

        const fileName = `${Date.now()}_${slug || "update"}.${ext}`;
        const filePath = path.join(uploadDir, fileName);

        await fs.writeFile(filePath, buffer);
        const baseUrl = process.env.APP_URL
          ? process.env.APP_URL.replace(/\/$/, "")
          : "";
        imageUrl = `${baseUrl}/uploads/blog/${fileName}`;
      } else if (typeof featured_image === "string") {
        imageUrl = featured_image;
      }

      const postStatus =
        status ||
        (is_published !== undefined
          ? is_published === true || is_published === "true"
            ? "published"
            : "draft"
          : null);

      const query = `
        UPDATE blog_posts 
        SET title = COALESCE($1, title), 
            slug = COALESCE($2, slug), 
            content = COALESCE($3, content), 
            category_id = COALESCE($4, category_id), 
            featured_image = COALESCE($5, featured_image),             
            status = COALESCE($7, status), 
            updated_at = NOW()
        WHERE id = $8 RETURNING *;
      `;
      const { rows } = await pool.query(query, [
        title || null,
        slug,
        content || null,
        category_id || null,
        imageUrl,

        postStatus,
        id,
      ]);

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Post not found" });
      }

      res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
      console.error("updatePost error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  deletePost: async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM blog_posts WHERE id = $1", [id]);
      res.status(200).json({
        success: true,
        message: "Post and associated comments deleted.",
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  approveComment: async (req, res) => {
    const { commentId } = req.params;
    try {
      await pool.query(
        "UPDATE blog_comments SET is_approved = true WHERE id = $1",
        [commentId],
      );
      res
        .status(200)
        .json({ success: true, message: "Comment is now public." });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = blogController;
