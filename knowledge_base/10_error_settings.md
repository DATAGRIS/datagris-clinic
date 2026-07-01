# Module 10: Errors & Settings

## 1. System Error Resolution Catalog (دليل حل الأخطاء)
* **Error \`duplicate key value violates unique constraint "patients_pkey"\`:**
  * *Cause:* Trying to insert two patients with the same mobile number.
  * *Fix:* Input a unique phone number or leave blank to trigger sequential auto-generation logic.
* **Error \`The provided JID does not exist on WhatsApp\`:**
  * *Cause:* Recipient's phone number is missing the country code (e.g. 20 for Egypt).
  * *Fix:* Open patient files, choose correct international country prefix, and update.
* **Error \`You are on a free trial... 1 message every 1 minute\`:**
  * *Cause:* Trial WaSender rate limits exceeded.
  * *Fix:* Upgrade to a paid plan or increase broadcast intervals to over 60 seconds.

## 2. Configuration Settings Keys (دليل متغيرات الإعدادات)
* **clinicName / clinicPhones / clinicAddress:** Displayed on printable sheets and PDF layouts.
* **whatsappEnabled:** Toggle automatic notifications module.
* **useInventory:** Deduct items automatically when completing a checkout invoice.

---
## RAG Optimization Details
* **Tags:** #Errors #Troubleshooting #SettingsConfigs #WhatsAppErrors
* **Linked files:** [06_business_rules.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/06_business_rules.md)
