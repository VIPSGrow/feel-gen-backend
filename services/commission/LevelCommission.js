const MilestonDistribution = require("./MileStoneCommission");

const LevelCommissionDistribution = async (client, userId, body) => {
  try {
    const { amount, razorpay_order_id, order_id } = body;

    // ==========================
    // VERBOSE LOGS (test only)
    // ==========================
    console.log("[LevelCommissionDistribution] START", {
      userId,
      amount,
      order_id,
      razorpay_order_id,
    });

    // user data & upline traversal
    const userDataRes = await client.query(
      "SELECT binary_path, nlevel(binary_path) as depth FROM users WHERE id = $1",
      [userId],
    );
    if (userDataRes.rows.length === 0)
      return { status: false, message: "User not found" };

    const currentUserPath = userDataRes.rows[0].binary_path;
    const newUserDepth = userDataRes.rows[0].depth;

    console.log("[LevelCommissionDistribution] userData", {
      userId,
      currentUserPath,
      newUserDepth,
    });

    const uplineQuery = await client.query(
      `SELECT id, binary_path, nlevel(binary_path) as level
       FROM users
       WHERE binary_path @> $1 AND id != $2
       ORDER BY level DESC`,
      [currentUserPath, userId],
    );
    const uplines = uplineQuery.rows;

    console.log("[LevelCommissionDistribution] uplines", {
      count: uplines.length,
      uplines: uplines.map((u) => ({
        id: u.id,
        level: u.level,
        binary_path: u.binary_path,
      })),
    });

    // main matching loop
    for (let upline of uplines) {
      const isLeft = currentUserPath.startsWith(`${upline.binary_path}.1`);
      const legColumn = isLeft ? "left_count" : "right_count";
      const oppositeLegPath = isLeft
        ? `${upline.binary_path}.2`
        : `${upline.binary_path}.1`;

      console.log("\n[LevelCommissionDistribution] Upline iteration", {
        uplineId: upline.id,
        uplineLevel: upline.level,
        isLeft,
        legColumn,
        oppositeLegPath,
      });

      // SECTION A: Safe Read with Row-Level Locking
      // We lock the wallet row immediately to prevent dirty reads or race conditions
      // from parallel processing streams during calculation steps.
      const walletRead = await client.query(
        `SELECT left_count, right_count, paid_pairs
         FROM wallets
         WHERE user_id = $1 FOR UPDATE`,
        [upline.id],
      );

      if (walletRead.rowCount === 0) {
        throw new Error(`Wallet not found for user ${upline.id}`);
      }

      let { left_count, right_count, paid_pairs } = walletRead.rows[0];

      // Simulated virtual addition: What would the counters look like if we added this order?
      if (isLeft) {
        left_count += 1;
      } else {
        right_count += 1;
      }

      console.log("[LevelCommissionDistribution] walletCounterUpdate", {
        uplineId: upline.id,
        left_count,
        right_count,
        paid_pairs,
        currentMatches: Math.min(left_count, right_count),
        newPairs: Math.min(left_count, right_count) - paid_pairs,
      });

      // SECTION B: Pair Verification (Calculated purely in-memory)
      const currentMatches = Math.min(left_count, right_count);
      const newPairs = currentMatches - paid_pairs;

      if (newPairs > 0) {
        // SECTION C: Find Pending Order in Opposite Leg
        const pendingMatch = await client.query(
          `SELECT
              o.id,
              o.order_id,
              o.sub_total,
              o.total_amount,
              o.distributor_id
           FROM orders o
           JOIN users u ON u.id = o.distributor_id
           WHERE u.binary_path <@ $1
           AND o.order_id <> $3
           AND NOT EXISTS (
              SELECT 1
              FROM pair_matches pm
              WHERE pm.upline_id = $2
              AND (pm.left_order_id = o.id OR pm.right_order_id = o.id)
           )
           ORDER BY o.created_at
           LIMIT 1
           FOR UPDATE SKIP LOCKED;`,
          [oppositeLegPath, upline.id, order_id],
        );

        console.log("[LevelCommissionDistribution] pendingMatch", {
          uplineId: upline.id,
          oppositeLegPath,
          pendingRows: pendingMatch.rows,
        });

        if (pendingMatch.rows.length > 0) {
          const currentOrderCheck = await client.query(
            `SELECT 1
             FROM pair_matches
             WHERE upline_id = $1
             AND (
                left_order_id = (SELECT id FROM orders WHERE order_id = $2)
                OR 
                right_order_id = (SELECT id FROM orders WHERE order_id = $2)
             )
             LIMIT 1`,
            [upline.id, order_id],
          );

          if (currentOrderCheck.rowCount > 0) {
            console.log("Current order already used.");
            continue;
          }

          const matchedOrder = pendingMatch.rows[0];

          // SECTION D: Amount Merging
          const totalMatchingAmount =
            parseFloat(amount) + parseFloat(matchedOrder.sub_total);

          // SECTION E: Relative Level Calculation
          const relativeLevel = newUserDepth - upline.level;
          const commConfig = await client.query(
            `SELECT gc.commission_percent AS commission_percentage
             FROM mlm_generation_commissions gc
             WHERE gc.plan_settings_id = (
               SELECT id FROM mlm_plan_settings
               WHERE is_active = TRUE ORDER BY effective_from DESC LIMIT 1
             ) AND gc.is_active = TRUE AND gc.level_no = $1
             LIMIT 1`,
            [relativeLevel],
          );

          const rate = commConfig.rows[0]?.commission_percentage || 0;
          const commissionAmount =
            newPairs * (totalMatchingAmount * (rate / 100));

          console.log("[LevelCommissionDistribution] commissionCalc", {
            uplineId: upline.id,
            uplineLevel: upline.level,
            newUserDepth,
            relativeLevel,
            totalMatchingAmount,
            newPairs,
            rate,
            commissionAmount,
          });

          if (commissionAmount > 0) {
            console.log("[LevelCommissionDistribution] COMMIT commission", {
              uplineId: upline.id,
              matchedOrderId: matchedOrder.id,
              matchedOrderOrderId: matchedOrder.order_id,
              sourceOrderId: order_id,
              commissionAmount,
              currentMatches,
              relativeLevel,
              rate,
            });

            // SECTION F: Business Level Upgrade
            await client.query(
              `UPDATE users SET business_level = business_level + 1 WHERE id = $1`,
              [upline.id],
            );

            // SECTION G: Consolidated Wallet Atomic Write
            // Updates both counts (including the new leg increment), paid pairs, and total balance safely.
            const walletUpdateFinal = await client.query(
              `UPDATE wallets 
               SET total_amount = total_amount + $1, 
                   paid_pairs = $2,
                   ${legColumn} = ${legColumn} + 1
               WHERE user_id = $3 
               RETURNING paid_pairs`,
              [commissionAmount, currentMatches, upline.id],
            );

            const updatedPaidPairs = walletUpdateFinal.rows[0].paid_pairs;

            console.log("[LevelCommissionDistribution] walletUpdateFinal", {
              uplineId: upline.id,
              updatedPaidPairs,
              currentMatches,
              commissionAmount,
            });

            const txnRemarks = `Pair Match: Order ${matchedOrder.order_id} & ${order_id} | Rate - ${rate}%`;

            console.log("[LevelCommissionDistribution] insert transaction", {
              uplineId: upline.id,
              commissionAmount,
              source_user_id: userId,
              txnRemarks,
            });

            await client.query(
              `INSERT INTO transactions (user_id, amount, type, category, source_user_id, status, remarks)
               VALUES ($1, $2, 'credit', 'commission', $3, 'completed', $4)`,
              [upline.id, commissionAmount, userId, txnRemarks],
            );

            const currentOrder = await client.query(
              `SELECT id, distributor_id FROM orders WHERE order_id = $1 LIMIT 1`,
              [order_id],
            );

            if (currentOrder.rowCount === 0) {
              throw new Error(`Current order not found : ${order_id}`);
            }

            const currentOrderData = currentOrder.rows[0];

            await client.query(
              `INSERT INTO pair_matches
                (upline_id, left_order_id, right_order_id, left_user_id, right_user_id, total_matching_amount, commission_amount, pair_level)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                upline.id,
                isLeft ? currentOrderData.id : matchedOrder.id,
                isLeft ? matchedOrder.id : currentOrderData.id,
                isLeft
                  ? currentOrderData.distributor_id
                  : matchedOrder.distributor_id,
                isLeft
                  ? matchedOrder.distributor_id
                  : currentOrderData.distributor_id,
                totalMatchingAmount,
                commissionAmount,
                relativeLevel,
              ],
            );

            // SECTION H: Side-Effects Processing (Milestones, Transactions, Mapping Records)
            await MilestonDistribution(
              client,
              upline.id,
              updatedPaidPairs,
              newPairs,
              totalMatchingAmount,
            );
          }
        }
      } else {
        // SECTION I: Non-Paying Order Leg Increment
        // Triggers exclusively when no pairing condition is fulfilled.
        const walletIncrementOnly = await client.query(
          `UPDATE wallets SET ${legColumn} = ${legColumn} + 1
           WHERE user_id = $1 RETURNING left_count, right_count, paid_pairs`,
          [upline.id],
        );

        if (walletIncrementOnly.rowCount === 0) {
          throw new Error(`Wallet not found for user ${upline.id}`);
        }

        console.log(
          "[LevelCommissionDistribution] no newPairs -> mark pending",
          {
            uplineId: upline.id,
            order_id,
            legColumn,
          },
        );
      }
    }
  } catch (err) {
    console.log("[LevelCommissionDistribution] ERROR", err);
    throw err;
  }
};

module.exports = LevelCommissionDistribution;
