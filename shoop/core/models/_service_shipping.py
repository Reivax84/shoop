# -*- coding: utf-8 -*-
# This file is part of Shoop.
#
# Copyright (c) 2012-2016, Shoop Ltd. All rights reserved.
#
# This source code is licensed under the AGPLv3 license found in the
# LICENSE file in the root directory of this source tree.
from __future__ import unicode_literals, with_statement

from django.db import models
from django.utils.translation import ugettext_lazy as _
from parler.models import TranslatedFields

from shoop.utils.dates import DurationRange

from ._order_lines import OrderLineType
from ._service_base import Service, ServiceProvider


class ShippingMethod(Service):
    carrier = models.ForeignKey(
        "Carrier", null=True, blank=True, on_delete=models.SET_NULL,
        verbose_name=_("carrier"))

    translations = TranslatedFields(
        name=models.CharField(max_length=100, verbose_name=_("name")),
    )

    line_type = OrderLineType.SHIPPING
    shop_product_m2m = "shipping_methods"
    provider_attr = 'carrier'

    class Meta:
        verbose_name = _("shipping method")
        verbose_name_plural = _("shipping methods")

    def get_shipping_time(self, source):
        """
        Get shipping time for items in given source.

        :rtype: shoop.utils.dates.DurationRange|None
        """
        min_time, max_time = None
        for component in self.behavior_components.all():
            delivery_time = component.get_delivery_time(self, source)
            if delivery_time:
                assert isinstance(delivery_time, DurationRange)
                if not max_time and max_time < delivery_time.max_duration:
                    max_time = delivery_time.max_duration
                    min_time = delivery_time.min_duration
        if not max_time:
            return None
        return DurationRange(min_time, max_time)


class Carrier(ServiceProvider):
    def _create_service(self, choice_identifier, **kwargs):
        return ShippingMethod.objects.create(
            carrier=self, choice_identifier=choice_identifier, **kwargs)


class CustomCarrier(Carrier):
    class Meta:
        verbose_name = _("custom carrier")
        verbose_name_plural = _("custom carriers")

    def get_service_choices(self):
        return [self.service_choice('custom', _("Custom shipping"))]