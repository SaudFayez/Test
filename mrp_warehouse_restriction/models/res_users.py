# -*- coding: utf-8 -*-
from odoo import fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    manufacturing_warehouse_id = fields.Many2one(
        'stock.warehouse',
        string='Manufacturing Warehouse',
        help="Warehouse this user is allowed to create Manufacturing Orders for. "
             "When set, the user's Manufacturing Orders default to this warehouse "
             "and cannot be created for any other warehouse. "
             "Manufacturing Administrators are not restricted.",
    )
