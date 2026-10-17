const fs = require("fs/promises");
const path = require("path");
const QRCode = require("qrcode");

// Image rendering
// https://www.npmjs.com/package/canvas
const { createCanvas, loadImage } = require("canvas");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function getTemplates() {
  const frontTemplate = path.join(
    __dirname,
    "..",
    "id_card",
    "id_card_front.jpg",
  );
  const backTemplate = path.join(
    __dirname,
    "..",
    "id_card",
    "id_card_back.jpg",
  );
  return { frontTemplate, backTemplate };
}

async function copyTemplateToUserCard(userId) {
  const { frontTemplate, backTemplate } = getTemplates();
  const userDir = path.join(
    process.cwd(),
    "uploads",
    "id-cards",
    String(userId),
  );

  const frontDest = path.join(userDir, "front.jpg");
  const backDest = path.join(userDir, "back.jpg");

  // Copy templates each time so it always has the latest QR if/when we overlay later.
  await fs.copyFile(frontTemplate, frontDest);
  await fs.copyFile(backTemplate, backDest);

  return { frontDest, backDest, userDir };
}

async function generateIdCardQr({ userId, businessLevel }) {
  const appUrl = process.env.WEB_URL || "http://localhost:5000";

  // QR points to a verify endpoint that should read latest level from DB.
  // Backend must expose: GET /id/verify?userId=<id>
  const qrPayload = `${appUrl.replace(
    /\/$/,
    "",
  )}/id/verify?userId=${encodeURIComponent(userId)}&level=${encodeURIComponent(
    businessLevel ?? "",
  )}`;

  const userDir = path.join(
    process.cwd(),
    "uploads",
    "id-cards",
    String(userId),
  );
  const qrPath = path.join(userDir, "qr.png");

  await QRCode.toFile(qrPath, qrPayload, {
    color: { dark: "#000000", light: "#FFFFFF" },
    width: 500,
    margin: 1,
  });

  return { qrPath, qrPayload };
}

/**
 * Generate/refresh ID card files for a user after level change.
 *
 * @param {number} userId
 * @param {number} businessLevel
 */
async function generateAndSaveIdCard({
  userId,
  businessLevel,
  fullName,
  referralCode,
  phone,
  joinDate,
  profileImagePath,
}) {
  const userDir = path.join(
    process.cwd(),
    "uploads",
    "id-cards",
    String(userId),
  );

  const frontCard = path.join(userDir, "front.jpg");
  const backCard = path.join(userDir, "back.jpg");
  const qrCodePath = path.join(userDir, "qr.png");

  // If already generated, do NOT regenerate again (user asked for only first-time add issue date)
  try {
    await fs.access(frontCard);

    return {
      frontUrl: `${
        process.env.APP_URL || ""
      }/uploads/id-cards/${userId}/front.jpg`,
      backUrl: `${
        process.env.APP_URL || ""
      }/uploads/id-cards/${userId}/back.jpg`,
      qrUrl: `${process.env.APP_URL || ""}/uploads/id-cards/${userId}/qr.png`,
      frontPath: frontCard,
      backPath: backCard,
      qrPath: qrCodePath,
      alreadyExisted: true,
    };
  } catch (err) {
    // not exists => continue generating
  }

  await ensureDir(userDir);

  // Create deterministic front/back images from templates.
  // (Text/QR overlay upgrade requires canvas/sharp.)
  const { frontDest, backDest } = await copyTemplateToUserCard(userId);
  const { qrPath } = await generateIdCardQr({ userId, businessLevel });

  if (fullName || referralCode) {
    const frontImg = await loadImage(frontDest);
    const canvas = createCanvas(frontImg.width, frontImg.height);
    const ctx = canvas.getContext("2d");
    const qrImg = await loadImage(qrPath); // Load the generated QR code

    // draw template
    ctx.drawImage(frontImg, 0, 0);
    ctx.drawImage(qrImg, 50, 850, 155, 155);

    ctx.fillStyle = "#000000";
    // NOTE: set a reasonably bold font. Adjust size if template differs.
    ctx.font = "bold 28px Arial";
    ctx.textBaseline = "top";
    ctx.textAlign = "center";

    // Name: PRIYA VATS (top text)
    // Approx placement based on demo: (x ~ 70, y ~ 170)
    if (fullName) {
      ctx.font = "bold 48px Arial";
      ctx.fillText(String(fullName).toUpperCase(), 320, 530);
    }

    if (phone) {
      ctx.font = "bold 25px Arial";
      ctx.fillText("M." + String(phone).toUpperCase(), 320, 640);
    }

    // Referral code: IR NO: FS26040001 (below name)
    // Approx: (x ~ 70, y ~ 260)
    if (businessLevel) {
      ctx.fillStyle = "#FFFFFF"; // White text for the green ribbon
      ctx.font = "bold 33px Arial";
      ctx.fillText(String(businessLevel).toUpperCase(), 320, 690); // Placed inside the green ribbon
    }

    // 3. Referral Code (e.g., IR NO: FS26040001)
    if (referralCode) {
      ctx.fillStyle = "#1A1A1B"; // Reset to dark color
      ctx.font = "bold 32px Arial";
      ctx.fillText(`IR NO: ${String(referralCode)}`, 320, 760); // Placed below the ribbon
    }

    // Profile image (from KYC 'profile' document)
    // Profile image (from KYC 'profile' document)
    if (profileImagePath) {
      try {
        const profileImg = await loadImage(profileImagePath);

        // Define circle center and radius based on your template
        const centerX = 320; // Horizontal center of the template (approx)
        const centerY = 365; // Vertical center of the white circle area
        const radius = 150; // Radius of the circular frame

        ctx.save(); // Save current state

        // 1. Create a circular clipping path
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        // 2. Draw the image (Centered and Scaled)
        // We calculate dimensions to maintain aspect ratio (Cover effect)
        const aspect = profileImg.width / profileImg.height;
        let drawWidth, drawHeight;

        if (aspect > 1) {
          drawHeight = radius * 2;
          drawWidth = drawHeight * aspect;
        } else {
          drawWidth = radius * 2;
          drawHeight = drawWidth / aspect;
        }

        // Draw image centered on the circle
        ctx.drawImage(
          profileImg,
          centerX - drawWidth / 2,
          centerY - drawHeight / 2,
          drawWidth,
          drawHeight,
        );

        ctx.restore(); // Restore state to remove clipping for subsequent drawing
      } catch (e) {
        console.error("Error loading profile image overlay:", e);
      }
    }

    // Issue date + Join date + 1 year (first-time generation only)
    // Format: d/M/YYYY - d/M/YYYY
    if (joinDate) {
      const jd = new Date(joinDate);
      if (!Number.isNaN(jd.getTime())) {
        const start = jd;
        const end = new Date(jd);
        // end = start + 1 year - 1 day
        end.setFullYear(end.getFullYear() + 1);
        end.setDate(end.getDate() - 1);

        const fmt = (d) => {
          const day = d.getDate();
          const month = d.getMonth() + 1;
          const year = d.getFullYear();
          return `${day}/${month}/${year}`;
        };

        const dateRange = `${fmt(start)} - ${fmt(end)}`;

        // Placement: adjust to fit the template.
        // Chosen below ribbon area; if it overlaps your template, tweak Y.
        ctx.fillStyle = "#1A1A1B";
        ctx.font = "bold 26px Arial";
        ctx.fillText(dateRange, 430, 805);
      }
    }

    // ACTIVE level text is already embedded in template only if you use the demo.
    // We only regenerate QR + re-render the same fields. If your real front.jpg also needs level,
    // add it here similarly.

    const out = canvas.toBuffer("image/jpeg", { quality: 0.95 });
    await fs.writeFile(frontDest, out);
  }

  return {
    frontUrl: `${
      process.env.APP_URL || ""
    }/uploads/id-cards/${userId}/front.jpg`,
    backUrl: `${process.env.APP_URL || ""}/uploads/id-cards/${userId}/back.jpg`,
    qrUrl: `${process.env.APP_URL || ""}/uploads/id-cards/${userId}/qr.png`,
    frontPath: frontDest,
    backPath: backDest,
    qrPath,
  };
}

module.exports = {
  generateAndSaveIdCard,
};
