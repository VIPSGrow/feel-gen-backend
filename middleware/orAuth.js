const jwt = require("jsonwebtoken");
const db = require("../config/db");

const orAuth = async (req, res, next) => {
  try {
    // 1. Extract tokens from both possible locations
    const bearerToken = req.header("Authorization")?.replace("Bearer ", "");
    const xAuthToken = req.header("x-auth-token");
    const token = bearerToken || xAuthToken;

    if (!token) {
      return res
        .status(401)
        .json({ status: false, error: "No token, authorization denied" });
    }

    // 2. Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // console.log("Decoded JWT:", decoded);
    // 3. Determine User Type and Table
    // We check decoded.type (from ecomAuth) or decoded.role (from your second middleware)
    let userQuery = "";


    if (bearerToken && (decoded.role && decoded.role !== "Super Admin")) {
      console.log("Decoded JWT for bearer token:", decoded);
      userQuery =
        "SELECT id, name, email, phone, status FROM ecom_user WHERE id = $1";

      const result = await db.query(userQuery, [decoded.id]);

      if (result.rows.length === 0) {
        return res.status(401).json({ status: false, error: "User not found" });
      }

      const userObj = result.rows[0];
      // 4. Status Check (Account enabled?)
      if (userObj.status === false || userObj.status === "inactive") {
        return res
          .status(401)
          .json({ status: false, error: "Account disabled" });
      }

      req.user = { ...userObj, type: "ECOM_USER", role: "ECOM_USER" }; // Attach user info and type to request
    } else {


      console.log("Decoded JWT for non-bearer token:", decoded);
      if (decoded.kyc_status !== true) {
        return res
          .status(202)
          .json({ status: false, message: "KYC not completed" });
      }

      req.user = decoded;
    }

    next();
  } catch (err) {
    console.error("OrAuth Error:", err.message);
    res.status(401).json({ status: false, error: "Token invalid" });
  }
};

module.exports = orAuth;
