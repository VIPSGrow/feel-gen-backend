const cron = require("node-cron");
const db = require("../config/db");
const LevelCommissionDistribution = require("../services/commission/LevelCommission");
const InitiatorCommission = require("../services/commission/InitiatorCommission");

// Daily cron to release 30-day hold commissions to total_balance
async function releaseHeldCommissions() {
  console.log(" ----- Cron Job Started -----");

  // Client ko loop ke bahar declare kiya taaki finally block me access ho sake
  let client;

  try {
    client = await db.connect();

    // 1. Fetching pending transactions (Using LIKE with '%' to handle string splitting safely)
    const query = `
      SELECT id, user_id, amount, remarks 
      FROM transactions 
      WHERE status = 'pending' 
        AND remarks LIKE 'Self purchase cashback%' 
        AND created_at <= NOW() - INTERVAL '1 min';
    `;

    const TransRes = await client.query(query);

    if (TransRes.rows.length === 0) {
      console.log("No pending commissions found to release.");
      return;
    }

    const allTransaction = TransRes.rows;
    console.log(`Found ${allTransaction.length} transactions to process.`);
    let updateLevel = false;

    for (let tran of allTransaction) {
      // Safe splitting for order_id
      const remarkParts = tran.remarks.split(" | ");
      const order_id = remarkParts[1];

      if (!order_id) {
        updateLevel = false;
        console.error(
          `Skipping Transaction ID ${tran.id}: Order ID not found in remarks.`,
        );
        continue;
      }

      // Start a DB transaction for this specific order to ensure data safety
      await client.query("BEGIN");

      try {
        // 2. Fetch order details along with missing fields (payment_method, razorpay_order_id)
        const ord_query = `
          SELECT sub_total, payment_method 
          FROM orders 
          WHERE order_id = $1 
            AND order_status NOT IN ('cancelled', 'refunded', 'returned', 'return_requested')
        `;
        const ord_res = await client.query(ord_query, [order_id]);

        if (ord_res.rows.length > 0) {
          const { sub_total, payment_method } = ord_res.rows[0];
          const tranAmount = parseFloat(tran.amount);

          // 3. Update Transaction Status
          await client.query(
            `UPDATE transactions SET status = 'completed' WHERE id = $1`,
            [tran.id],
          );

          // 4. FIXED: Update Wallet Amount for the SPECIFIC user_id
          const pendingWallets = await client.query(
            `
            UPDATE wallets 
            SET 
              total_amount = total_amount + $1,
              pending_amount = GREATEST(0, pending_amount - $1),
              updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING user_id, total_amount, pending_amount
            `,
            [tranAmount, tran.user_id],
          );

          // self bima booking 1%
          const bimaBookingAmount = parseFloat(sub_total) * 0.01;

          await client.query(
            `INSERT INTO transactions (user_id, amount, type, category, source_user_id, status, remarks)
               VALUES ($1, $2, 'credit', 'other', $3, 'completed', $4)`,
            [
              tran.user_id,
              bimaBookingAmount,
              tran.user_id,
              "BIMA Booking Commission",
            ],
          );

          // update initiator_user_id comission
          await InitiatorCommission(client, tran.user_id, {
            amount: sub_total,
          });

          // 5. Distribute Level Commission (Passing fetched order details)
          await LevelCommissionDistribution(client, tran.user_id, {
            amount: sub_total,
            paymentMethod: payment_method || "N/A",
            razorpay_order_id: "N/A",
            order_id: order_id,
          });

          // Commit changes for this successful loop iteration
          await client.query("COMMIT");

          console.log(
            `Successfully released commission for User ID: ${tran.user_id}, Txn ID: ${tran.id}`,
          );
          updateLevel = true;
        } else {
          updateLevel = false;
          // If order is cancelled/refunded, you might want to fail/cancel this transaction
          console.log(
            `Order ${order_id} was cancelled/refunded. Skipping commission release.`,
          );
          await client.query("ROLLBACK");
        }
      } catch (loopError) {
        updateLevel = false;
        // Agar kisi ek user ke process me error aaye, toh sirf uska ROLLBACK hoga, baaki chalte rahenge
        await client.query("ROLLBACK");
        console.error(`Error processing Transaction ID ${tran.id}:`, loopError);
      }
    }

    // update business level
    // if (updateLevel) {
    //   console.log("Updating business levels for all users...");
    //   // Assuming you have a function to update business levels for all users
    //   const query = `UPDATE users SET business_level = business_level + 1 WHERE id = $1;`;
    //   await client.query(query, []);
    //   console.log("Business levels updated successfully.");
    // }
  } catch (error) {
    console.error("Pending commission cron critical error: ", error);
  } finally {
    if (client) {
      client.release(); // 🔥 CRITICAL: Connection wapas pool me bhej diya
      console.log(" ----- DB Client Released -----");
    }
    console.log(" ----- Cron Job Finished -----");
  }
}

// Run daily at midnight
// cron.schedule("0 0 * * *", releaseHeldCommissions);
cron.schedule("* * * * *", releaseHeldCommissions);

console.log(
  "\n\n ======  Hold release cron scheduled daily at midnight  ======= ",
);

// const commResult = await SelfCommission(client, userId, {
//   amount: subTotal,
//   paymentMethod: payment_method,
//   razorpay_order_id,
//   order_id: orderId,
// });
