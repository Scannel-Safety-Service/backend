# Category Module Refactor – Strict Scope Change

## Important Instructions

Before making any code changes, fully analyze the existing implementation and dependencies.

This is a targeted enhancement to the Category module only.

### Do NOT Modify

* Authentication
* Authorization system
* User module
* Company module
* Document module (except where category relationships must be updated)
* Reminder module
* Individual module
* Token systems
* Existing role definitions
* Existing API contracts unrelated to categories
* Existing business logic unrelated to categories

The objective is to change only how Categories are assigned to users.

---

# Current Situation

The current Category model supports:

```prisma
userId String?
user User?
```

This means a category can only belong to a single user.

This no longer satisfies the business requirements.

---

# New Business Requirements

## Super Admin

Super Admin can:

* Create Category
* Edit Category
* Delete Category

When creating a category:

1. Select Section

   * COMPANY_DOCUMENTS
   * RISK_ASSESSMENT

2. Enter Category Name

3. Choose Assignment Type

   Option A:

   * Assign to all users

   Option B:

   * Assign to one or more specific users

Super Admin categories are global categories.

---

## Company Admin

Company Admin can:

* Create Category
* Edit Category
* Delete Category

Restrictions:

* Can only manage categories within their own company.
* Can only assign categories to users belonging to their own company.

When creating a category:

1. Select Section

   * COMPANY_DOCUMENTS
   * RISK_ASSESSMENT

2. Enter Category Name

3. Choose Assignment Type

   Option A:

   * Assign to all users in their company

   Option B:

   * Assign to specific users in their company

---

# Database Changes

## Remove Single User Assignment

Remove the direct category-to-user relationship:

```prisma
userId String?
user User?
```

from Category.

---

## Add Many-to-Many Assignment Support

Create a junction table:

```prisma
model CategoryUser {
  id         String   @id @default(uuid())

  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])

  userId     String
  user       User     @relation(fields: [userId], references: [id])

  createdAt  DateTime @default(now())

  @@unique([categoryId, userId])
  @@index([categoryId])
  @@index([userId])
}
```

---

## Update Category

Add:

```prisma
assignToAll Boolean @default(false)
```

Add:

```prisma
createdById String
createdBy   User @relation(...)
```

Add:

```prisma
assignments CategoryUser[]
```

Keep all existing timestamps and archive functionality.

---

# Assignment Logic

## Assign To All

If:

```text
assignToAll = true
```

then category is available to all applicable users.

No CategoryUser records are required.

---

## Assign To Specific Users

If:

```text
assignToAll = false
```

then CategoryUser records determine access.

---

# Access Rules

## Super Admin Categories

Can be assigned globally.

## Company Admin Categories

Must be restricted to:

* Their company only
* Their company's users only

Validation must prevent assignment to users from other companies.

---

# API Requirements

Update create and update category flows to support:

```json
{
  "name": "Electrical Safety",
  "section": "COMPANY_DOCUMENTS",
  "assignToAll": false,
  "userIds": [
    "user1",
    "user2"
  ]
}
```

and

```json
{
  "name": "Electrical Safety",
  "section": "COMPANY_DOCUMENTS",
  "assignToAll": true
}
```

---

# Migration Requirements

Create a safe migration strategy.

If existing categories currently contain a userId:

1. Create corresponding CategoryUser records.
2. Preserve all existing category assignments.
3. Do not lose production data.

---

# Deliverables

Provide:

1. Updated Prisma schema.
2. Required migration.
3. Service-layer changes.
4. DTO changes.
5. Controller changes.
6. Authorization validation.
7. Data migration strategy.
8. List of affected files before implementation.

Before modifying code, first present the impact analysis and implementation plan for approval.
