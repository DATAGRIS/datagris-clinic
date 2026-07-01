# Module 08: Reports & Dashboards

## 1. EMR Analytics Dashboard (لوحة التقارير والتحليلات)
* **Widgets & Indicators:**
  * **Gross Revenue (إجمالي الإيرادات):** Net calculation: \`SUM(paid_amount) - SUM(refund_amount)\`.
  * **Net Profit (صافي الأرباح):** Revenue minus monthly payment expenses.
  * **Waiting Time Analytics (زمن الانتظار):** Calculates average, minimum, and maximum waiting times in the queue.
  * **Top Services (الخدمات الأكثر طلباً):** Aggregates count of services rendered.

## 2. Shift Treasury Stats Dashboard (إحصائيات الخزينة اليومية)
* **Widgets & Indicators:**
  * **Opening Balance (الرصيد الافتتاحي):** Input by cashier on shift start.
  * **Live Balance (الرصيد الفعلي الحالي):** Formula: \`opening_balance + income - expense - refund + adjustment\`.
  * **Expected Closing Cash:** Computed automatically by database.

## 3. Printable Reports (التقارير المطبوعة)
* **Employees Registry:** Listing active roles, pay cycles, and basic base salary rates.
* **Visits Timeline Summary:** Grouping revenue patterns monthly over the last year.

---
## RAG Optimization Details
* **Tags:** #Reports #Dashboards #RevenueStats #NetProfit #TreasuryLedger
* **Linked files:** [06_business_rules.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/06_business_rules.md), [11_api_database.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/11_api_database.md)
