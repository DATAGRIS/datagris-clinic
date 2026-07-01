# Module 09: Search & Notifications

## 1. Database Index Searches (البحث السريع والفلاتر)
* **Patient Search:** Can search by name or mobile number (matches are filtered through database indexing).
* **Inventory Search:** Barcode scans or typing category filters stock records.

## 2. In-App Notifications System (نظام الإشعارات الحية)
* **Welcome Notification:** Broadcasted on login. Displays welcome alerts.
* **Low Stock Alert:** WebSocket push \`INVENTORY_ALERT\`. Triggers when \`quantity <= min_level\`. Visible to doctors and managers.
* **Summon Alert:** WebSocket push \`SUMMON_RECEPTIONIST\` when doctor calls next patient. Vibrates/alerts receptionist.
* **Payroll Alert:** Notifies admin when employee salary is due.

---
## RAG Optimization Details
* **Tags:** #Search #Filters #Notifications #WebSockets #RealtimeAlerts
* **Linked files:** [03_user_workflows.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/03_user_workflows.md)
