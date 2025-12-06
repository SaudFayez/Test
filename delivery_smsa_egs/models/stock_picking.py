# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class StockPicking(models.Model):
    _inherit = 'stock.picking'

    cancel_reason = fields.Char()
