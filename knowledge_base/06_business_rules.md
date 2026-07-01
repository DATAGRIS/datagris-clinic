# Module 06: Business Rules

## 1. RLS Tenant Boundaries (حماية وفصل العيادات)
* Every table query MUST check \`clinic_id = get_user_clinic_id()\`.
* Direct inserts or updates fail database verification if \`clinic_id\` is missing or mismatched.

## 2. Follow-Up Validity (فترة الاستشارة المجانية)
* Follow-ups are free only within the days defined in settings (e.g. 7 or 14 days from the last completed consultation).
* If a patient visits after the follow-up window, they must be registered as a paid consultation.

## 3. Stock Auto-Deductions (خصم المخازن التلقائي)
* Items mapped to a clinical service inside \`medical_services\` are automatically deducted from \`inventory_items\` database when the doctor completes a visit.
* If stock level drops below \`min_level\`, \`INVENTORY_ALERT\` is broadcasted immediately.

## 4. WhatsApp Key Trial Limiting (قيود الواتساب المجاني)
* Trial accounts mapped to WaSender integration are rate-limited to **1 message per minute**.
* System logs failure in \`whatsapp_logs\` as \`failed\` with code 429 if the rate limit is exceeded.

---
## RAG Optimization Details
* **Tags:** #Rules #RLS #Isolation #Followup #StockAlerts #RateLimits
* **Linked files:** [10_error_settings.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/10_error_settings.md)
