CREATE EXTENSION IF NOT EXISTS ltree;


CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    aadhaar_no VARCHAR(12) UNIQUE,
    dob DATE,
    gender VARCHAR(10),
    pan_no VARCHAR(10) UNIQUE,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    whatsapp_no VARCHAR(15),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pin VARCHAR(10),
    bank_name VARCHAR(100),
    account_holder_name VARCHAR(100),
    account_no VARCHAR(30),
    ifsc_code VARCHAR(15),
    branch VARCHAR(100),
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referrer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    referrer_name VARCHAR(100),
    referrer_contact VARCHAR(15),
    node_path TEXT, 
    business_level INTEGER DEFAULT 0,
    nominee_name VARCHAR(100),
    nominee_relationship VARCHAR(50),
    nominee_age INTEGER,
    nominee_contact VARCHAR(15),
    nominee_aadhaar VARCHAR(12),
    agreed_to_terms BOOLEAN DEFAULT FALSE,
    gstin VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    cat_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    f_image TEXT,
    g_image TEXT[], 
    tax_id INTEGER,
    base_price NUMERIC(12,2),
    subcategories INTEGER[],
    attributes INTEGER[],
    variants JSONB,
    mrp_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (mrp_percentage >= 0 AND mrp_percentage <= 100),
    dpc_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (dpc_percentage >= 0 AND dpc_percentage <= 100),

    -- Shipping details
    hsn_code VARCHAR(30),
    weight NUMERIC(12,3),
    -- Dimensions stored as separate fields (units are responsibility of frontend/backend)
    dimension_length NUMERIC(12,3),
    dimension_width NUMERIC(12,3),
    dimension_height NUMERIC(12,3),
    dimension_unit VARCHAR(20),

    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS attributes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS attr_values (
    id SERIAL PRIMARY KEY,
    attr_id INTEGER REFERENCES attributes(id) ON DELETE CASCADE,
    value VARCHAR(50) NOT NULL,
    UNIQUE(attr_id, value)
);

CREATE TABLE IF NOT EXISTS pro_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    bv_point INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS variant_attr_mapping (
    variant_id INTEGER REFERENCES pro_variants(id) ON DELETE CASCADE,
    attr_value_id INTEGER REFERENCES attr_values(id) ON DELETE CASCADE,
    PRIMARY KEY (variant_id, attr_value_id)
);



CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) UNIQUE NOT NULL, -- Example: ORD-2024-1001
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Overall Financials
    sub_total DECIMAL(12, 2) NOT NULL,     -- Sum of all items price
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_charges DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,  -- Final payable amount
    total_bv_points INTEGER NOT NULL,      -- Total BV for MLM calculation
    
    -- Status
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- paid, unpaid, partially_paid
    order_status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, shipped, delivered, cancelled
    payment_method VARCHAR(50),                  -- UPI, Wallet, Card
    
    -- Delivery Address (Snapshot - in case user changes address later)
    shipping_address JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    variant_id INTEGER REFERENCES pro_variants(id),
    
    -- Snapshots (Price aur details yahan save honge taaki future price change se fark na pade)
    product_name VARCHAR(255),
    variant_sku VARCHAR(100),
    variant_details JSONB, -- Size, Color etc.
    
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    unit_bv_points INTEGER NOT NULL,
    
    total_item_price DECIMAL(12, 2) NOT NULL, -- (qty * unit_price)
    total_item_bv INTEGER NOT NULL,           -- (qty * unit_bv_points)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS level_commissions (
    id SERIAL PRIMARY KEY,
    level_no INTEGER NOT NULL UNIQUE, -- 1, 2, 3...
    commission_percentage DECIMAL(5, 2) NOT NULL, -- e.g., 10.00 for 10%
    min_rank_required VARCHAR(50) DEFAULT 'Distributor',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,   -- Settled/Withdrawable balance
    pending_amount DECIMAL(15, 2) DEFAULT 0.00, -- Held for verification/order completion
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('credit', 'debit')),
    category VARCHAR(20) CHECK (category IN ('commission', 'withdraw', 'purchase', 'ref_bonus')),
    
    -- MLM Traceability
    source_user_id INTEGER REFERENCES users(id), -- Member who triggered the commission
    order_id INTEGER REFERENCES orders(id),      -- Order that triggered the commission
    
    remarks TEXT,
    status VARCHAR(20) DEFAULT 'completed',      -- pending, completed, failed, reversed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS kyc_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50), -- PAN, Aadhaar Front, Aadhaar Back, Cheque
    doc_no VARCHAR(50),
    file_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    rejection_remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS static_content (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- 'about-us', 'privacy-policy', etc.
    content TEXT NOT NULL,              -- HTML or Markdown content
    meta_title VARCHAR(255),           -- For SEO
    meta_description TEXT,             -- For SEO
    status VARCHAR(20) DEFAULT 'published', -- draft, published
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,   -- 'office_address', 'support_email', 'phone_number'
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS banners (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),               -- Optional: Heading on the banner
    subtitle TEXT,                    -- Optional: Small text below heading
    image_url TEXT NOT NULL,          -- Desktop/Main Image
    mobile_image_url TEXT,            -- Optional: Specific crop for mobile screens
    
    -- Interaction Logic
    link_type VARCHAR(20) DEFAULT 'external', -- 'product', 'category', 'external', 'none'
    link_value TEXT,                  -- The URL or the ID of the product/category
    
    -- Display Control
    display_order INTEGER DEFAULT 0,  -- For sorting (1st, 2nd, 3rd)
    position VARCHAR(50) DEFAULT 'home_main', -- 'home_main', 'popup', 'sidebar', 'footer'
    status VARCHAR(20) DEFAULT 'active',      -- 'active', 'inactive'
    
    -- Scheduling (Great for sales/festivals)
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS tax_settings (
    id SERIAL PRIMARY KEY,
    tax_name VARCHAR(50) NOT NULL,      -- e.g., 'GST', 'VAT', 'Service Tax'
    tax_percentage DECIMAL(5, 2) NOT NULL, -- e.g., 18.00
    
    -- Region Specific (Optional but good for scaling)
    state_code VARCHAR(5),              -- If tax varies by state (e.g., SGST/CGST)
    country_code VARCHAR(5) DEFAULT 'IN',
    
    -- Calculation Logic
    is_inclusive BOOLEAN DEFAULT FALSE, -- TRUE if price already includes tax
    status VARCHAR(20) DEFAULT 'active', -- active, inactive
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add a Foreign Key to the Products table to link a tax slab
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_id INTEGER REFERENCES tax_settings(id);

CREATE INDEX idx_users_node_path ON users(node_path);
-- CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_public_id ON orders(order_id);
CREATE INDEX idx_pro_variants_sku ON pro_variants(sku);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_trans_user_id ON transactions(user_id);
CREATE INDEX idx_trans_order_id ON transactions(order_id);
CREATE INDEX idx_kyc_user_id ON kyc_documents(user_id);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_banners_status_order ON banners(status, display_order);

-- KYC Status Column (Idempotent - safe to run multiple times)
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN users.kyc_status IS 'User KYC verification status - FALSE=Pending, TRUE=Approved';
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users(kyc_status);

-- Distributor Inventory Table
CREATE TABLE IF NOT EXISTS distributor_inventory (
    id SERIAL PRIMARY KEY,
    distributor_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    variant_id INTEGER REFERENCES pro_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_distributor_inventory_unique
ON distributor_inventory (distributor_id, product_id, COALESCE(variant_id, 0));

CREATE INDEX IF NOT EXISTS idx_distributor_inventory_distributor_id ON distributor_inventory(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_inventory_product_id ON distributor_inventory(product_id);

-- Milestones Table
CREATE TABLE IF NOT EXISTS milestones (
    id SERIAL PRIMARY KEY,
    level_id INTEGER NOT NULL,
    milestone_name VARCHAR(100) NOT NULL,
    tour_details TEXT,
    reward_cash DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_milestones_level_id ON milestones(level_id);

-- =============================================
-- BLOG MODULE TABLES
-- =============================================

-- Blog Categories Table
CREATE TABLE IF NOT EXISTS blog_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Tags Table
CREATE TABLE IF NOT EXISTS blog_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Blog Posts Table
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    featured_image TEXT,
    category_id INTEGER REFERENCES blog_categories(id) ON DELETE SET NULL,
    related_product VARCHAR(20) DEFAULT 'none' CHECK (related_product IN ('pad', 'diaper', 'both', 'none')),
    meta_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Post Tags Junction Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS post_tags (
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- Indexes for Blog Module
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_related_product ON blog_posts(related_product);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category_id ON blog_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX IF NOT EXISTS idx_blog_tags_slug ON blog_tags(slug);

-- =============================================
-- SUPPORT TICKET (READ/UNREAD) MODULE
-- =============================================

-- Tracks last read timestamp per viewer (raiser/admin) for each ticket.
-- Unread badge is computed as: count of replies from the *other side* after last_read_at.
CREATE TABLE IF NOT EXISTS ticket_reads (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
    viewer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    viewer_user_type VARCHAR(20) NOT NULL, -- ECOM_USER / DISTRIBUTOR / STAFF / ADMIN
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticket_id, viewer_user_id, viewer_user_type)
);

CREATE INDEX IF NOT EXISTS idx_ticket_reads_ticket_id ON ticket_reads(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reads_viewer ON ticket_reads(viewer_user_id, viewer_user_type);

