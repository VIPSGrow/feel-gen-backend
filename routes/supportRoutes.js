const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/isAdmin");
const isSuperAdmin = require("../middleware/isSuperAdmin");
const ecomAuth = require("../middleware/ecomAuth");
const orAuth = require("../middleware/orAuth");
const {
  uploadTicketAttachment,
} = require("../middleware/ticketAttachmentUpload");

// Public: Raise ticket (no auth needed)
// Expects multipart/form-data field name: attachment (optional)
router.post(
  "/raise-ticket",
  uploadTicketAttachment,
  ticketController.raiseTicket,
);

// Auth required user routes
router.get("/my-tickets", ecomAuth, ticketController.getUserTickets);
router.get("/:caseId",  ticketController.getTicketDetails);
router.post(
  "/:caseId/reply",
  orAuth,
  uploadTicketAttachment,
  ticketController.replyToTicket,
);

// distributor routes
router.get("/dis/my-tickets", auth, ticketController.getDistributorTickets);

// Admin routes
router.get(
  "/admin/all",
  auth,
  isSuperAdmin,
  ticketController.getAllTicketsAdmin,
);
router.put(
  "/:id/status",
  auth,
  isSuperAdmin,
  ticketController.updateTicketStatus,
);

module.exports = router;
