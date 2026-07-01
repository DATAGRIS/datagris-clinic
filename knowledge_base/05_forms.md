# Module 05: Forms

## 1. Patient Registration Form (نموذج إضافة مريض جديد)
* **Fields:**
  * **Name (اسم المريض):** Text, Required. No numeric validation.
  * **Mobile Number (رقم الهاتف):** Numeric text. Mandatory (can be left blank to trigger automatic unique local ID sequence if setting allows).
  * **Country Code (الكود الدولي):** Dropdown select, Default: +20.
  * **Gender (الجنس):** Option select (Male/Female).
  * **Age (السن):** Numeric integer.
* **Success Action:** Closes slide, updates patients table list.
* **Fail Action:** Shows red input border validation errors.

## 2. Subscription Checkout Form (نموذج دفع الاشتراك)
* **Fields:**
  * **Clinic Name (اسم العيادة):** Text, Required.
  * **Doctor Name (اسم الطبيب):** Text, Required.
  * **Owner Username (اسم المستخدم):** Text, Required.
  * **Password (كلمة المرور):** Password field, Required (Min 6 chars).
  * **Phone (رقم الواتساب):** Tel input, prefix bound to selected country dropdown.
* **Success Action:** Renders check success modal, routes to payment gateways or EMR dashboard.
* **Fail Action:** Refreshes page, shows validation banner.

---
## RAG Optimization Details
* **Tags:** #Forms #Validation #Inputs #CheckoutForm #PatientRegistration
* **Linked files:** [06_business_rules.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/06_business_rules.md)
