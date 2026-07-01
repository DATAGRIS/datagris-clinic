# Module 11: APIs & Database Conceptual Schema

## 1. Backend REST Endpoints Map (قائمة واجهات البرمجة APIs)
* **POST `/api/checkout`:** Validates SaaS checkouts, plans upgrade.
* **GET `/api/reports/dashboard`:** Runs concurrent aggregation pipelines to fetch EMR dashboard summaries.
* **GET `/api/treasury/stats`:** Gathers current shift balances and cash movements timelines.
* **POST `/api/patients`:** Register new clinical client.

## 2. Conceptual Database Entities (الكيانات الأساسية بقاعدة البيانات)
* **clinics (العيادات):** The core tenant block. Every clinical workspace gets a unique text identifier (e.g. \`CLN-000011\`).
* **profiles (حسابات المستخدمين):** Staff profiles. Maps to Supabase authentication UID and references a clinic tenant.
* **patients (المرضى):** Represents clinical clients. Primary key is composite: \`(clinic_id, mobile_number)\` to prevent cross-tenant phone overlaps.
* **visits (الزيارات العيادية):** The core clinical record transaction. Captures complaint, vitals, prescriptions, and invoice status. References patients.
* **treasury_transactions (حركات الخزينة):** Shift balance logs. References treasury shift session and EMR visit IDs.

---
## RAG Optimization Details
* **Tags:** #APIs #DatabaseSchema #PostgreSQL #EntityRelationship #Supabase
* **Linked files:** [06_business_rules.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/06_business_rules.md), [08_reports_dashboards.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/08_reports_dashboards.md)
