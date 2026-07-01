# Module 04: Buttons & Actions

## 1. "Summon Receptionist" Button (زر استدعاء الاستقبال)
* **Screen Location:** Doctor Portal Header.
* **Function:** Triggers WebSocket event \`SUMMON_RECEPTIONIST\` to reception dashboard.
* **Backend API:** Realtime WebSocket broadcast context.
* **Target Changes:** Plays chime bell and flashes banner alerts on reception UI.
* **Permissions:** Owner, Doctor.

## 2. "Save & Export PDF" Button (زر حفظ وتصدير الروشتة PDF)
* **Screen Location:** Prescription modal footer.
* **Function:** Triggers \`html2pdf\` compile pipeline.
* **Backend API:** POST `/api/whatsapp/send` (if WhatsApp is enabled).
* **Target Changes:** Saves PDF local copy, decreases item stock, commits visit status to database.
* **Permissions:** Owner, Doctor.

## 3. "Open Treasury Drawer" Button (زر فتح صندوق الخزينة)
* **Screen Location:** Treasury shift popup.
* **Function:** Starts a new active cashier shift session.
* **Backend API:** POST `/api/treasury/open`.
* **Target Changes:** Inserts active row to \`treasury_sessions\`.
* **Permissions:** Owner, Receptionist, Accountant.

---
## RAG Optimization Details
* **Tags:** #Buttons #Actions #Events #API #ChimeAlerts
* **Linked files:** [05_forms.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/05_forms.md), [11_api_database.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/11_api_database.md)
