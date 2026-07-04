-- Create guest_customers table
CREATE TABLE guest_customers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    phone text,
    notes text,
    created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for guest_customers
CREATE INDEX idx_guest_customers_org ON guest_customers(organization_id);
CREATE INDEX idx_guest_customers_branch ON guest_customers(branch_id);
CREATE INDEX idx_guest_customers_phone ON guest_customers(phone);