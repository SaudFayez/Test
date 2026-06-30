# Manufacturing Warehouse Restriction (Odoo 19)

Restrict employees to creating Manufacturing Orders for **their own warehouse only**,
preventing inventory from being corrupted by components/finished goods being moved in
the wrong warehouse.

## What it does

- Adds a **Manufacturing Warehouse** field on each user (`res.users`).
- For a user who has a warehouse assigned **and** is *not* a Manufacturing
  Administrator:
  - New Manufacturing Orders default to that warehouse's manufacturing Operation Type.
  - The **Operation Type** field is read-only, so the warehouse cannot be changed.
  - A record rule (`ir.rule`) enforces the restriction server-side, so it also applies
    to imports and RPC/API calls — not just the form.
- **Manufacturing Administrators** (`mrp.group_mrp_manager`) are exempt and may create
  Manufacturing Orders for any warehouse.

## How it works

| Layer | File | Purpose |
|-------|------|---------|
| Field | `models/res_users.py` | `manufacturing_warehouse_id` on the user |
| Default + lock | `models/mrp_production.py` | Override `_compute_picking_type_id` to force the user's warehouse; `restrict_warehouse` toggles read-only; `@api.constrains` gives a friendly error |
| Enforcement | `security/mrp_warehouse_security.xml` | Record rules: restricted users see only their warehouse's MOs; managers bypass |
| UI | `views/*.xml` | Field on the user form; read-only Operation Type on the MO form |

The MO warehouse is derived from `picking_type_id` (Operation Type); the warehouse's
manufacturing Operation Type is `stock.warehouse.manu_type_id`.

## Setup

1. Install the module (depends on `mrp` and `stock`).
2. Open **Settings → Users**, edit a user, and set their **Manufacturing Warehouse**.
3. Give the user the **Manufacturing / User** access right (not Administrator).

> Note: a restricted Manufacturing user with **no** warehouse assigned will be limited
> to Manufacturing Orders that have no warehouse. Always assign a warehouse to every
> restricted user.

## Testing

See the verification steps in the project plan: assign two warehouses to two users,
confirm the Operation Type auto-fills and locks for a restricted user, confirm a manager
can still pick any warehouse, and confirm RPC/import attempts to use another warehouse
are blocked.
