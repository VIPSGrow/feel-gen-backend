-- coupon_usages.user_id also stores ecom_user ids, which do not exist in users
ALTER TABLE public.coupon_usages DROP CONSTRAINT IF EXISTS coupon_usages_user_id_fkey;
