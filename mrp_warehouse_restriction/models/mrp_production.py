# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import ValidationError


class MrpProduction(models.Model):
    _inherit = 'mrp.production'

    restrict_warehouse = fields.Boolean(
        string='Warehouse Restricted',
        compute='_compute_restrict_warehouse',
        help="Technical field: True when the current user is locked to a single "
             "Manufacturing warehouse. Used to make the Operation Type read-only.",
    )

    @api.depends_context('uid')
    def _compute_restrict_warehouse(self):
        restricted = self._mrp_warehouse_restricted_user()
        for production in self:
            production.restrict_warehouse = bool(restricted)

    def _mrp_warehouse_restricted_user(self):
        """Return the user's warehouse when they are restricted, else an empty
        recordset. Managers and users without an assigned warehouse are never
        restricted."""
        user = self.env.user
        warehouse = user.manufacturing_warehouse_id
        if warehouse and not user.has_group('mrp.group_mrp_manager'):
            return warehouse
        return self.env['stock.warehouse']

    @api.depends('company_id', 'bom_id')
    @api.depends_context('uid')
    def _compute_picking_type_id(self):
        # Let core resolve the default first, then force the restricted user's
        # warehouse so the Operation Type (and therefore the warehouse) always
        # matches the user's assigned warehouse - including the new-MO default,
        # which is produced by this precompute.
        super()._compute_picking_type_id()
        warehouse = self._mrp_warehouse_restricted_user()
        if not warehouse or not warehouse.manu_type_id:
            return
        for production in self:
            if (
                production.company_id == warehouse.manu_type_id.company_id
                and production.picking_type_id.warehouse_id != warehouse
            ):
                production.picking_type_id = warehouse.manu_type_id

    @api.constrains('picking_type_id')
    def _check_manufacturing_warehouse(self):
        for production in self:
            warehouse = production._mrp_warehouse_restricted_user()
            if not warehouse:
                continue
            if production.warehouse_id and production.warehouse_id != warehouse:
                raise ValidationError(self.env._(
                    "You can only create Manufacturing Orders for your assigned "
                    "warehouse \"%(allowed)s\". This order targets \"%(actual)s\".",
                    allowed=warehouse.display_name,
                    actual=production.warehouse_id.display_name,
                ))
