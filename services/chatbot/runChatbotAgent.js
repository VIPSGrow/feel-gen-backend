const { classifyIntent } = require("./intentClassifier");
const { ecomTools } = require("./tools/ecomTools");
const { mlmTools } = require("./tools/mlmTools");
const { sharedTools } = require("./tools/sharedTools");
const { formatAssistantResponse } = require("./responseFormatter");

const ROLE_ALLOWED_TOOLS = {
  ECOM_USER: new Set([
    "getMyTickets",
    "trackOrder",
    "getOrderStatus",
    "getMyAddresses",
    "getMyWishlist",
  ]),
  DISTRIBUTOR: new Set([
    "getWalletBalance",
    "getMyTickets",
    "getDownlineCount",
    "getLatestCommissions",
  ]),
};

function normalizeRole(role) {
  if (!role) return null;
  if (role === "ECOM_USER") return "ECOM_USER";
  if (role === "DISTRIBUTOR") return "DISTRIBUTOR";
  return role;
}

async function runChatbotAgent({ context, userMessage }) {
  const role = normalizeRole(context.role);
  if (!role) throw new Error("Invalid role in context");

  const intent = classifyIntent({ context, userMessage });
  if (!intent?.toolName) throw new Error("Unable to classify intent");

  const allowed = ROLE_ALLOWED_TOOLS[role];
  if (!allowed || !allowed.has(intent.toolName)) {
    return {
      reply: formatAssistantResponse({
        context,
        intent,
        data: null,
        forbidden: true,
      }),
      intent,
    };
  }

  const toolResult = await (() => {
    // Check shared tools first
    if (Object.keys(sharedTools).includes(intent.toolName)) {
      return sharedTools[intent.toolName]({
        ...intent.params,
        authContext: context,
      });
    }
    if (role === "ECOM_USER") {
      return ecomTools[intent.toolName]({
        ...intent.params,
        authContext: context,
      });
    }
    if (role === "DISTRIBUTOR") {
      return mlmTools[intent.toolName]({
        ...intent.params,
        authContext: context,
      });
    }
    throw new Error("Unsupported role");
  })();

  return {
    reply: formatAssistantResponse({
      context,
      intent,
      data: toolResult,
      forbidden: false,
    }),
    intent,
    data: toolResult,
  };
}

module.exports = { runChatbotAgent };
