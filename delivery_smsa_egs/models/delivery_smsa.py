# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import time
from markupsafe import Markup
from zeep import Client

from odoo import api, models, fields, _
from odoo.exceptions import UserError

SMSAWSDLURL = "http://track.smsaexpress.com/SECOM/SMSAwebServiceIntl.asmx?wsdl"


class ProviderSMSAExpress(models.Model):
    _inherit = "delivery.carrier"

    @api.onchange("delivery_type")
    def onchange_delivery_type(self):
        if self.delivery_type == "smsa" and not self.product_id:
            self.product_id = self.env.ref(
                "delivery_smsa_egs.product_product_delivery_smsa"
            ).id

    delivery_type = fields.Selection(
        selection_add=[("smsa", "SMSA Express")],
        ondelete={
            "smsa": lambda recs: recs.write(
                {"delivery_type": "fixed", "fixed_price": 0}
            )
        },
    )
    smsa_passkey = fields.Char(string="SMSA Passkey")
    smsa_shipment_rate = fields.Float(string="Shipment Rate")
    smsa_shipment_type = fields.Selection(
        [("DLV", "DLV"), ("VAL", "VAL"), ("BLT", "BLT")],
        string="Shipment Type",
        default="DLV",
    )

    def smsa_rate_shipment(self, order):
        return {
            "success": True,
            "price": self.smsa_shipment_rate,
            "error_message": False,
            "warning_message": False,
        }

    def smsa_send_shipping(self, pickings):
        shipres = []
        for picking in pickings:
            partner = picking.partner_id
            shipment_data = {
                "passKey": self.smsa_passkey,
                "refNo": "{}_{}".format(picking.name, str(time.time()).split(".")[0]),
                "sentDate": picking.scheduled_date,
                "idNo": "",
                "cName": partner.name or "",
                "cntry": partner.country_id and partner.country_id.name or "",
                "cCity": partner.city or "",
                "cZip": partner.zip or "",
                "cPOBox": "",
                "cMobile": partner.phone or "",
                "cTel1": "",
                "cTel2": "",
                "cAddr1": partner.street or "",
                "cAddr2": partner.street2 or "",
                "shipType": self.smsa_shipment_type,
                "PCs": int(sum(picking.move_line_ids.mapped("quantity"))),
                "cEmail": partner.email or "",
                "carrValue": 0,
                "carrCurr": picking.sale_id.pricelist_id.currency_id.name,
                "codAmt": 0,
                "weight": picking.shipping_weight,
                "custVal": 0,
                "custCurr": picking.sale_id.pricelist_id.currency_id.name,
                "insrAmt": 0,
                "insrCurr": picking.sale_id.pricelist_id.currency_id.name,
                "itemDesc": ", ".join(
                    picking.move_line_ids.mapped("product_id.display_name")
                ),
                "vatValue": 0,
                "harmCode": "",
            }
            try:
                client = Client(SMSAWSDLURL)
                res = client.service.addShipment(**shipment_data)
                if res.__contains__("Failed"):
                    raise UserError(_(res))
                carrier_tracking_ref = res
                picking.write({"carrier_tracking_ref": carrier_tracking_ref})
                logmessage = (
                    _("Shipment created into SMSA ")
                    + Markup("<br/> <b>")
                    + _("Tracking Number : ")
                    + Markup("</b> ")
                    + _("%s") % (carrier_tracking_ref)
                )
                picking.message_post(
                    body=logmessage,
                    attachments=[
                        (
                            "LabelSMSA-%s.pdf" % (carrier_tracking_ref),
                            self.smsa_get_label(picking, get_label_binary=True),
                        )
                    ],
                )
                shipping_data = {
                    "tracking_number": carrier_tracking_ref,
                    "exact_price": self.smsa_shipment_rate,
                }
                shipres = shipres + [shipping_data]
            except Exception as e:
                raise UserError(_(e))
        return shipres

    def smsa_get_label(self, picking, get_label_binary=False):
        client = Client(SMSAWSDLURL)
        carrier_tracking_ref = picking.carrier_tracking_ref
        res = client.service.getPDF(carrier_tracking_ref, self.smsa_passkey)
        if res:
            if get_label_binary:
                return res
            else:
                self.env["ir.attachment"].create(
                    {
                        "name": carrier_tracking_ref + ".pdf",
                        "datas_fname": carrier_tracking_ref + ".pdf",
                        "type": "binary",
                        "datas": base64.encodebytes(res),
                        "res_model": "stock.picking",
                        "res_id": picking.id,
                    }
                )
        else:
            return None

    def smsa_get_tracking_link(self, picking):
        return (
            "http://www.smsaexpress.com/trackingdetails?tracknumbers=%s"
            % picking.carrier_tracking_ref
        )

    def smsa_cancel_shipment(self, picking):
        if not picking.cancel_reason:
            raise UserError(_("Please enter Cancel Reason."))
        try:
            client = Client(SMSAWSDLURL)
            client.service.cancelShipment(
                **{
                    "awbNo": picking.carrier_tracking_ref,
                    "passkey": self.smsa_passkey,
                    "reas": picking.cancel_reason,
                }
            )
        except Exception as e:
            raise UserError(_(e))
