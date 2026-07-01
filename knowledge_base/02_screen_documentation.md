# Module 02: Screen Documentation

## 1. Login Screen (شاشة تسجيل الدخول)
* **Grounded Location:** Desktop Electron window launcher.
* **Access:** Anonymous visitors / all registered employees.
* **Features & Fields:** Username, Password inputs. Toggles for "New Clinic Registration" and "Activate License".
* **Loading/Empty States:** Disable form submit button on loading. Displays red banner alert on authentication errors.

## 2. Receptionist Dashboard (لوحة الاستقبال)
* **Grounded Location:** Sidebar -> Receptionist link.
* **Access:** Owner, Receptionist, Manager.
* **UI Elements:**
  * **Waiting Queue Table:** Columns: Patient Name, File Number, Status, Waiting Time, Visit Type (Consultation/Followup), Action.
  * **Register Patient Slide:** Name, Gender, Phone, Country Code Select, Companion Switch.
  * **Checkout Sidebar:** Service selector, paid amount numeric input, outstanding balance card.

## 3. Doctor Consultation Portal (لوحة الطبيب)
* **Grounded Location:** Sidebar -> Clinic EMR.
* **Access:** Owner, Doctor.
* **UI Elements:**
  * **Active Patient Card:** Details name, age, weight, temp, chief complaint.
  * **Prescription Creator:** Searchable drug database drop list, dosage multiplier inputs, follow-up calendar.
  * **Layout Setup Card:** Set margins, font size adjustment scale, toggle A4/A5 PDF print modes.

## 4. Admin Settings Panel (لوحة الإعدادات)
* **Grounded Location:** Sidebar -> settings controller.
* **Access:** Owner.
* **UI Elements:**
  * **Logo Upload Zone:** Base64 or URL logo registration.
  * **Services Grid:** Manage price configurations and active statuses.
  * **Settings variables list:** Clinic phone, address, print layout guidelines.

---
## RAG Optimization Details
* **Tags:** #Screens #UI #Dashboards #DoctorPanel #Reception
* **Linked files:** [03_user_workflows.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/03_user_workflows.md), [05_forms.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/05_forms.md)
