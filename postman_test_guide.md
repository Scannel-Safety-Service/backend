# Postman API Testing Guide

This guide describes how to verify the multi-tenant Authentication, Companies, and Users endpoints using Postman.

---

## 1. Postman Setup

Set up a Postman Environment with the following variables:
- `baseUrl`: `http://localhost:3000/api/v1`
- `accessToken`: (Leave blank; copy-paste here after login)
- `refreshToken`: (Leave blank; copy-paste here after login)
- `superAdminToken`: (Leave blank)
- `companyAdminToken`: (Leave blank)
- `appUserToken`: (Leave blank)
- `companyId`: (Leave blank)
- `userId`: (Leave blank)

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
