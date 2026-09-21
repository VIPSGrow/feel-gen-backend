--
-- PostgreSQL database dump
--

\restrict j2PTBSaQmaRFGQt8oV895agDp6cGv9ZIY3XR2KHmBcc4dgLYPLoKeb6xRIw80DC

-- Dumped from database version 15.17 (Debian 15.17-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

-- Started on 2026-05-24 19:13:25

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 16389)
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- TOC entry 4292 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- TOC entry 3 (class 3079 OID 16574)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 4293 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 1030 (class 1247 OID 16586)
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: vishant
--

CREATE TYPE public.ticket_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);


ALTER TYPE public.ticket_status OWNER TO vishant;

--
-- TOC entry 406 (class 1255 OID 16595)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: vishant
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO vishant;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 216 (class 1259 OID 16596)
-- Name: app_settings; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.app_settings (
    id integer NOT NULL,
    setting_key character varying(50) NOT NULL,
    setting_value jsonb NOT NULL,
    category character varying(30),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.app_settings OWNER TO vishant;

--
-- TOC entry 217 (class 1259 OID 16602)
-- Name: app_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.app_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_settings_id_seq OWNER TO vishant;

--
-- TOC entry 4294 (class 0 OID 0)
-- Dependencies: 217
-- Name: app_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;


--
-- TOC entry 218 (class 1259 OID 16603)
-- Name: attr_values; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.attr_values (
    id integer NOT NULL,
    attr_id integer,
    value character varying(50) NOT NULL
);


ALTER TABLE public.attr_values OWNER TO vishant;

--
-- TOC entry 219 (class 1259 OID 16606)
-- Name: attr_values_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.attr_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attr_values_id_seq OWNER TO vishant;

--
-- TOC entry 4295 (class 0 OID 0)
-- Dependencies: 219
-- Name: attr_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.attr_values_id_seq OWNED BY public.attr_values.id;


--
-- TOC entry 220 (class 1259 OID 16607)
-- Name: attributes; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.attributes (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.attributes OWNER TO vishant;

--
-- TOC entry 221 (class 1259 OID 16610)
-- Name: attributes_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.attributes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attributes_id_seq OWNER TO vishant;

--
-- TOC entry 4296 (class 0 OID 0)
-- Dependencies: 221
-- Name: attributes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.attributes_id_seq OWNED BY public.attributes.id;


--
-- TOC entry 222 (class 1259 OID 16611)
-- Name: banners; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.banners (
    id integer NOT NULL,
    title character varying(255),
    subtitle text,
    image_url text NOT NULL,
    mobile_image_url text,
    link_type character varying(20) DEFAULT 'external'::character varying,
    link_value text,
    display_order integer DEFAULT 0,
    "position" character varying(50) DEFAULT 'home_main'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.banners OWNER TO vishant;

--
-- TOC entry 223 (class 1259 OID 16622)
-- Name: banners_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.banners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.banners_id_seq OWNER TO vishant;

--
-- TOC entry 4297 (class 0 OID 0)
-- Dependencies: 223
-- Name: banners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.banners_id_seq OWNED BY public.banners.id;


--
-- TOC entry 224 (class 1259 OID 16623)
-- Name: blog_categories; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.blog_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL
);


ALTER TABLE public.blog_categories OWNER TO vishant;

--
-- TOC entry 225 (class 1259 OID 16626)
-- Name: blog_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.blog_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blog_categories_id_seq OWNER TO vishant;

--
-- TOC entry 4298 (class 0 OID 0)
-- Dependencies: 225
-- Name: blog_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.blog_categories_id_seq OWNED BY public.blog_categories.id;


--
-- TOC entry 226 (class 1259 OID 16627)
-- Name: blog_comments; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.blog_comments (
    id integer NOT NULL,
    post_id uuid,
    user_full_name character varying(100) NOT NULL,
    user_phone character varying(100),
    user_email character varying(100),
    comment_text text NOT NULL,
    is_approved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.blog_comments OWNER TO vishant;

--
-- TOC entry 227 (class 1259 OID 16634)
-- Name: blog_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.blog_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blog_comments_id_seq OWNER TO vishant;

--
-- TOC entry 4299 (class 0 OID 0)
-- Dependencies: 227
-- Name: blog_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.blog_comments_id_seq OWNED BY public.blog_comments.id;


--
-- TOC entry 228 (class 1259 OID 16635)
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id integer,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    content text NOT NULL,
    featured_image character varying(255),
    status character varying(20) DEFAULT 'published'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.blog_posts OWNER TO vishant;

--
-- TOC entry 229 (class 1259 OID 16644)
-- Name: categories; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    parent_id integer,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.categories OWNER TO vishant;

--
-- TOC entry 230 (class 1259 OID 16649)
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO vishant;

--
-- TOC entry 4300 (class 0 OID 0)
-- Dependencies: 230
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- TOC entry 231 (class 1259 OID 16650)
-- Name: cities; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.cities (
    id integer NOT NULL,
    state_id integer NOT NULL,
    name character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cities_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


ALTER TABLE public.cities OWNER TO vishant;

--
-- TOC entry 4301 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE cities; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON TABLE public.cities IS 'Cities grouped by state for address dropdowns';


--
-- TOC entry 232 (class 1259 OID 16656)
-- Name: cities_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.cities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cities_id_seq OWNER TO vishant;

--
-- TOC entry 4302 (class 0 OID 0)
-- Dependencies: 232
-- Name: cities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.cities_id_seq OWNED BY public.cities.id;


--
-- TOC entry 233 (class 1259 OID 16657)
-- Name: company_settings; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.company_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.company_settings OWNER TO vishant;

--
-- TOC entry 234 (class 1259 OID 16663)
-- Name: company_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.company_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.company_settings_id_seq OWNER TO vishant;

--
-- TOC entry 4303 (class 0 OID 0)
-- Dependencies: 234
-- Name: company_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.company_settings_id_seq OWNED BY public.company_settings.id;


--
-- TOC entry 235 (class 1259 OID 16664)
-- Name: coupon_usages; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.coupon_usages (
    id integer NOT NULL,
    coupon_id integer NOT NULL,
    user_id integer,
    username character varying(50),
    phone character varying(15),
    ip_address inet,
    user_agent text,
    order_id integer,
    used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.coupon_usages OWNER TO vishant;

--
-- TOC entry 4304 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE coupon_usages; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON TABLE public.coupon_usages IS 'Tracks usage per user/phone/ip to enforce one-use-per-user-per-coupon';


--
-- TOC entry 236 (class 1259 OID 16670)
-- Name: coupon_usages_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.coupon_usages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coupon_usages_id_seq OWNER TO vishant;

--
-- TOC entry 4305 (class 0 OID 0)
-- Dependencies: 236
-- Name: coupon_usages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.coupon_usages_id_seq OWNED BY public.coupon_usages.id;


--
-- TOC entry 237 (class 1259 OID 16671)
-- Name: coupons; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    discount_type character varying(20) DEFAULT 'percentage'::character varying,
    discount_amount numeric(10,2) NOT NULL,
    min_order_amount numeric(12,2) DEFAULT 0,
    max_discount_amount numeric(12,2),
    usage_limit integer DEFAULT 1,
    used_count integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone,
    applicable_products integer[],
    applicable_users integer[],
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT coupons_discount_amount_check CHECK ((discount_amount > (0)::numeric)),
    CONSTRAINT coupons_discount_type_check CHECK (((discount_type)::text = ANY (ARRAY[('fixed'::character varying)::text, ('percentage'::character varying)::text]))),
    CONSTRAINT coupons_max_discount_amount_check CHECK (((max_discount_amount IS NULL) OR (max_discount_amount > (0)::numeric))),
    CONSTRAINT coupons_min_order_amount_check CHECK ((min_order_amount >= (0)::numeric)),
    CONSTRAINT coupons_status_check CHECK (((status)::text = ANY (ARRAY['active'::text, 'inactive'::text, 'trash'::text]))),
    CONSTRAINT coupons_usage_limit_check CHECK ((usage_limit >= 1)),
    CONSTRAINT coupons_used_count_check CHECK ((used_count >= 0))
);


ALTER TABLE public.coupons OWNER TO vishant;

--
-- TOC entry 4306 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE coupons; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON TABLE public.coupons IS 'E-commerce coupons with discount logic';


--
-- TOC entry 238 (class 1259 OID 16691)
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coupons_id_seq OWNER TO vishant;

--
-- TOC entry 4307 (class 0 OID 0)
-- Dependencies: 238
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- TOC entry 239 (class 1259 OID 16692)
-- Name: daily_transaction_limits; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.daily_transaction_limits (
    id integer NOT NULL,
    user_id integer,
    limit_date date NOT NULL,
    transfers_count integer DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0.00,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.daily_transaction_limits OWNER TO vishant;

--
-- TOC entry 240 (class 1259 OID 16698)
-- Name: daily_transaction_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.daily_transaction_limits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_transaction_limits_id_seq OWNER TO vishant;

--
-- TOC entry 4308 (class 0 OID 0)
-- Dependencies: 240
-- Name: daily_transaction_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.daily_transaction_limits_id_seq OWNED BY public.daily_transaction_limits.id;


--
-- TOC entry 241 (class 1259 OID 16699)
-- Name: distributor_inventory; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.distributor_inventory (
    id integer NOT NULL,
    distributor_id integer NOT NULL,
    product_id integer NOT NULL,
    variant_id integer,
    quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.distributor_inventory OWNER TO vishant;

--
-- TOC entry 242 (class 1259 OID 16705)
-- Name: distributor_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.distributor_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.distributor_inventory_id_seq OWNER TO vishant;

--
-- TOC entry 4309 (class 0 OID 0)
-- Dependencies: 242
-- Name: distributor_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.distributor_inventory_id_seq OWNED BY public.distributor_inventory.id;


--
-- TOC entry 243 (class 1259 OID 16706)
-- Name: e_cart_items; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.e_cart_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    cart_id uuid,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    product_id integer NOT NULL,
    variation_id integer,
    distributor_id integer,
    CONSTRAINT e_cart_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.e_cart_items OWNER TO vishant;

--
-- TOC entry 244 (class 1259 OID 16713)
-- Name: e_carts; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.e_carts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    distributor_id integer
);


ALTER TABLE public.e_carts OWNER TO vishant;

--
-- TOC entry 245 (class 1259 OID 16719)
-- Name: e_payments; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.e_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid,
    payment_method character varying(50),
    transaction_id character varying(255),
    amount numeric(12,2),
    status character varying(20),
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.e_payments OWNER TO vishant;

--
-- TOC entry 246 (class 1259 OID 16725)
-- Name: e_reviews; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.e_reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    product_id integer,
    rating integer,
    review text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT e_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.e_reviews OWNER TO vishant;

--
-- TOC entry 247 (class 1259 OID 16734)
-- Name: e_user_addresses; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.e_user_addresses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    full_name character varying(150),
    phone character varying(20),
    address_line1 text NOT NULL,
    address_line2 text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    pincode character varying(10),
    landmark text,
    is_default boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    distributor_id integer
);


ALTER TABLE public.e_user_addresses OWNER TO vishant;

--
-- TOC entry 248 (class 1259 OID 16743)
-- Name: e_wishlists; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.e_wishlists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    product_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.e_wishlists OWNER TO vishant;

--
-- TOC entry 249 (class 1259 OID 16748)
-- Name: ecom_user; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.ecom_user (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(20),
    password text NOT NULL,
    profile_image text,
    distributor_code character varying(100) DEFAULT NULL::character varying,
    status boolean DEFAULT true,
    email_verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ecom_user OWNER TO vishant;

--
-- TOC entry 250 (class 1259 OID 16758)
-- Name: kyc_documents; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.kyc_documents (
    id integer NOT NULL,
    user_id integer,
    document_type character varying(50),
    doc_no character varying(50),
    file_url text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    rejection_remark text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.kyc_documents OWNER TO vishant;

--
-- TOC entry 251 (class 1259 OID 16766)
-- Name: kyc_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.kyc_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kyc_documents_id_seq OWNER TO vishant;

--
-- TOC entry 4310 (class 0 OID 0)
-- Dependencies: 251
-- Name: kyc_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.kyc_documents_id_seq OWNED BY public.kyc_documents.id;


--
-- TOC entry 252 (class 1259 OID 16767)
-- Name: kyc_requests; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.kyc_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    approved_at timestamp with time zone,
    rejection_remark text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT kyc_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('submitted'::character varying)::text, ('under_review'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text])))
);


ALTER TABLE public.kyc_requests OWNER TO vishant;

--
-- TOC entry 4311 (class 0 OID 0)
-- Dependencies: 252
-- Name: TABLE kyc_requests; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON TABLE public.kyc_requests IS 'KYC submission requests - lifecycle tracking per user';


--
-- TOC entry 4312 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN kyc_requests.status; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON COLUMN public.kyc_requests.status IS 'pending→submitted→under_review→approved/rejected';


--
-- TOC entry 253 (class 1259 OID 16776)
-- Name: kyc_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.kyc_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kyc_requests_id_seq OWNER TO vishant;

--
-- TOC entry 4313 (class 0 OID 0)
-- Dependencies: 253
-- Name: kyc_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.kyc_requests_id_seq OWNED BY public.kyc_requests.id;


--
-- TOC entry 254 (class 1259 OID 16777)
-- Name: level_cappings; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.level_cappings (
    id integer NOT NULL,
    level_id integer NOT NULL,
    week_limit character varying(50) DEFAULT 0.00,
    monthly_limit character varying(50) DEFAULT 0.00,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    day_limit character varying(50) DEFAULT 0.00
);


ALTER TABLE public.level_cappings OWNER TO vishant;

--
-- TOC entry 255 (class 1259 OID 16785)
-- Name: level_cappings_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.level_cappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.level_cappings_id_seq OWNER TO vishant;

--
-- TOC entry 4314 (class 0 OID 0)
-- Dependencies: 255
-- Name: level_cappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.level_cappings_id_seq OWNED BY public.level_cappings.id;


--
-- TOC entry 256 (class 1259 OID 16786)
-- Name: level_commissions; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.level_commissions (
    id integer NOT NULL,
    level_no integer NOT NULL,
    commission_percentage numeric(5,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    level_name character varying(100),
    team_size integer DEFAULT 0,
    ir_direct numeric(15,2) DEFAULT 0.00,
    bima numeric(15,2) DEFAULT 0.00,
    ir_commission numeric(15,2) DEFAULT 0.00
);


ALTER TABLE public.level_commissions OWNER TO vishant;

--
-- TOC entry 4315 (class 0 OID 0)
-- Dependencies: 256
-- Name: COLUMN level_commissions.ir_direct; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON COLUMN public.level_commissions.ir_direct IS 'Direct IR benefit amount or percentage';


--
-- TOC entry 257 (class 1259 OID 16794)
-- Name: level_commissions_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.level_commissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.level_commissions_id_seq OWNER TO vishant;

--
-- TOC entry 4316 (class 0 OID 0)
-- Dependencies: 257
-- Name: level_commissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.level_commissions_id_seq OWNED BY public.level_commissions.id;


--
-- TOC entry 258 (class 1259 OID 16795)
-- Name: level_milestones; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.level_milestones (
    id integer NOT NULL,
    level_id integer NOT NULL,
    milestone_name character varying(255),
    tour_details text,
    reward_cash numeric(15,2) DEFAULT 0.00,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.level_milestones OWNER TO vishant;

--
-- TOC entry 259 (class 1259 OID 16802)
-- Name: level_milestones_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.level_milestones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.level_milestones_id_seq OWNER TO vishant;

--
-- TOC entry 4317 (class 0 OID 0)
-- Dependencies: 259
-- Name: level_milestones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.level_milestones_id_seq OWNED BY public.level_milestones.id;


--
-- TOC entry 260 (class 1259 OID 16803)
-- Name: notifications; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    sender_id integer,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    image_url text,
    display_type character varying(20),
    target_role character varying(20),
    target_id integer,
    priority character varying(20) DEFAULT 'NORMAL'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO vishant;

--
-- TOC entry 261 (class 1259 OID 16810)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO vishant;

--
-- TOC entry 4318 (class 0 OID 0)
-- Dependencies: 261
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 262 (class 1259 OID 16811)
-- Name: order_items; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer,
    product_id integer,
    variant_id integer,
    product_name character varying(255),
    variant_sku character varying(100),
    variant_details jsonb,
    qty integer DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    unit_bv_points numeric(12,2) DEFAULT 0,
    total_item_price numeric(12,2) NOT NULL,
    total_item_bv integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    product_image text,
    stock_source integer DEFAULT 0
);


ALTER TABLE public.order_items OWNER TO vishant;

--
-- TOC entry 4319 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN order_items.product_image; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON COLUMN public.order_items.product_image IS 'Snapshot of product featured image URL for order display';


--
-- TOC entry 263 (class 1259 OID 16819)
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO vishant;

--
-- TOC entry 4320 (class 0 OID 0)
-- Dependencies: 263
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- TOC entry 264 (class 1259 OID 16820)
-- Name: orders; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_id character varying(50) NOT NULL,
    sub_total numeric(12,2) NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0,
    shipping_charges numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    total_bv_points integer NOT NULL,
    payment_status character varying(20) DEFAULT 'unpaid'::character varying,
    order_status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    shipping_address jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_id uuid,
    distributor_id integer,
    commission_status text,
    order_for text,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.orders OWNER TO vishant;

--
-- TOC entry 265 (class 1259 OID 16830)
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO vishant;

--
-- TOC entry 4321 (class 0 OID 0)
-- Dependencies: 265
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- TOC entry 266 (class 1259 OID 16831)
-- Name: packages; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.packages (
    id integer NOT NULL,
    name character varying(100),
    level integer,
    price numeric(10,2),
    description text,
    kyc_required boolean DEFAULT false,
    commission_status character varying(20) DEFAULT 'blocked'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    image text
);


ALTER TABLE public.packages OWNER TO vishant;

--
-- TOC entry 267 (class 1259 OID 16839)
-- Name: packages_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.packages_id_seq OWNER TO vishant;

--
-- TOC entry 4322 (class 0 OID 0)
-- Dependencies: 267
-- Name: packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.packages_id_seq OWNED BY public.packages.id;


--
-- TOC entry 268 (class 1259 OID 16841)
-- Name: pro_variants; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.pro_variants (
    id integer NOT NULL,
    product_id integer,
    sku character(100) NOT NULL,
    price numeric(12,2) DEFAULT 0.00 NOT NULL,
    bv_point real DEFAULT 0,
    stock integer DEFAULT 0,
    image_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pro_variants OWNER TO vishant;

--
-- TOC entry 269 (class 1259 OID 16850)
-- Name: pro_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.pro_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pro_variants_id_seq OWNER TO vishant;

--
-- TOC entry 4323 (class 0 OID 0)
-- Dependencies: 269
-- Name: pro_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.pro_variants_id_seq OWNED BY public.pro_variants.id;


--
-- TOC entry 270 (class 1259 OID 16851)
-- Name: products; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.products (
    id integer NOT NULL,
    cat_id integer,
    name character varying(255) NOT NULL,
    description text,
    f_image text,
    g_image text[],
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tax_id integer,
    base_price numeric(12,2) DEFAULT 0.00,
    subcategories integer[] DEFAULT '{}'::integer[],
    attributes integer[] DEFAULT '{}'::integer[],
    variants jsonb DEFAULT '[]'::jsonb,
    discounted_price numeric(12,2) DEFAULT 0.00,
    slug character varying(100),
    short_desc text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.products OWNER TO vishant;

--
-- TOC entry 271 (class 1259 OID 16863)
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO vishant;

--
-- TOC entry 4324 (class 0 OID 0)
-- Dependencies: 271
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- TOC entry 272 (class 1259 OID 16864)
-- Name: roles; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.roles OWNER TO vishant;

--
-- TOC entry 273 (class 1259 OID 16872)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO vishant;

--
-- TOC entry 4325 (class 0 OID 0)
-- Dependencies: 273
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 304 (class 1259 OID 32805)
-- Name: sample_requests; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.sample_requests (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(15) NOT NULL,
    email character varying(150),
    gender character varying(10),
    dob date,
    address text,
    state character varying(100),
    city character varying(100),
    pincode character varying(10),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sample_requests OWNER TO vishant;

--
-- TOC entry 303 (class 1259 OID 32804)
-- Name: sample_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.sample_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sample_requests_id_seq OWNER TO vishant;

--
-- TOC entry 4326 (class 0 OID 0)
-- Dependencies: 303
-- Name: sample_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.sample_requests_id_seq OWNED BY public.sample_requests.id;


--
-- TOC entry 274 (class 1259 OID 16873)
-- Name: staff; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.staff (
    id integer NOT NULL,
    user_id integer,
    role_id integer,
    department character varying(100),
    designation character varying(100),
    salary numeric(12,2),
    hire_date date,
    manager_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.staff OWNER TO vishant;

--
-- TOC entry 275 (class 1259 OID 16878)
-- Name: staff_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_id_seq OWNER TO vishant;

--
-- TOC entry 4327 (class 0 OID 0)
-- Dependencies: 275
-- Name: staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;


--
-- TOC entry 276 (class 1259 OID 16879)
-- Name: states; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.states (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT states_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


ALTER TABLE public.states OWNER TO vishant;

--
-- TOC entry 4328 (class 0 OID 0)
-- Dependencies: 276
-- Name: TABLE states; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON TABLE public.states IS 'Indian states and union territories for address management';


--
-- TOC entry 277 (class 1259 OID 16885)
-- Name: states_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.states_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.states_id_seq OWNER TO vishant;

--
-- TOC entry 4329 (class 0 OID 0)
-- Dependencies: 277
-- Name: states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.states_id_seq OWNED BY public.states.id;


--
-- TOC entry 278 (class 1259 OID 16886)
-- Name: static_content; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.static_content (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    content text NOT NULL,
    meta_title character varying(255),
    meta_description text,
    status character varying(20) DEFAULT 'published'::character varying,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.static_content OWNER TO vishant;

--
-- TOC entry 279 (class 1259 OID 16893)
-- Name: static_content_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.static_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.static_content_id_seq OWNER TO vishant;

--
-- TOC entry 4330 (class 0 OID 0)
-- Dependencies: 279
-- Name: static_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.static_content_id_seq OWNED BY public.static_content.id;


--
-- TOC entry 280 (class 1259 OID 16894)
-- Name: tax_settings; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.tax_settings (
    id integer NOT NULL,
    tax_name character varying(50) NOT NULL,
    tax_percentage numeric(5,2) NOT NULL,
    state_code character varying(5),
    country_code character varying(5) DEFAULT 'IN'::character varying,
    is_inclusive boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tax_settings OWNER TO vishant;

--
-- TOC entry 281 (class 1259 OID 16902)
-- Name: tax_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.tax_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_settings_id_seq OWNER TO vishant;

--
-- TOC entry 4331 (class 0 OID 0)
-- Dependencies: 281
-- Name: tax_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.tax_settings_id_seq OWNED BY public.tax_settings.id;


--
-- TOC entry 282 (class 1259 OID 16903)
-- Name: team_members; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.team_members (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    image character varying(500),
    bio text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.team_members OWNER TO vishant;

--
-- TOC entry 283 (class 1259 OID 16911)
-- Name: team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.team_members_id_seq OWNER TO vishant;

--
-- TOC entry 4332 (class 0 OID 0)
-- Dependencies: 283
-- Name: team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.team_members_id_seq OWNED BY public.team_members.id;


--
-- TOC entry 306 (class 1259 OID 40966)
-- Name: ticket_reads; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.ticket_reads (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    viewer_user_id text,
    viewer_user_type character varying(20) NOT NULL,
    last_read_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reply_id integer
);


ALTER TABLE public.ticket_reads OWNER TO vishant;

--
-- TOC entry 305 (class 1259 OID 40965)
-- Name: ticket_reads_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.ticket_reads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ticket_reads_id_seq OWNER TO vishant;

--
-- TOC entry 4333 (class 0 OID 0)
-- Dependencies: 305
-- Name: ticket_reads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.ticket_reads_id_seq OWNED BY public.ticket_reads.id;


--
-- TOC entry 284 (class 1259 OID 16912)
-- Name: ticket_replies; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.ticket_replies (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    replied_by text,
    replied_by_type character varying(20) NOT NULL,
    message text NOT NULL,
    attachment character varying(255),
    is_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ticket_replies_replied_by_type_check CHECK (((replied_by_type)::text = ANY (ARRAY[('USER'::character varying)::text, ('STAFF'::character varying)::text])))
);


ALTER TABLE public.ticket_replies OWNER TO vishant;

--
-- TOC entry 285 (class 1259 OID 16921)
-- Name: ticket_replies_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.ticket_replies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ticket_replies_id_seq OWNER TO vishant;

--
-- TOC entry 4334 (class 0 OID 0)
-- Dependencies: 285
-- Name: ticket_replies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.ticket_replies_id_seq OWNED BY public.ticket_replies.id;


--
-- TOC entry 286 (class 1259 OID 16922)
-- Name: tickets; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    case_id character varying(20) NOT NULL,
    distributor_id integer,
    ecom_user_id character varying(255),
    name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(20) NOT NULL,
    subject character varying(100) NOT NULL,
    message text NOT NULL,
    status public.ticket_status DEFAULT 'OPEN'::public.ticket_status,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp with time zone
);


ALTER TABLE public.tickets OWNER TO vishant;

--
-- TOC entry 287 (class 1259 OID 16930)
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO vishant;

--
-- TOC entry 4335 (class 0 OID 0)
-- Dependencies: 287
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- TOC entry 288 (class 1259 OID 16931)
-- Name: transaction_pins; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.transaction_pins (
    id integer NOT NULL,
    user_id integer,
    pin_hash character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.transaction_pins OWNER TO vishant;

--
-- TOC entry 289 (class 1259 OID 16935)
-- Name: transaction_pins_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.transaction_pins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transaction_pins_id_seq OWNER TO vishant;

--
-- TOC entry 4336 (class 0 OID 0)
-- Dependencies: 289
-- Name: transaction_pins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.transaction_pins_id_seq OWNED BY public.transaction_pins.id;


--
-- TOC entry 290 (class 1259 OID 16936)
-- Name: transactions; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer,
    amount numeric(15,2) NOT NULL,
    type character varying(10),
    category character varying(20),
    source_user_id integer,
    order_id integer,
    remarks text,
    status character varying(20) DEFAULT 'completed'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transactions_category_check CHECK (((category)::text = ANY (ARRAY['commission'::text, 'withdraw'::text, 'purchase'::text, 'ref_bonus'::text, 'other'::text, 'bonus'::text]))),
    CONSTRAINT transactions_type_check CHECK (((type)::text = ANY (ARRAY[('credit'::character varying)::text, ('debit'::character varying)::text])))
);


ALTER TABLE public.transactions OWNER TO vishant;

--
-- TOC entry 291 (class 1259 OID 16945)
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO vishant;

--
-- TOC entry 4337 (class 0 OID 0)
-- Dependencies: 291
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- TOC entry 292 (class 1259 OID 16946)
-- Name: user_device_tokens; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.user_device_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    fcm_token text NOT NULL,
    device_type character varying(20),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_device_tokens OWNER TO vishant;

--
-- TOC entry 293 (class 1259 OID 16952)
-- Name: user_device_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.user_device_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_device_tokens_id_seq OWNER TO vishant;

--
-- TOC entry 4338 (class 0 OID 0)
-- Dependencies: 293
-- Name: user_device_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.user_device_tokens_id_seq OWNED BY public.user_device_tokens.id;


--
-- TOC entry 294 (class 1259 OID 16953)
-- Name: user_otps; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.user_otps (
    id integer NOT NULL,
    user_id text,
    otp character varying(6) NOT NULL,
    purpose character varying(20) DEFAULT 'transaction'::character varying,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_otps OWNER TO vishant;

--
-- TOC entry 295 (class 1259 OID 16958)
-- Name: user_otps_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.user_otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_otps_id_seq OWNER TO vishant;

--
-- TOC entry 4339 (class 0 OID 0)
-- Dependencies: 295
-- Name: user_otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.user_otps_id_seq OWNED BY public.user_otps.id;


--
-- TOC entry 296 (class 1259 OID 16959)
-- Name: user_packages; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.user_packages (
    id integer NOT NULL,
    user_id integer NOT NULL,
    package_id integer NOT NULL,
    package_details json,
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    payment_method character varying(50),
    transaction_id character varying(255),
    purchased_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    activated_at timestamp without time zone
);


ALTER TABLE public.user_packages OWNER TO vishant;

--
-- TOC entry 297 (class 1259 OID 16966)
-- Name: user_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.user_packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_packages_id_seq OWNER TO vishant;

--
-- TOC entry 4340 (class 0 OID 0)
-- Dependencies: 297
-- Name: user_packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.user_packages_id_seq OWNED BY public.user_packages.id;


--
-- TOC entry 298 (class 1259 OID 16967)
-- Name: users; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(100) NOT NULL,
    aadhaar_no character varying(12),
    dob date,
    gender character varying(10),
    pan_no character varying(10),
    email character varying(150) NOT NULL,
    phone character varying(15) NOT NULL,
    whatsapp_no character varying(15),
    address text,
    city character varying(100),
    state character varying(100),
    pin character varying(10),
    bank_name character varying(100),
    account_holder_name character varying(100),
    account_no character varying(30),
    ifsc_code character varying(15),
    branch character varying(100),
    referral_code character varying(20) NOT NULL,
    referrer_id integer,
    referrer_name character varying(100),
    referrer_contact character varying(15),
    node_path public.ltree,
    business_level integer DEFAULT 0,
    nominee_name character varying(100),
    nominee_relationship character varying(50),
    nominee_age integer,
    nominee_contact character varying(15),
    nominee_aadhaar character varying(12),
    agreed_to_terms boolean DEFAULT false,
    gstin character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    role character varying(20) DEFAULT 'Distributor'::character varying,
    is_active boolean DEFAULT true,
    profile_pic text,
    kyc_status boolean DEFAULT false,
    transaction_pin_hash character varying(255),
    last_password_change timestamp with time zone,
    otp_email_count integer DEFAULT 0,
    binary_path public.ltree,
    "position" integer,
    failed_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    role_id integer,
    CONSTRAINT chk_position CHECK ((("position" = ANY (ARRAY[1, 2])) OR ("position" IS NULL)))
);


ALTER TABLE public.users OWNER TO vishant;

--
-- TOC entry 4341 (class 0 OID 0)
-- Dependencies: 298
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON TABLE public.users IS 'Users table with MLM hierarchy + KYC/Bank details + kyc_status (new)';


--
-- TOC entry 4342 (class 0 OID 0)
-- Dependencies: 298
-- Name: COLUMN users.kyc_status; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON COLUMN public.users.kyc_status IS 'User KYC verification status - FALSE=Pending, TRUE=Approved';


--
-- TOC entry 299 (class 1259 OID 16981)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO vishant;

--
-- TOC entry 4343 (class 0 OID 0)
-- Dependencies: 299
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 300 (class 1259 OID 16982)
-- Name: variant_attr_mapping; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.variant_attr_mapping (
    variant_id integer NOT NULL,
    attr_value_id integer NOT NULL
);


ALTER TABLE public.variant_attr_mapping OWNER TO vishant;

--
-- TOC entry 301 (class 1259 OID 16985)
-- Name: wallets; Type: TABLE; Schema: public; Owner: vishant
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id integer,
    total_amount numeric(15,2) DEFAULT 0.00,
    pending_amount numeric(15,2) DEFAULT 0.00,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    left_count integer DEFAULT 0,
    right_count integer DEFAULT 0,
    paid_pairs integer DEFAULT 0,
    company_fund numeric(15,2) DEFAULT 0.00
);


ALTER TABLE public.wallets OWNER TO vishant;

--
-- TOC entry 302 (class 1259 OID 16994)
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: vishant
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallets_id_seq OWNER TO vishant;

--
-- TOC entry 4344 (class 0 OID 0)
-- Dependencies: 302
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vishant
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- TOC entry 3660 (class 2604 OID 16995)
-- Name: app_settings id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq'::regclass);


--
-- TOC entry 3662 (class 2604 OID 16996)
-- Name: attr_values id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.attr_values ALTER COLUMN id SET DEFAULT nextval('public.attr_values_id_seq'::regclass);


--
-- TOC entry 3663 (class 2604 OID 16997)
-- Name: attributes id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.attributes ALTER COLUMN id SET DEFAULT nextval('public.attributes_id_seq'::regclass);


--
-- TOC entry 3664 (class 2604 OID 16998)
-- Name: banners id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.banners ALTER COLUMN id SET DEFAULT nextval('public.banners_id_seq'::regclass);


--
-- TOC entry 3671 (class 2604 OID 16999)
-- Name: blog_categories id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.blog_categories ALTER COLUMN id SET DEFAULT nextval('public.blog_categories_id_seq'::regclass);


--
-- TOC entry 3672 (class 2604 OID 17000)
-- Name: blog_comments id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.blog_comments ALTER COLUMN id SET DEFAULT nextval('public.blog_comments_id_seq'::regclass);


--
-- TOC entry 3679 (class 2604 OID 17001)
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- TOC entry 3682 (class 2604 OID 17002)
-- Name: cities id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.cities ALTER COLUMN id SET DEFAULT nextval('public.cities_id_seq'::regclass);


--
-- TOC entry 3685 (class 2604 OID 17003)
-- Name: company_settings id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.company_settings ALTER COLUMN id SET DEFAULT nextval('public.company_settings_id_seq'::regclass);


--
-- TOC entry 3687 (class 2604 OID 17004)
-- Name: coupon_usages id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages ALTER COLUMN id SET DEFAULT nextval('public.coupon_usages_id_seq'::regclass);


--
-- TOC entry 3689 (class 2604 OID 17005)
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- TOC entry 3698 (class 2604 OID 17006)
-- Name: daily_transaction_limits id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.daily_transaction_limits ALTER COLUMN id SET DEFAULT nextval('public.daily_transaction_limits_id_seq'::regclass);


--
-- TOC entry 3702 (class 2604 OID 17007)
-- Name: distributor_inventory id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.distributor_inventory ALTER COLUMN id SET DEFAULT nextval('public.distributor_inventory_id_seq'::regclass);


--
-- TOC entry 3729 (class 2604 OID 17008)
-- Name: kyc_documents id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.kyc_documents ALTER COLUMN id SET DEFAULT nextval('public.kyc_documents_id_seq'::regclass);


--
-- TOC entry 3733 (class 2604 OID 17009)
-- Name: kyc_requests id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.kyc_requests ALTER COLUMN id SET DEFAULT nextval('public.kyc_requests_id_seq'::regclass);


--
-- TOC entry 3737 (class 2604 OID 17010)
-- Name: level_cappings id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_cappings ALTER COLUMN id SET DEFAULT nextval('public.level_cappings_id_seq'::regclass);


--
-- TOC entry 3743 (class 2604 OID 17011)
-- Name: level_commissions id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_commissions ALTER COLUMN id SET DEFAULT nextval('public.level_commissions_id_seq'::regclass);


--
-- TOC entry 3749 (class 2604 OID 17012)
-- Name: level_milestones id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_milestones ALTER COLUMN id SET DEFAULT nextval('public.level_milestones_id_seq'::regclass);


--
-- TOC entry 3752 (class 2604 OID 17013)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 3755 (class 2604 OID 17014)
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- TOC entry 3760 (class 2604 OID 17015)
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- TOC entry 3767 (class 2604 OID 17016)
-- Name: packages id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.packages ALTER COLUMN id SET DEFAULT nextval('public.packages_id_seq'::regclass);


--
-- TOC entry 3771 (class 2604 OID 17017)
-- Name: pro_variants id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.pro_variants ALTER COLUMN id SET DEFAULT nextval('public.pro_variants_id_seq'::regclass);


--
-- TOC entry 3776 (class 2604 OID 17018)
-- Name: products id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- TOC entry 3785 (class 2604 OID 17019)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 3846 (class 2604 OID 32808)
-- Name: sample_requests id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.sample_requests ALTER COLUMN id SET DEFAULT nextval('public.sample_requests_id_seq'::regclass);


--
-- TOC entry 3789 (class 2604 OID 17020)
-- Name: staff id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);


--
-- TOC entry 3792 (class 2604 OID 17021)
-- Name: states id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.states ALTER COLUMN id SET DEFAULT nextval('public.states_id_seq'::regclass);


--
-- TOC entry 3795 (class 2604 OID 17022)
-- Name: static_content id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.static_content ALTER COLUMN id SET DEFAULT nextval('public.static_content_id_seq'::regclass);


--
-- TOC entry 3798 (class 2604 OID 17023)
-- Name: tax_settings id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.tax_settings ALTER COLUMN id SET DEFAULT nextval('public.tax_settings_id_seq'::regclass);


--
-- TOC entry 3804 (class 2604 OID 17024)
-- Name: team_members id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.team_members ALTER COLUMN id SET DEFAULT nextval('public.team_members_id_seq'::regclass);


--
-- TOC entry 3849 (class 2604 OID 40969)
-- Name: ticket_reads id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ticket_reads ALTER COLUMN id SET DEFAULT nextval('public.ticket_reads_id_seq'::regclass);


--
-- TOC entry 3808 (class 2604 OID 17025)
-- Name: ticket_replies id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ticket_replies ALTER COLUMN id SET DEFAULT nextval('public.ticket_replies_id_seq'::regclass);


--
-- TOC entry 3812 (class 2604 OID 17026)
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- TOC entry 3816 (class 2604 OID 17027)
-- Name: transaction_pins id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.transaction_pins ALTER COLUMN id SET DEFAULT nextval('public.transaction_pins_id_seq'::regclass);


--
-- TOC entry 3818 (class 2604 OID 17028)
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- TOC entry 3821 (class 2604 OID 17029)
-- Name: user_device_tokens id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_device_tokens ALTER COLUMN id SET DEFAULT nextval('public.user_device_tokens_id_seq'::regclass);


--
-- TOC entry 3823 (class 2604 OID 17030)
-- Name: user_otps id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_otps ALTER COLUMN id SET DEFAULT nextval('public.user_otps_id_seq'::regclass);


--
-- TOC entry 3826 (class 2604 OID 17031)
-- Name: user_packages id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_packages ALTER COLUMN id SET DEFAULT nextval('public.user_packages_id_seq'::regclass);


--
-- TOC entry 3829 (class 2604 OID 17032)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3838 (class 2604 OID 17033)
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- TOC entry 3870 (class 2606 OID 17035)
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3872 (class 2606 OID 17037)
-- Name: app_settings app_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_setting_key_key UNIQUE (setting_key);


--
-- TOC entry 3876 (class 2606 OID 17039)
-- Name: attr_values attr_values_attr_id_value_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.attr_values
    ADD CONSTRAINT attr_values_attr_id_value_key UNIQUE (attr_id, value);


--
-- TOC entry 3878 (class 2606 OID 17041)
-- Name: attr_values attr_values_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.attr_values
    ADD CONSTRAINT attr_values_pkey PRIMARY KEY (id);


--
-- TOC entry 3880 (class 2606 OID 17043)
-- Name: attributes attributes_name_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_name_key UNIQUE (name);


--
-- TOC entry 3882 (class 2606 OID 17045)
-- Name: attributes attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_pkey PRIMARY KEY (id);


--
-- TOC entry 3884 (class 2606 OID 17047)
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- TOC entry 3887 (class 2606 OID 17049)
-- Name: blog_categories blog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3889 (class 2606 OID 17051)
-- Name: blog_categories blog_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_slug_key UNIQUE (slug);


--
-- TOC entry 3891 (class 2606 OID 17053)
-- Name: blog_comments blog_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_pkey PRIMARY KEY (id);


--
-- TOC entry 3894 (class 2606 OID 17055)
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- TOC entry 3896 (class 2606 OID 17057)
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- TOC entry 3899 (class 2606 OID 17059)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3901 (class 2606 OID 17061)
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- TOC entry 3903 (class 2606 OID 17063)
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- TOC entry 3905 (class 2606 OID 17065)
-- Name: cities cities_state_id_name_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_name_key UNIQUE (state_id, name);


--
-- TOC entry 3909 (class 2606 OID 17067)
-- Name: company_settings company_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_key_key UNIQUE (key);


--
-- TOC entry 3911 (class 2606 OID 17069)
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3913 (class 2606 OID 17071)
-- Name: coupon_usages coupon_usages_coupon_id_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_coupon_id_ip_address_key UNIQUE (coupon_id, ip_address);


--
-- TOC entry 3915 (class 2606 OID 17073)
-- Name: coupon_usages coupon_usages_coupon_id_phone_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_coupon_id_phone_key UNIQUE (coupon_id, phone);


--
-- TOC entry 3917 (class 2606 OID 17075)
-- Name: coupon_usages coupon_usages_coupon_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_coupon_id_user_id_key UNIQUE (coupon_id, user_id);


--
-- TOC entry 3919 (class 2606 OID 17077)
-- Name: coupon_usages coupon_usages_coupon_id_username_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_coupon_id_username_key UNIQUE (coupon_id, username);


--
-- TOC entry 3921 (class 2606 OID 17079)
-- Name: coupon_usages coupon_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_pkey PRIMARY KEY (id);


--
-- TOC entry 3925 (class 2606 OID 17081)
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- TOC entry 3927 (class 2606 OID 17083)
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- TOC entry 3931 (class 2606 OID 17085)
-- Name: daily_transaction_limits daily_transaction_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.daily_transaction_limits
    ADD CONSTRAINT daily_transaction_limits_pkey PRIMARY KEY (id);


--
-- TOC entry 3933 (class 2606 OID 17087)
-- Name: daily_transaction_limits daily_transaction_limits_user_id_limit_date_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.daily_transaction_limits
    ADD CONSTRAINT daily_transaction_limits_user_id_limit_date_key UNIQUE (user_id, limit_date);


--
-- TOC entry 3936 (class 2606 OID 17089)
-- Name: distributor_inventory distributor_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.distributor_inventory
    ADD CONSTRAINT distributor_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 3941 (class 2606 OID 17091)
-- Name: e_cart_items e_cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_cart_items
    ADD CONSTRAINT e_cart_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3944 (class 2606 OID 17093)
-- Name: e_carts e_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_carts
    ADD CONSTRAINT e_carts_pkey PRIMARY KEY (id);


--
-- TOC entry 3946 (class 2606 OID 17095)
-- Name: e_carts e_carts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_carts
    ADD CONSTRAINT e_carts_user_id_key UNIQUE (user_id);


--
-- TOC entry 3949 (class 2606 OID 17097)
-- Name: e_payments e_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_payments
    ADD CONSTRAINT e_payments_pkey PRIMARY KEY (id);


--
-- TOC entry 3952 (class 2606 OID 17099)
-- Name: e_reviews e_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_reviews
    ADD CONSTRAINT e_reviews_pkey PRIMARY KEY (id);


--
-- TOC entry 3955 (class 2606 OID 17101)
-- Name: e_user_addresses e_user_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_user_addresses
    ADD CONSTRAINT e_user_addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 3958 (class 2606 OID 17103)
-- Name: e_wishlists e_wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_wishlists
    ADD CONSTRAINT e_wishlists_pkey PRIMARY KEY (id);


--
-- TOC entry 3960 (class 2606 OID 17105)
-- Name: e_wishlists e_wishlists_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_wishlists
    ADD CONSTRAINT e_wishlists_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- TOC entry 3963 (class 2606 OID 17107)
-- Name: ecom_user ecom_user_email_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ecom_user
    ADD CONSTRAINT ecom_user_email_key UNIQUE (email);


--
-- TOC entry 3965 (class 2606 OID 17109)
-- Name: ecom_user ecom_user_phone_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ecom_user
    ADD CONSTRAINT ecom_user_phone_key UNIQUE (phone);


--
-- TOC entry 3967 (class 2606 OID 17111)
-- Name: ecom_user ecom_user_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ecom_user
    ADD CONSTRAINT ecom_user_pkey PRIMARY KEY (id);


--
-- TOC entry 3973 (class 2606 OID 17113)
-- Name: kyc_documents kyc_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 3979 (class 2606 OID 17115)
-- Name: kyc_requests kyc_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.kyc_requests
    ADD CONSTRAINT kyc_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 3981 (class 2606 OID 17117)
-- Name: level_cappings level_cappings_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_cappings
    ADD CONSTRAINT level_cappings_pkey PRIMARY KEY (id);


--
-- TOC entry 3985 (class 2606 OID 17119)
-- Name: level_commissions level_commissions_level_no_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_commissions
    ADD CONSTRAINT level_commissions_level_no_key UNIQUE (level_no);


--
-- TOC entry 3987 (class 2606 OID 17121)
-- Name: level_commissions level_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_commissions
    ADD CONSTRAINT level_commissions_pkey PRIMARY KEY (id);


--
-- TOC entry 3989 (class 2606 OID 17123)
-- Name: level_milestones level_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_milestones
    ADD CONSTRAINT level_milestones_pkey PRIMARY KEY (id);


--
-- TOC entry 3991 (class 2606 OID 17125)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3994 (class 2606 OID 17127)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3997 (class 2606 OID 17129)
-- Name: orders orders_order_id_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_id_key UNIQUE (order_id);


--
-- TOC entry 3999 (class 2606 OID 17131)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 4001 (class 2606 OID 17133)
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- TOC entry 4004 (class 2606 OID 17135)
-- Name: pro_variants pro_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.pro_variants
    ADD CONSTRAINT pro_variants_pkey PRIMARY KEY (id);


--
-- TOC entry 4006 (class 2606 OID 17137)
-- Name: pro_variants pro_variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.pro_variants
    ADD CONSTRAINT pro_variants_sku_key UNIQUE (sku);


--
-- TOC entry 4008 (class 2606 OID 17139)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 4011 (class 2606 OID 17141)
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- TOC entry 4013 (class 2606 OID 17143)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 4096 (class 2606 OID 32814)
-- Name: sample_requests sample_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.sample_requests
    ADD CONSTRAINT sample_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4018 (class 2606 OID 17145)
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- TOC entry 4020 (class 2606 OID 17147)
-- Name: staff staff_user_id_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_user_id_key UNIQUE (user_id);


--
-- TOC entry 4023 (class 2606 OID 17149)
-- Name: states states_name_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_name_key UNIQUE (name);


--
-- TOC entry 4025 (class 2606 OID 17151)
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- TOC entry 4027 (class 2606 OID 17153)
-- Name: static_content static_content_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.static_content
    ADD CONSTRAINT static_content_pkey PRIMARY KEY (id);


--
-- TOC entry 4029 (class 2606 OID 17155)
-- Name: static_content static_content_slug_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.static_content
    ADD CONSTRAINT static_content_slug_key UNIQUE (slug);


--
-- TOC entry 4031 (class 2606 OID 17157)
-- Name: tax_settings tax_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.tax_settings
    ADD CONSTRAINT tax_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 4034 (class 2606 OID 17159)
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- TOC entry 4100 (class 2606 OID 40974)
-- Name: ticket_reads ticket_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ticket_reads
    ADD CONSTRAINT ticket_reads_pkey PRIMARY KEY (id);


--
-- TOC entry 4102 (class 2606 OID 40993)
-- Name: ticket_reads ticket_reads_ticket_id_viewer_user_id_viewer_user_type_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ticket_reads
    ADD CONSTRAINT ticket_reads_ticket_id_viewer_user_id_viewer_user_type_key UNIQUE (ticket_id, viewer_user_id, viewer_user_type);


--
-- TOC entry 4038 (class 2606 OID 17161)
-- Name: ticket_replies ticket_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_pkey PRIMARY KEY (id);


--
-- TOC entry 4042 (class 2606 OID 17163)
-- Name: tickets tickets_case_id_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_case_id_key UNIQUE (case_id);


--
-- TOC entry 4044 (class 2606 OID 17165)
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- TOC entry 4047 (class 2606 OID 17167)
-- Name: transaction_pins transaction_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.transaction_pins
    ADD CONSTRAINT transaction_pins_pkey PRIMARY KEY (id);


--
-- TOC entry 4049 (class 2606 OID 17169)
-- Name: transaction_pins transaction_pins_user_id_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.transaction_pins
    ADD CONSTRAINT transaction_pins_user_id_key UNIQUE (user_id);


--
-- TOC entry 4053 (class 2606 OID 17171)
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3975 (class 2606 OID 17173)
-- Name: kyc_documents unique_kyc_user_document; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT unique_kyc_user_document UNIQUE (user_id, document_type);


--
-- TOC entry 4345 (class 0 OID 0)
-- Dependencies: 3975
-- Name: CONSTRAINT unique_kyc_user_document ON kyc_documents; Type: COMMENT; Schema: public; Owner: vishant
--

COMMENT ON CONSTRAINT unique_kyc_user_document ON public.kyc_documents IS 'Ensures one document per type per user - supports UPSERT re-uploads after rejection';


--
-- TOC entry 3983 (class 2606 OID 17175)
-- Name: level_cappings unique_level_capping; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_cappings
    ADD CONSTRAINT unique_level_capping UNIQUE (level_id);


--
-- TOC entry 4055 (class 2606 OID 17177)
-- Name: user_device_tokens user_device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_device_tokens
    ADD CONSTRAINT user_device_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4059 (class 2606 OID 17179)
-- Name: user_otps user_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_otps
    ADD CONSTRAINT user_otps_pkey PRIMARY KEY (id);


--
-- TOC entry 4061 (class 2606 OID 41048)
-- Name: user_otps user_otps_user_id_purpose_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_otps
    ADD CONSTRAINT user_otps_user_id_purpose_key UNIQUE (user_id, purpose);


--
-- TOC entry 4063 (class 2606 OID 17183)
-- Name: user_packages user_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_packages
    ADD CONSTRAINT user_packages_pkey PRIMARY KEY (id);


--
-- TOC entry 4071 (class 2606 OID 17185)
-- Name: users users_aadhaar_no_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_aadhaar_no_key UNIQUE (aadhaar_no);


--
-- TOC entry 4073 (class 2606 OID 17187)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4075 (class 2606 OID 17189)
-- Name: users users_pan_no_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pan_no_key UNIQUE (pan_no);


--
-- TOC entry 4077 (class 2606 OID 17191)
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- TOC entry 4079 (class 2606 OID 17193)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4081 (class 2606 OID 17195)
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- TOC entry 4083 (class 2606 OID 17197)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4085 (class 2606 OID 17199)
-- Name: variant_attr_mapping variant_attr_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.variant_attr_mapping
    ADD CONSTRAINT variant_attr_mapping_pkey PRIMARY KEY (variant_id, attr_value_id);


--
-- TOC entry 4089 (class 2606 OID 17201)
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- TOC entry 4091 (class 2606 OID 17203)
-- Name: wallets wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);


--
-- TOC entry 3956 (class 1259 OID 17204)
-- Name: idx_addresses_user; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_addresses_user ON public.e_user_addresses USING btree (user_id);


--
-- TOC entry 3873 (class 1259 OID 17205)
-- Name: idx_app_settings_category; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_app_settings_category ON public.app_settings USING btree (category);


--
-- TOC entry 3874 (class 1259 OID 17206)
-- Name: idx_app_settings_key; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_app_settings_key ON public.app_settings USING btree (setting_key);


--
-- TOC entry 3885 (class 1259 OID 17207)
-- Name: idx_banners_status_order; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_banners_status_order ON public.banners USING btree (status, display_order);


--
-- TOC entry 3892 (class 1259 OID 17208)
-- Name: idx_blog_comments_post_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_blog_comments_post_id ON public.blog_comments USING btree (post_id);


--
-- TOC entry 3897 (class 1259 OID 17209)
-- Name: idx_blog_posts_slug; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_blog_posts_slug ON public.blog_posts USING btree (slug);


--
-- TOC entry 3942 (class 1259 OID 17210)
-- Name: idx_cart_items_cart; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_cart_items_cart ON public.e_cart_items USING btree (cart_id);


--
-- TOC entry 3947 (class 1259 OID 17211)
-- Name: idx_cart_user; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_cart_user ON public.e_carts USING btree (user_id);


--
-- TOC entry 3906 (class 1259 OID 17212)
-- Name: idx_cities_state_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_cities_state_id ON public.cities USING btree (state_id);


--
-- TOC entry 3907 (class 1259 OID 17213)
-- Name: idx_cities_status; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_cities_status ON public.cities USING btree (status);


--
-- TOC entry 3922 (class 1259 OID 17214)
-- Name: idx_coupon_usages_coupon_phone; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_coupon_usages_coupon_phone ON public.coupon_usages USING btree (coupon_id, phone);


--
-- TOC entry 3923 (class 1259 OID 17215)
-- Name: idx_coupon_usages_coupon_user; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_coupon_usages_coupon_user ON public.coupon_usages USING btree (coupon_id, user_id);


--
-- TOC entry 3928 (class 1259 OID 17216)
-- Name: idx_coupons_code_status; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_coupons_code_status ON public.coupons USING btree (code, status);


--
-- TOC entry 3929 (class 1259 OID 17217)
-- Name: idx_coupons_expires; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_coupons_expires ON public.coupons USING btree (expires_at) WHERE ((status)::text = 'active'::text);


--
-- TOC entry 3934 (class 1259 OID 17218)
-- Name: idx_daily_limits_user_date; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_daily_limits_user_date ON public.daily_transaction_limits USING btree (user_id, limit_date);


--
-- TOC entry 3937 (class 1259 OID 17219)
-- Name: idx_distributor_inventory_distributor_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_distributor_inventory_distributor_id ON public.distributor_inventory USING btree (distributor_id);


--
-- TOC entry 3938 (class 1259 OID 17220)
-- Name: idx_distributor_inventory_product_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_distributor_inventory_product_id ON public.distributor_inventory USING btree (product_id);


--
-- TOC entry 3939 (class 1259 OID 17221)
-- Name: idx_distributor_inventory_unique; Type: INDEX; Schema: public; Owner: vishant
--

CREATE UNIQUE INDEX idx_distributor_inventory_unique ON public.distributor_inventory USING btree (distributor_id, product_id, COALESCE(variant_id, 0));


--
-- TOC entry 3968 (class 1259 OID 17222)
-- Name: idx_ecom_user_distributor; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_ecom_user_distributor ON public.ecom_user USING btree (distributor_code);


--
-- TOC entry 3969 (class 1259 OID 17223)
-- Name: idx_ecom_user_email; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_ecom_user_email ON public.ecom_user USING btree (email);


--
-- TOC entry 3970 (class 1259 OID 17224)
-- Name: idx_ecom_user_phone; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_ecom_user_phone ON public.ecom_user USING btree (phone);


--
-- TOC entry 3976 (class 1259 OID 17225)
-- Name: idx_kyc_requests_status; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_kyc_requests_status ON public.kyc_requests USING btree (status);


--
-- TOC entry 3977 (class 1259 OID 17226)
-- Name: idx_kyc_requests_user_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_kyc_requests_user_id ON public.kyc_requests USING btree (user_id);


--
-- TOC entry 3971 (class 1259 OID 17227)
-- Name: idx_kyc_user_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_kyc_user_id ON public.kyc_documents USING btree (user_id);


--
-- TOC entry 3992 (class 1259 OID 17228)
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- TOC entry 3995 (class 1259 OID 17229)
-- Name: idx_orders_public_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_orders_public_id ON public.orders USING btree (order_id);


--
-- TOC entry 3950 (class 1259 OID 17230)
-- Name: idx_payments_order; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_payments_order ON public.e_payments USING btree (order_id);


--
-- TOC entry 4002 (class 1259 OID 17231)
-- Name: idx_pro_variants_sku; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_pro_variants_sku ON public.pro_variants USING btree (sku);


--
-- TOC entry 3953 (class 1259 OID 41036)
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_reviews_product ON public.e_reviews USING btree (product_id);


--
-- TOC entry 4092 (class 1259 OID 32817)
-- Name: idx_sample_requests_created_at; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_sample_requests_created_at ON public.sample_requests USING btree (created_at);


--
-- TOC entry 4093 (class 1259 OID 32816)
-- Name: idx_sample_requests_email; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_sample_requests_email ON public.sample_requests USING btree (email);


--
-- TOC entry 4094 (class 1259 OID 32815)
-- Name: idx_sample_requests_phone; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_sample_requests_phone ON public.sample_requests USING btree (phone);


--
-- TOC entry 4014 (class 1259 OID 17233)
-- Name: idx_staff_department; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_staff_department ON public.staff USING btree (department);


--
-- TOC entry 4015 (class 1259 OID 17234)
-- Name: idx_staff_role_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_staff_role_id ON public.staff USING btree (role_id);


--
-- TOC entry 4016 (class 1259 OID 17235)
-- Name: idx_staff_user_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_staff_user_id ON public.staff USING btree (user_id);


--
-- TOC entry 4021 (class 1259 OID 17236)
-- Name: idx_states_status; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_states_status ON public.states USING btree (status);


--
-- TOC entry 4032 (class 1259 OID 17237)
-- Name: idx_team_members_status; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_team_members_status ON public.team_members USING btree (status);


--
-- TOC entry 4097 (class 1259 OID 40987)
-- Name: idx_ticket_reads_ticket_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_ticket_reads_ticket_id ON public.ticket_reads USING btree (ticket_id);


--
-- TOC entry 4098 (class 1259 OID 40994)
-- Name: idx_ticket_reads_viewer; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_ticket_reads_viewer ON public.ticket_reads USING btree (viewer_user_id, viewer_user_type);


--
-- TOC entry 4035 (class 1259 OID 41027)
-- Name: idx_ticket_replies_replied_by; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_ticket_replies_replied_by ON public.ticket_replies USING btree (replied_by);


--
-- TOC entry 4036 (class 1259 OID 17239)
-- Name: idx_ticket_replies_ticket_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_ticket_replies_ticket_id ON public.ticket_replies USING btree (ticket_id);


--
-- TOC entry 4039 (class 1259 OID 17240)
-- Name: idx_tickets_case_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_tickets_case_id ON public.tickets USING btree (case_id);


--
-- TOC entry 4040 (class 1259 OID 17241)
-- Name: idx_tickets_email; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_tickets_email ON public.tickets USING btree (email);


--
-- TOC entry 4050 (class 1259 OID 17242)
-- Name: idx_trans_order_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_trans_order_id ON public.transactions USING btree (order_id);


--
-- TOC entry 4051 (class 1259 OID 17243)
-- Name: idx_trans_user_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_trans_user_id ON public.transactions USING btree (user_id);


--
-- TOC entry 4045 (class 1259 OID 17244)
-- Name: idx_transaction_pins_user_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_transaction_pins_user_id ON public.transaction_pins USING btree (user_id);


--
-- TOC entry 4064 (class 1259 OID 17245)
-- Name: idx_unique_binary_path; Type: INDEX; Schema: public; Owner: vishant
--

CREATE UNIQUE INDEX idx_unique_binary_path ON public.users USING btree (binary_path);


--
-- TOC entry 4056 (class 1259 OID 17246)
-- Name: idx_user_otps_expires; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_user_otps_expires ON public.user_otps USING btree (expires_at);


--
-- TOC entry 4057 (class 1259 OID 41049)
-- Name: idx_user_otps_user_purpose; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_user_otps_user_purpose ON public.user_otps USING btree (user_id, purpose);


--
-- TOC entry 4065 (class 1259 OID 17248)
-- Name: idx_users_binary_path; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_users_binary_path ON public.users USING gist (binary_path);


--
-- TOC entry 4066 (class 1259 OID 17249)
-- Name: idx_users_kyc_status; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_users_kyc_status ON public.users USING btree (kyc_status);


--
-- TOC entry 4067 (class 1259 OID 17250)
-- Name: idx_users_node_path; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_users_node_path ON public.users USING btree (node_path);


--
-- TOC entry 4068 (class 1259 OID 17251)
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- TOC entry 4086 (class 1259 OID 17252)
-- Name: idx_wallets_counts; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_wallets_counts ON public.wallets USING btree (left_count, right_count);


--
-- TOC entry 4087 (class 1259 OID 17253)
-- Name: idx_wallets_user_id; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_wallets_user_id ON public.wallets USING btree (user_id);


--
-- TOC entry 3961 (class 1259 OID 17254)
-- Name: idx_wishlist_user; Type: INDEX; Schema: public; Owner: vishant
--

CREATE INDEX idx_wishlist_user ON public.e_wishlists USING btree (user_id);


--
-- TOC entry 4009 (class 1259 OID 17255)
-- Name: products_slug_key; Type: INDEX; Schema: public; Owner: vishant
--

CREATE UNIQUE INDEX products_slug_key ON public.products USING btree (slug) WHERE (slug IS NOT NULL);


--
-- TOC entry 4069 (class 1259 OID 17256)
-- Name: unique_parent_position; Type: INDEX; Schema: public; Owner: vishant
--

CREATE UNIQUE INDEX unique_parent_position ON public.users USING btree (public.subpath(binary_path, 0, (public.nlevel(binary_path) - 1)), "position") WHERE (("position" IS NOT NULL) AND (public.nlevel(binary_path) > 1));


--
-- TOC entry 4144 (class 2620 OID 17257)
-- Name: coupons update_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: vishant
--

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4103 (class 2606 OID 17258)
-- Name: attr_values attr_values_attr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.attr_values
    ADD CONSTRAINT attr_values_attr_id_fkey FOREIGN KEY (attr_id) REFERENCES public.attributes(id) ON DELETE CASCADE;


--
-- TOC entry 4104 (class 2606 OID 17263)
-- Name: blog_comments blog_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE;


--
-- TOC entry 4105 (class 2606 OID 17268)
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- TOC entry 4106 (class 2606 OID 17273)
-- Name: cities cities_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE;


--
-- TOC entry 4107 (class 2606 OID 17278)
-- Name: coupon_usages coupon_usages_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;


--
-- TOC entry 4108 (class 2606 OID 17283)
-- Name: coupon_usages coupon_usages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- TOC entry 4109 (class 2606 OID 17288)
-- Name: coupon_usages coupon_usages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4110 (class 2606 OID 17293)
-- Name: daily_transaction_limits daily_transaction_limits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.daily_transaction_limits
    ADD CONSTRAINT daily_transaction_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4111 (class 2606 OID 17298)
-- Name: distributor_inventory distributor_inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.distributor_inventory
    ADD CONSTRAINT distributor_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4112 (class 2606 OID 17303)
-- Name: distributor_inventory distributor_inventory_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.distributor_inventory
    ADD CONSTRAINT distributor_inventory_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.pro_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4113 (class 2606 OID 17308)
-- Name: e_cart_items e_cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_cart_items
    ADD CONSTRAINT e_cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.e_carts(id) ON DELETE CASCADE;


--
-- TOC entry 4114 (class 2606 OID 17313)
-- Name: e_carts e_carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_carts
    ADD CONSTRAINT e_carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.ecom_user(id) ON DELETE CASCADE;


--
-- TOC entry 4115 (class 2606 OID 17318)
-- Name: e_reviews e_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_reviews
    ADD CONSTRAINT e_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.ecom_user(id) ON DELETE CASCADE;


--
-- TOC entry 4116 (class 2606 OID 17323)
-- Name: e_user_addresses e_user_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_user_addresses
    ADD CONSTRAINT e_user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.ecom_user(id) ON DELETE CASCADE;


--
-- TOC entry 4117 (class 2606 OID 17328)
-- Name: e_wishlists e_wishlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.e_wishlists
    ADD CONSTRAINT e_wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.ecom_user(id) ON DELETE CASCADE;


--
-- TOC entry 4120 (class 2606 OID 17333)
-- Name: level_cappings fk_level; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_cappings
    ADD CONSTRAINT fk_level FOREIGN KEY (level_id) REFERENCES public.level_commissions(id) ON DELETE CASCADE;


--
-- TOC entry 4121 (class 2606 OID 17338)
-- Name: level_milestones fk_milestone_level; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.level_milestones
    ADD CONSTRAINT fk_milestone_level FOREIGN KEY (level_id) REFERENCES public.level_commissions(id) ON DELETE CASCADE;


--
-- TOC entry 4122 (class 2606 OID 17343)
-- Name: order_items fk_order_items_product_id; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_product_id FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- TOC entry 4123 (class 2606 OID 17348)
-- Name: order_items fk_order_items_variant_id; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_variant_id FOREIGN KEY (variant_id) REFERENCES public.pro_variants(id) ON DELETE SET NULL;


--
-- TOC entry 4118 (class 2606 OID 17353)
-- Name: kyc_documents kyc_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4119 (class 2606 OID 17358)
-- Name: kyc_requests kyc_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.kyc_requests
    ADD CONSTRAINT kyc_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4124 (class 2606 OID 17363)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- TOC entry 4125 (class 2606 OID 17368)
-- Name: pro_variants pro_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.pro_variants
    ADD CONSTRAINT pro_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 4126 (class 2606 OID 17373)
-- Name: products products_cat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_cat_id_fkey FOREIGN KEY (cat_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- TOC entry 4127 (class 2606 OID 17378)
-- Name: products products_tax_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tax_id_fkey FOREIGN KEY (tax_id) REFERENCES public.tax_settings(id);


--
-- TOC entry 4128 (class 2606 OID 17383)
-- Name: staff staff_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- TOC entry 4129 (class 2606 OID 17388)
-- Name: staff staff_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 4130 (class 2606 OID 17393)
-- Name: staff staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4143 (class 2606 OID 40977)
-- Name: ticket_reads ticket_reads_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ticket_reads
    ADD CONSTRAINT ticket_reads_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- TOC entry 4131 (class 2606 OID 17403)
-- Name: ticket_replies ticket_replies_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.ticket_replies
    ADD CONSTRAINT ticket_replies_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- TOC entry 4132 (class 2606 OID 17408)
-- Name: tickets tickets_distributor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4133 (class 2606 OID 17413)
-- Name: transaction_pins transaction_pins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.transaction_pins
    ADD CONSTRAINT transaction_pins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4134 (class 2606 OID 17418)
-- Name: transactions transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- TOC entry 4135 (class 2606 OID 17423)
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4136 (class 2606 OID 17433)
-- Name: user_packages user_packages_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_packages
    ADD CONSTRAINT user_packages_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id);


--
-- TOC entry 4137 (class 2606 OID 17438)
-- Name: user_packages user_packages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.user_packages
    ADD CONSTRAINT user_packages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4138 (class 2606 OID 17443)
-- Name: users users_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4139 (class 2606 OID 17448)
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;


--
-- TOC entry 4140 (class 2606 OID 17453)
-- Name: variant_attr_mapping variant_attr_mapping_attr_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.variant_attr_mapping
    ADD CONSTRAINT variant_attr_mapping_attr_value_id_fkey FOREIGN KEY (attr_value_id) REFERENCES public.attr_values(id) ON DELETE CASCADE;


--
-- TOC entry 4141 (class 2606 OID 17458)
-- Name: variant_attr_mapping variant_attr_mapping_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.variant_attr_mapping
    ADD CONSTRAINT variant_attr_mapping_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.pro_variants(id) ON DELETE CASCADE;


--
-- TOC entry 4142 (class 2606 OID 17463)
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vishant
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-05-24 19:13:33

--
-- PostgreSQL database dump complete
--

\unrestrict j2PTBSaQmaRFGQt8oV895agDp6cGv9ZIY3XR2KHmBcc4dgLYPLoKeb6xRIw80DC

