# TODO: Integrate search in exports.getPlacedOrder

## Steps

- [x] Read and understand `controllers/distributor_OrderController.js` and `routes/orderRoutes.js`
- [x] Confirm plan with user
- [x] Add search (order_id / user_name) logic to `getPlacedOrder`
- [x] Update count query to include JOINs (ecom_user, users) so count works with user_name search
- [ ] Test endpoint
