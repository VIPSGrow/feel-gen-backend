DO $$
BEGIN
    IF to_regclass('public.pair_matches') IS NOT NULL THEN
        EXECUTE '
            CREATE UNIQUE INDEX IF NOT EXISTS uq_pair_match
            ON public.pair_matches (upline_id, left_order_id, right_order_id)
        ';
    END IF;
END $$;