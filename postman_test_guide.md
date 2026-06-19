# Postman API Testing Guide

This guide describes how to verify the multi-tenant Authentication, Companies, Users, Categories, Documents, Standard Documents, Individuals, and Reminders endpoints using Postman.

---

## 1. Postman Setup

Set up a Postman Environment with the following variables:
- `baseUrl`: `http://localhost:8000/api/v1` (Note: Backend runs on port 8000 by default)
- `accessToken`: (Leave blank; copy-paste here after login)
- `refreshToken`: (Leave blank; copy-paste here after login)
- `superAdminToken`: (Leave blank)
- `companyAdminToken`: (Leave blank)
- `appUserToken`: (Leave blank)
- `companyId`: (Leave blank)
- `userId`: (Leave blank)
- `categoryId`: (Leave blank)
- `documentId`: (Leave blank)
- `standardDocumentId`: (Leave blank)
- `individualId`: (Leave blank)
- `reminderId`: (Leave blank)

For all authenticated requests, select **Authorization -> Type: Bearer Token** and set the Token to the variable name (e.g., `{{accessToken}}` or `{{superAdminToken}}`).

---

## 2. Authentication Flow

### A. Login as Super Admin
- **Method & Path**: `POST {{baseUrl}}/auth/login`
- **Body** (JSON):
  ```json
  {
    "email": "superadmin@scannel.com",
    "password": "password123"
  }
  ```
- **Action**: Copy `data.accessToken` from the response and save it as your `superAdminToken` environment variable.

### B. Register first Company & Admin (using Super Admin token)
- **Method & Path**: `POST {{baseUrl}}/auth/register`
- **Headers**: `Authorization: Bearer {{superAdminToken}}`
- **Body** (JSON):
  ```json
  {
    "email": "admin@company-b.com",
    "password": "password123",
    "firstName": "Acme",
    "lastName": "Admin",
    "role": "COMPANY_ADMIN",
    "userCode": "ADM-002",
    "companyName": "Company B"
  }
  ```
- **Action**: Save the returned `data.companyId` as `companyId` and `data.id` as `userId`.

### C. Login as the newly created Company Admin
- **Method & Path**: `POST {{baseUrl}}/auth/login`
- **Body** (JSON):
  ```json
  {
    "email": "admin@company-b.com",
    "password": "password123"
  }
  ```
- **Action**: Copy the returned `accessToken` and save it as `companyAdminToken`. Copy the returned `refreshToken` and save it as `refreshToken`.

### D. Register a Company User (using Company Admin token)
- **Method & Path**: `POST {{baseUrl}}/auth/register`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Body** (JSON):
  ```json
  {
    "email": "user@company-b.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "COMPANY_USER",
    "userCode": "USR-002"
  }
  ```

### E. Refresh Tokens
- **Method & Path**: `POST {{baseUrl}}/auth/refresh`
- **Headers**: `Authorization: Bearer {{refreshToken}}` (Use the Refresh Token as the Bearer Token here)
- **Action**: Verify a rotated pair of `accessToken` and `refreshToken` is issued. Save the new `accessToken` as `companyAdminToken` and the new `refreshToken` as `refreshToken`.

### F. Logout
- **Method & Path**: `POST {{baseUrl}}/auth/logout`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Body** (JSON):
  ```json
  {
    "refreshToken": "{{refreshToken}}"
  }
  ```
- **Action**: Send the request. Verify subsequent `POST {{baseUrl}}/auth/refresh` requests with the revoked refresh token get a `401 Unauthorized` error.

---

## 3. Tenant Boundary Penetration Tests (Verify 404s)

### Test A: Super Admin accesses Company B
- **Method & Path**: `GET {{baseUrl}}/companies/{{companyId}}`
- **Headers**: `Authorization: Bearer {{superAdminToken}}`
- **Expectation**: `200 OK` (Super Admin bypasses all scoping).

### Test B: Cross-Tenant Breach (Access Company B details from Company A Admin)
- **Method & Path**: `GET {{baseUrl}}/companies/{{companyId}}` (Where `companyId` is Company B's ID)
- **Headers**: `Authorization: Bearer <Company A Admin Token>` (You can login as `admin@company-a.com` / `password123` to get this token)
- **Expectation**: `404 Not Found` (Returns 404 instead of 403 to prevent ID enumeration).

### Test C: Cross-Tenant User Retrieval
- **Method & Path**: `GET {{baseUrl}}/users/{{userId}}` (Where `userId` belongs to a Company B user)
- **Headers**: `Authorization: Bearer <Company A Admin Token>`
- **Expectation**: `404 Not Found`.

---

## 4. Users soft-archive, restore & deletion

### A. List Scoped Users
- **Method & Path**: `GET {{baseUrl}}/users?page=1&limit=5`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: Returns only users belonging to Company B. Super Admin doing this will see all users.

### B. Attempt Permanent Deletion on Active User (Expected to Fail)
- **Method & Path**: `DELETE {{baseUrl}}/users/{{userId}}/permanent` (Where user is active/not archived)
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: `400 Bad Request` with message `"User must be archived first before permanent deletion"`.

### C. Soft-Archive the User
- **Method & Path**: `PATCH {{baseUrl}}/users/{{userId}}/archive`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: `200 OK` with `archivedAt` populated with a date string.

### D. Restore the User
- **Method & Path**: `PATCH {{baseUrl}}/users/{{userId}}/restore`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: `200 OK` with `archivedAt` set back to `null`.

### E. Permanent Delete (Archive → Delete Flow)
- **Action**: Repeat Step C to archive the user.
- **Method & Path**: `DELETE {{baseUrl}}/users/{{userId}}/permanent`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: `204 No Content` (User is permanently deleted from the database).

---

## 5. Password Reset & Welcoming Invitation Flow

### A. Forgot Password
- **Method & Path**: `POST {{baseUrl}}/auth/forgot-password`
- **Body** (JSON):
  ```json
  {
    "email": "superadmin@scannel.com"
  }
  ```
- **Expectation**: `200 OK` (If user exists, a password reset link/token will print in NestJS console).

### B. Reset Password
- **Method & Path**: `POST {{baseUrl}}/auth/reset-password`
- **Body** (JSON):
  ```json
  {
    "token": "TOKEN_FROM_CONSOLE_LOG",
    "newPassword": "newpassword123"
  }
  ```
- **Expectation**: `200 OK`. (Invalidates all active refresh tokens for the user).

### C. Trigger Welcome Invitation Email
- **Method & Path**: `POST {{baseUrl}}/users/{{userId}}/send-welcome-email`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: `200 OK` (An invitation token is generated and printed to the NestJS console).

### D. Accept Invitation & Set Password
- **Method & Path**: `POST {{baseUrl}}/auth/accept-invitation`
- **Body** (JSON):
  ```json
  {
    "token": "TOKEN_FROM_CONSOLE_LOG",
    "password": "myfirstpassword123"
  }
  ```
- **Expectation**: `200 OK`. (Sets password hash, marks token as used, and ensures the user is active).

---

## 6. Admin Impersonation Flow

### A. Start Impersonation (Super Admin only)
- **Method & Path**: `POST {{baseUrl}}/admin/users/{{userId}}/impersonate` (Where `userId` is a target user)
- **Headers**: `Authorization: Bearer {{superAdminToken}}`
- **Expectation**: `200 OK` returning `{ "accessToken": "SHORT_LIVED_TOKEN" }`.
- **Action**: Copy the returned `accessToken` and use it as Bearer Token for subsequent tenant calls (e.g. `GET {{baseUrl}}/users` will only return the target company's users). Note: No `refreshToken` is issued.

### B. Stop Impersonation
- **Method & Path**: `POST {{baseUrl}}/admin/impersonate/stop`
- **Headers**: `Authorization: Bearer <Impersonation Token>` (Use the short-lived impersonation token you got in step A)
- **Expectation**: `200 OK`. (Updates `endedAt` on the active `ImpersonationLog`).
- **Action**: Discard the impersonation token and restore your `superAdminToken` for subsequent admin requests.

---

## 7. Categories Management

Categories define specific areas in the safety register. Under the new model, categories can only belong to either `COMPANY_DOCUMENTS` or `RISK_ASSESSMENT` sections.

### A. Create Category (Option A: Assign to all users)
- **Method & Path**: `POST {{baseUrl}}/categories`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}` (Company Admin scopes it to their company, Super Admin scopes it globally)
- **Body** (JSON):
  ```json
  {
    "name": "Electrical Safety Guidelines",
    "section": "COMPANY_DOCUMENTS",
    "assignToAll": true
  }
  ```
- **Action**: Copy the returned `data.id` and save it as your `categoryId` environment variable.

### B. Create Category (Option B: Assign to specific users)
- **Method & Path**: `POST {{baseUrl}}/categories`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}` (Users must belong to caller's company)
- **Body** (JSON):
  ```json
  {
    "name": "Special Risk Checklist",
    "section": "RISK_ASSESSMENT",
    "assignToAll": false,
    "userIds": ["{{userId}}"]
  }
  ```

### C. List Categories (With Scoping)
- **Method & Path**: `GET {{baseUrl}}/categories?section=COMPANY_DOCUMENTS&userId={{userId}}`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**:
  - Regular Users (`COMPANY_USER`, `APP_USER`) only see categories they are assigned to (where `assignToAll` is true or they are in `userIds`).
  - Company Admins see all categories in their company plus global categories.
  - Super Admins see all categories.

### D. Update Category
- **Method & Path**: `PATCH {{baseUrl}}/categories/{{categoryId}}`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Body** (JSON):
  ```json
  {
    "name": "Updated Electrical Safety Guidelines",
    "assignToAll": false,
    "userIds": ["{{userId}}"]
  }
  ```

### E. Archive and Restore Category
- **Soft-Archive**: `PATCH {{baseUrl}}/categories/{{categoryId}}/archive` (returns category with `archivedAt` populated).
- **Restore**: `PATCH {{baseUrl}}/categories/{{categoryId}}/restore` (sets `archivedAt` back to `null`).
- **Access Rule**: Regular users cannot archive/restore. Company Admins can only archive/restore their own company categories. Only Super Admins can archive/restore global categories.

### F. Permanent Delete Category
- **Pre-requisite**: Must be archived first.
- **Method & Path**: `DELETE {{baseUrl}}/categories/{{categoryId}}/permanent`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: `204 No Content` (junction assignments are automatically deleted due to Cascade constraints).
- **Access Rule**: Only Super Admins can permanently delete global categories.

---

## 8. Documents Upload, Scoping & Physical Cleanup

The Documents module serves uploaded files. It uses a storage service to serve files statically via `http://localhost:8000/uploads/<filename>`.

### A. Upload Document (Multipart Form-Data)
- **Method & Path**: `POST {{baseUrl}}/documents`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}` (or `superAdminToken`)
- **Body**: Select **form-data** mode in Postman and input the following keys:
  - `file`: (Change key type from Text to **File** and upload any PDF/Image/Txt file)
  - `section`: `SAFETY_STATEMENT`
  - `title`: `Company Safety Policy 2026` (Optional; defaults to the uploaded file name)
  - `description`: `Core company health & safety guidelines.` (Optional)
  - `categoryId`: `{{categoryId}}` (Optional; use the ID generated in step 7A)
  - `companyId`: `{{companyId}}` (Optional; **Required only if using `superAdminToken`** to specify target tenant)
- **Action**: Copy the returned `data.id` and save it as `documentId`. Copy the `fileUrl` (e.g. `/uploads/xxxx.pdf`).
- **File Server Verification**: Open `http://localhost:8000{{fileUrl}}` in your web browser. The uploaded file should render correctly.

### B. List and Access Documents
- **Method & Path**: `GET {{baseUrl}}/documents?section=SAFETY_STATEMENT` (Or filter by query params `companyId`, `categoryId`, `userId`, `archived`)
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: 
  - The list returns documents matching the caller's company.
  - Non-admin roles (`COMPANY_USER`, `APP_USER`) only see documents assigned to them, assigned to their category, or company-wide general documents.
  - Super Admin can optionally pass `companyId` to filter documents of a specific company.

### C. Replace File / Update Metadata
- **Method & Path**: `PATCH {{baseUrl}}/documents/{{documentId}}`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Body** (form-data):
  - `file`: (Optional; upload a new file to replace the old one)
  - `title`: `Updated Safety Policy Title` (Optional)
  - `description`: `Updated policy details.` (Optional)
  - `categoryId`: `{{categoryId}}` (Optional)
  - `isReviewed`: `true` (Optional; updates reviewed state)
- **Expectation**: 
  - If a file is uploaded, the backend deletes the old physical file in the `uploads/` folder and updates the record with the new file.
  - Metadata is updated. If `isReviewed` is set to `true`, `reviewedAt` is populated with the current timestamp.

### D. Soft-Archive Document
- **Method & Path**: `PATCH {{baseUrl}}/documents/{{documentId}}/archive`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`

### E. Permanent Delete (Physical File Cleanup Verification)
- **Pre-requisite**: Document must be archived first.
- **Method & Path**: `DELETE {{baseUrl}}/documents/{{documentId}}/permanent`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: `204 No Content`.
- **Physical Verification**: Check the `backend/uploads/` directory on disk. Verify that the file matching `fileUrl` is completely removed.

---

## 9. Standard Documents (Global Templates)

Standard Documents are public templates managed by `SUPER_ADMIN`s. All tenants have read access, but only `SUPER_ADMIN`s can create, update, archive, or delete them.

### A. Attempt Template Upload by Company Admin (Expected to Fail)
- **Method & Path**: `POST {{baseUrl}}/standard-documents`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Body** (form-data):
  - `file`: (Upload a file)
  - `title`: `Safety Checklist Template`
  - `section`: `SAFETY_STATEMENT`
- **Expectation**: `403 Forbidden` (Only Super Admins can write global templates).

### B. Create Template by Super Admin
- **Method & Path**: `POST {{baseUrl}}/standard-documents`
- **Headers**: `Authorization: Bearer {{superAdminToken}}`
- **Body** (form-data):
  - `file`: (Upload a file)
  - `title`: `Global Safety Checklist Template`
  - `section`: `SAFETY_STATEMENT`
  - `description`: `General statement blueprint`
- **Action**: Save the returned `data.id` as `standardDocumentId`.

### C. List Templates (Any Role)
- **Method & Path**: `GET {{baseUrl}}/standard-documents`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}` (Verify a Company Admin/User can read this global data)
- **Expectation**: `200 OK` listing the template created by the Super Admin.

---

## 10. Individuals (Dependents/Sub-Records)

Individuals represent sub-records (e.g. training candidates/dependents) associated with a User.

### A. Create Individual
- **Method & Path**: `POST {{baseUrl}}/individuals`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Body** (JSON):
  ```json
  {
    "userId": "{{userId}}",
    "firstName": "Jane",
    "lastName": "Smith"
  }
  ```
- **Action**: Save the returned `data.id` as `individualId`.

### B. List Individuals
- **Method & Path**: `GET {{baseUrl}}/individuals`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: Returns list scoped strictly to the company.

---

## 11. Reminders (Date-Based Alerts)

Reminders track alerts for individual users or dependents.

### A. Create Reminder
- **Method & Path**: `POST {{baseUrl}}/reminders`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Body** (JSON):
  ```json
  {
    "userId": "{{userId}}",
    "individualId": "{{individualId}}",
    "title": "Medical Check Refresher",
    "description": "Bi-annual review",
    "dueDate": "2026-12-01T09:00:00.000Z"
  }
  ```
- **Action**: Save the returned `data.id` as `reminderId`.

### B. Complete Reminder
- **Method & Path**: `PATCH {{baseUrl}}/reminders/{{reminderId}}/complete`
- **Headers**: `Authorization: Bearer {{companyAdminToken}}`
- **Expectation**: `200 OK` with `completedAt` populated with the current date.

### C. Tenant Leak Verification
- Log in as a Company A Admin, and attempt to fetch, complete, or delete Company B's `reminderId`.
- **Expectation**: The server must return `404 Not Found` (anti-enumeration behavior) rather than letting you inspect or update another company's reminders.
