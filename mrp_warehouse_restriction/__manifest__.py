# -*- coding: utf-8 -*-
{
    'name': 'Manufacturing Warehouse Restriction',
    'version': '19.0.1.0.0',
    'summary': 'Restrict employees to creating Manufacturing Orders for their own warehouse',
    'description': """
Manufacturing Warehouse Restriction
====================================

Assigns each user a single Manufacturing warehouse. When a restricted user
creates a Manufacturing Order:

* the Operation Type (and therefore the warehouse) defaults to their warehouse;
* the Operation Type field is locked so it cannot be switched to another warehouse;
* a record rule enforces the restriction server-side (RPC/import safe).

Manufacturing Administrators are exempt and may still choose any warehouse.

This prevents employees from accidentally consuming components and receiving
finished goods in the wrong warehouse, which would corrupt on-hand inventory.
""",
    'category': 'Manufacturing',
    'license': 'LGPL-3',
    'depends': ['mrp', 'stock'],
    'data': [
        'security/mrp_warehouse_security.xml',
        'views/res_users_views.xml',
        'views/mrp_production_views.xml',
    ],
    'installable': True,
    'application': False,
}
