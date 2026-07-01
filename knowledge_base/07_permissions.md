# Module 07: Permissions

## 1. Access Matrix Table (جدول الصلاحيات للأدوار)

| Role | View Clinical EMR | View Financials / Treasury | Edit Settings | Modify Payroll / Employees |
| :--- | :---: | :---: | :---: | :---: |
| **owner / doctor** | Yes | Yes | Yes | Yes |
| **manager** | No | Yes | Yes | Yes |
| **accountant** | No | Yes | No | Yes |
| **receptionist** | No | Shift Cashier Only | No | No |

## 2. Details of Roles (تفاصيل الأدوار)
* **owner:** The clinic creator. Full access to DB, setup logs, direct queries.
* **doctor:** Focused on consultation room workflows. View medical history, update diagnostics, write prescriptions, print sheets.
* **receptionist:** Focused on waiting queue. Add patient, summon checks, accept checkout fees, log daily cashier balance.
* **accountant:** Financial auditing. View stats, register treasury adjustments, process employee payroll checks.

---
## RAG Optimization Details
* **Tags:** #Permissions #SecurityRoles #RBAC #AccessControl
* **Linked files:** [02_screen_documentation.md](file:///d:/AHMED/Managments%20Projects%20-%20%D9%86%D8%B8%D9%85%20%D8%A7%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%85%D8%B4%D8%A7%D8%B1%D9%8A%D8%B9/Clinic%20manager%20-%20%D9%85%D8%AF%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B9%D9%8A%D8%A7%D8%AF%D8%A9%202/knowledge_base/02_screen_documentation.md)
