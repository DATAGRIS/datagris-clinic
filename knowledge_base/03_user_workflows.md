# Module 03: User Workflows

## 1. Patient Registration & Check-in (تسجيل مريض والدخول للعيادة)
* **Start:** Reception clicks "Register Patient".
* **Steps:**
  1. Input Name, Age, Gender.
  2. Select Country Prefix (e.g. Egypt +20, Saudi +966) and write Mobile Number.
  3. Toggle "Companion" if patient is accompanying another.
  4. Submit. System checks for duplicate \`(clinic_id, mobile_number)\`. If not present, creates record and pushes into queue.
* **End:** Patient appears as 'waiting' in the receptionist queue.

## 2. Doctor Diagnosis & Prescription (الكشف وكتابة الروشتة)
* **Start:** Doctor clicks "Call Patient" / "Summon".
* **Steps:**
  1. Patient is marked as 'in_consultation'.
  2. Doctor registers Chief Complaint and Vital Signs.
  3. Doctor searches and attaches drugs to the prescription sheet.
  4. Selects next followup date.
  5. Clicks "Save and Print". PDF format constraints are generated.
* **End:** Patient is marked 'completed' and routed to checkout.

## 3. Treasury Shift Closing (إغلاق الوردية المالية)
* **Start:** Reception / Accountant opens shift page.
* **Steps:**
  1. Select cashier name and active shift name (Morning, Night, Full-Time).
  2. Enter drawer opening balance.
  3. Process visits throughout the day.
  4. Click "Close Session". System calculates expected balance based on \`income - expense - refund\`.
  5. Input actual cash in drawer.
* **End:** Session status marked 'closed', discrepancy is computed and saved.

---
## RAG Optimization Details
* **Tags:** #Workflows #Dataflow #PatientCheckin #ClinicalQueue #ShiftClosing
* **Linked files:** [04_buttons_actions.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/04_buttons_actions.md), [06_business_rules.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/06_business_rules.md)
