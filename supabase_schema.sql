-- ====================================================
-- SUPABASE SAAS MULTI-TENANT DATABASE SCHEMA
-- ====================================================

-- 1. Clinics Workspace isolation
CREATE TABLE IF NOT EXISTS clinics (
    id VARCHAR(100) PRIMARY KEY, -- CLN-000001
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Profiles (App Users) mapped to Supabase auth.users
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- owner, doctor, receptionist, manager, accountant
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Subscriptions status and SaaS plan
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id VARCHAR(100) UNIQUE REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    owner_user_id UUID, -- References auth.users(id) / profiles(id)
    plan VARCHAR(50) NOT NULL DEFAULT 'trial', -- trial, pro_monthly, pro_yearly
    status VARCHAR(50) NOT NULL DEFAULT 'trial', -- trial, active, expired, cancelled, pending_payment
    trial_start_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    payment_provider VARCHAR(100),
    payment_transaction_id VARCHAR(255),
    payment_amount DOUBLE PRECISION,
    payment_currency VARCHAR(50),
    whatsapp_api_key TEXT,
    whatsapp_provider VARCHAR(100) DEFAULT 'meta',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Global Settings per Clinic
CREATE TABLE IF NOT EXISTS settings (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    PRIMARY KEY (clinic_id, key)
);

-- 5. Patients record
CREATE TABLE IF NOT EXISTS patients (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    mobile_number VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(50),
    age INT,
    weight DOUBLE PRECISION,
    height DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    chief_complaint TEXT,
    medical_history_json TEXT,
    total_paid DOUBLE PRECISION DEFAULT 0,
    visit_count INT DEFAULT 0,
    follow_up_count INT DEFAULT 0,
    average_waiting_time_seconds INT DEFAULT 0,
    file_number VARCHAR(100),
    registration_date VARCHAR(50),
    registration_time VARCHAR(50),
    whatsapp_enabled INT DEFAULT 1,
    parent_mobile VARCHAR(100),
    is_companion INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Companions
CREATE TABLE IF NOT EXISTS companions (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    patient_mobile VARCHAR(100) NOT NULL,
    companion_name VARCHAR(255) NOT NULL,
    age INT,
    chief_complaint TEXT
);

-- 7. Medical Services Offered
CREATE TABLE IF NOT EXISTS medical_services (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    description TEXT,
    price DOUBLE PRECISION NOT NULL,
    is_disabled INT DEFAULT 0
);

-- 8. Clinic Visits & EMR Queue
CREATE TABLE IF NOT EXISTS visits (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    patient_mobile VARCHAR(100) REFERENCES patients(mobile_number) ON DELETE SET NULL,
    visit_type VARCHAR(50),
    status VARCHAR(50),
    chief_complaint TEXT,
    examination_notes TEXT,
    diagnosis TEXT,
    prescription_json TEXT,
    referral_json TEXT,
    weight DOUBLE PRECISION,
    height DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    follow_up_days INT,
    follow_up_date VARCHAR(50),
    follow_up_expiry_date VARCHAR(50),
    paid_amount DOUBLE PRECISION DEFAULT 0,
    payment_status VARCHAR(50),
    is_exception_followup INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    waiting_time_seconds INT DEFAULT 0,
    consultation_start_time VARCHAR(100),
    consultation_end_time VARCHAR(100),
    consultation_duration_seconds INT DEFAULT 0,
    satisfaction_status VARCHAR(100),
    change_amount DOUBLE PRECISION DEFAULT 0,
    remaining_amount DOUBLE PRECISION DEFAULT 0,
    payment_date VARCHAR(50),
    payment_time VARCHAR(50),
    payment_user VARCHAR(255),
    is_resumed INT DEFAULT 0,
    diagnosis_after TEXT,
    inventory_deducted INT DEFAULT 0
);

-- 9. Services attached to Visits
CREATE TABLE IF NOT EXISTS visit_services (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    visit_id INT REFERENCES visits(id) ON DELETE CASCADE,
    service_id INT REFERENCES medical_services(id) ON DELETE SET NULL,
    service_name VARCHAR(255),
    price DOUBLE PRECISION,
    PRIMARY KEY (visit_id, service_id)
);

-- 10. Employees / Payroll
CREATE TABLE IF NOT EXISTS employees (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255),
    base_salary DOUBLE PRECISION,
    bonus DOUBLE PRECISION DEFAULT 0,
    incentive DOUBLE PRECISION DEFAULT 0,
    commission_percentage DOUBLE PRECISION DEFAULT 0,
    username VARCHAR(255),
    salary_day INT DEFAULT 30,
    last_paid_month VARCHAR(50)
);

-- 11. Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    supplier VARCHAR(255),
    quantity INT DEFAULT 0,
    min_level INT DEFAULT 0,
    unit VARCHAR(50),
    cost_price DOUBLE PRECISION DEFAULT 0,
    selling_price DOUBLE PRECISION DEFAULT 0,
    is_disabled INT DEFAULT 0,
    category VARCHAR(255),
    item_type VARCHAR(100) DEFAULT 'quantity',
    notes TEXT,
    usage_count INT DEFAULT 0,
    billable INT DEFAULT 0,
    barcode VARCHAR(100),
    qr_code VARCHAR(100)
);

-- 12. Maintenance Records
CREATE TABLE IF NOT EXISTS maintenance_records (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    representative_name VARCHAR(255),
    maintenance_date VARCHAR(50),
    next_maintenance_date VARCHAR(50),
    cost DOUBLE PRECISION DEFAULT 0,
    notes TEXT
);

-- 13. Financial Vouchers (Expense / Income)
CREATE TABLE IF NOT EXISTS vouchers (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    recipient_payer VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. Audit Trails
CREATE TABLE IF NOT EXISTS audit_logs (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    user_id INT,
    username VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. EMR Templates
CREATE TABLE IF NOT EXISTS examination_templates (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    category VARCHAR(255),
    type VARCHAR(255),
    option_value TEXT
);

-- 16. Patient Refunds
CREATE TABLE IF NOT EXISTS refunds (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    visit_id INT REFERENCES visits(id) ON DELETE SET NULL,
    category VARCHAR(255),
    patient_name VARCHAR(255),
    amount DOUBLE PRECISION NOT NULL,
    reason TEXT,
    user_responsible VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. External Partners (e.g. Pharmacies/Labs)
CREATE TABLE IF NOT EXISTS external_partners (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    type VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(255),
    notes TEXT
);

-- 18. Partner Referrals
CREATE TABLE IF NOT EXISTS referrals (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    visit_id INT REFERENCES visits(id) ON DELETE CASCADE,
    patient_name VARCHAR(255),
    partner_id INT REFERENCES external_partners(id) ON DELETE CASCADE,
    partner_name VARCHAR(255),
    medications_json TEXT,
    supplies_json TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 19. EMR Internal Chat Room
CREATE TABLE IF NOT EXISTS chat_messages (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    sender_username VARCHAR(255) NOT NULL,
    sender_fullname VARCHAR(255) NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. Inventory Stock Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    transaction_date VARCHAR(50),
    patient_name VARCHAR(255),
    patient_mobile VARCHAR(100),
    visit_id INT REFERENCES visits(id) ON DELETE SET NULL,
    item_name VARCHAR(255),
    quantity_used DOUBLE PRECISION,
    user_responsible VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 21. Items used per visit
CREATE TABLE IF NOT EXISTS visit_inventory_items (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    visit_id INT REFERENCES visits(id) ON DELETE CASCADE,
    item_id INT REFERENCES inventory_items(id) ON DELETE SET NULL,
    item_name VARCHAR(255),
    quantity DOUBLE PRECISION,
    price DOUBLE PRECISION DEFAULT 0,
    billable INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 22. Daily Cashier Drawer Session
CREATE TABLE IF NOT EXISTS treasury_sessions (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    opening_date VARCHAR(50) NOT NULL,
    opening_time VARCHAR(50) NOT NULL,
    opening_balance DOUBLE PRECISION NOT NULL,
    opening_user VARCHAR(255) NOT NULL,
    closing_date VARCHAR(50),
    closing_time VARCHAR(50),
    closing_user VARCHAR(255),
    expected_closing_balance DOUBLE PRECISION,
    actual_closing_balance DOUBLE PRECISION,
    difference DOUBLE PRECISION,
    status VARCHAR(50) DEFAULT 'open',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 23. Cashier Movements
CREATE TABLE IF NOT EXISTS treasury_transactions (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    treasury_session_id INT REFERENCES treasury_sessions(id) ON DELETE SET NULL,
    date VARCHAR(50) NOT NULL,
    time VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL, -- income, expense, refund, adjustment
    amount DOUBLE PRECISION NOT NULL,
    description TEXT,
    related_patient_mobile VARCHAR(100),
    related_visit_id INT REFERENCES visits(id) ON DELETE SET NULL,
    user_responsible VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 24. Shift Expenses
CREATE TABLE IF NOT EXISTS treasury_expenses (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    treasury_transaction_id INT REFERENCES treasury_transactions(id) ON DELETE SET NULL,
    category VARCHAR(255) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    date VARCHAR(50) NOT NULL,
    time VARCHAR(50) NOT NULL,
    description TEXT,
    user_responsible VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 25. WhatsApp Logs
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    recipient_mobile VARCHAR(100) NOT NULL,
    message_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 26. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- info, warning, danger
    is_read INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 27. Dashboard Reports Metadata
CREATE TABLE IF NOT EXISTS reports (
    clinic_id VARCHAR(100) REFERENCES clinics(id) ON DELETE CASCADE NOT NULL,
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ====================================================
-- INDEXING
-- ====================================================
CREATE INDEX IF NOT EXISTS idx_patients_clinic_file ON patients(clinic_id, file_number);
CREATE INDEX IF NOT EXISTS idx_visits_clinic_patient ON visits(clinic_id, patient_mobile);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory_items(clinic_id, barcode);
CREATE INDEX IF NOT EXISTS idx_treasury_session ON treasury_transactions(clinic_id, treasury_session_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);


-- ====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================

-- Enable RLS on all clinic-specific tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE companions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE examination_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Helper function to fetch the clinic_id of the currently authenticated Supabase user
CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS VARCHAR(100) AS $$
    SELECT clinic_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies targeting clinic isolation
CREATE POLICY profiles_clinic_isolation ON profiles FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY subscriptions_clinic_isolation ON subscriptions FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY settings_clinic_isolation ON settings FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY patients_clinic_isolation ON patients FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY companions_clinic_isolation ON companions FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY medical_services_clinic_isolation ON medical_services FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY visits_clinic_isolation ON visits FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY visit_services_clinic_isolation ON visit_services FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY employees_clinic_isolation ON employees FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY inventory_items_clinic_isolation ON inventory_items FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY maintenance_records_clinic_isolation ON maintenance_records FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY vouchers_clinic_isolation ON vouchers FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY audit_logs_clinic_isolation ON audit_logs FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY examination_templates_clinic_isolation ON examination_templates FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY refunds_clinic_isolation ON refunds FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY external_partners_clinic_isolation ON external_partners FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY referrals_clinic_isolation ON referrals FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY chat_messages_clinic_isolation ON chat_messages FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY inventory_transactions_clinic_isolation ON inventory_transactions FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY visit_inventory_items_clinic_isolation ON visit_inventory_items FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY treasury_sessions_clinic_isolation ON treasury_sessions FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY treasury_transactions_clinic_isolation ON treasury_transactions FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY treasury_expenses_clinic_isolation ON treasury_expenses FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY whatsapp_logs_clinic_isolation ON whatsapp_logs FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY notifications_clinic_isolation ON notifications FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());
CREATE POLICY reports_clinic_isolation ON reports FOR ALL USING (clinic_id = get_user_clinic_id()) WITH CHECK (clinic_id = get_user_clinic_id());

-- Allow profiles to be created during user sign-up by the Vercel backend service (bypassing the get_user_clinic_id() filter during first insert)
-- Vercel will create the user inside auth.users, and then insert user profiles using standard profiles insert.
-- We can add a policy allowing service role or standard inserts for newly registered users.
CREATE POLICY profiles_insert_policy ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY clinics_insert_policy ON clinics FOR INSERT WITH CHECK (true);
CREATE POLICY subscriptions_insert_policy ON subscriptions FOR INSERT WITH CHECK (true);
