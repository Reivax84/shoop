/**
 * This file is part of Shoop.
 *
 * Copyright (c) 2012-2016, Shoop Ltd. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {handleActions} from "redux-actions";
import _ from "lodash";

function newLine() {
    return {
        id: (+new Date() * 10000).toString(36),
        type: "product",
        product: null,
        sku: null,
        text: null,
        errors: null,
        quantity: 1,
        step: "",
        baseUnitPrice: 0,
        unitPrice: 0,
        unitPriceIncludesTax: false,
        discountPercent: 0,
        discountAmount: 0,
        total: 0
    };
}

function setLineProperties(linesState, lineId, props) {
    return _.map(linesState, (line) => {
        if (line.id === lineId) {
            return _.assign({}, line, props);
        }

        return line;
    });
}

function getDiscountsAndTotal(quantity, baseUnitPrice, unitPrice, updateUnitPrice=false) {
    const updates = {};

    if (updateUnitPrice) {
        updates.unitPrice = unitPrice;
    }
    var totalBeforeDiscount = baseUnitPrice * quantity;
    var total = +(unitPrice * quantity).toFixed(2);
    updates.total = total;

    if (baseUnitPrice < unitPrice || unitPrice < 0) {
        updates.discountPercent = 0;
        updates.discountAmount = 0;
        return updates;
    }
    var discountAmount = totalBeforeDiscount - total;
    if (isNaN(discountAmount)) {
        discountAmount = 0;
    }
    updates.discountAmount = discountAmount;
    updates.discountPercent = ((discountAmount / totalBeforeDiscount) * 100).toFixed(2);

    return updates;
}

function updateLineFromProduct(state, {payload}) {
    const {id, product} = payload;
    const line = _.detect(state, (sLine) => sLine.id === id);
    if (!line) {
        return state;
    }
    var updates = {};
    if (!product.sku) {
        // error happened before getting actual product information
        updates.errors = product.errors;
        return setLineProperties(state, id, updates);
    }
    if (line.unitPrice === 0) {
        updates = getDiscountsAndTotal(product.quantity, product.baseUnitPrice.value, product.unitPrice.value);
        updates.baseUnitPrice = product.baseUnitPrice.value;
        updates.unitPrice = product.unitPrice.value;
        updates.unitPriceIncludesTax = product.unitPrice.includesTax;
    }
    updates.sku = product.sku;
    updates.text = product.name;
    updates.quantity = product.quantity;
    updates.step = product.purchaseMultiple;
    updates.errors = product.errors;
    return setLineProperties(state, id, updates);
}

function ensureNumericValue(value, defaultValue=0) {
    value = parseFloat(value);
    if (isNaN(value)) {
        return defaultValue;
    }
    return value;
}

function setLineProperty(state, {payload}) {
    const {id, property, value} = payload;
    const line = _.detect(state, (sLine) => sLine.id === id);
    var updates = {};
    if (line) {
        switch (property) {
            case "product":
                const product = value;
                updates.product = product;
                updates.type = "product";
                break;
            case "text":
                updates.text = value;
                break;
            case "type":
                updates.type = value;
                updates.errors = null;
                if (value === "other" || value === "text") {
                    updates.product = null;
                    updates.sku = null;
                }
                if (value === "text") {
                    updates = getDiscountsAndTotal(0, line.baseUnitPrice, 0);
                    updates.unitPrice = 0;
                    updates.quantity = 0;
                }
                updates.type = value;
                break;
            case "quantity":
                const quantity = Math.max(0, ensureNumericValue(value, 1));
                updates = getDiscountsAndTotal(quantity, line.baseUnitPrice, line.unitPrice);
                updates.quantity = quantity;
                break;
            case "unitPrice":
                updates = getDiscountsAndTotal(
                    line.quantity,
                    line.baseUnitPrice,
                    ensureNumericValue(value, line.baseUnitPrice),
                    true
                );
                break;
            case "discountPercent":
                const discountPercent = Math.min(100, Math.max(0, ensureNumericValue(value)));
                updates = getDiscountsAndTotal(
                    line.quantity, line.baseUnitPrice, (line.baseUnitPrice * (1 - (discountPercent / 100))), true
                );
                break;
            case "discountAmount":
                const newDiscountAmount = Math.max(0, ensureNumericValue(value));
                updates = getDiscountsAndTotal(
                    line.quantity,
                    line.baseUnitPrice,
                    (line.baseUnitPrice -  newDiscountAmount / line.quantity),
                    true
                );
                updates.discountAmount = newDiscountAmount;
                break;
            case "total":
                const calculatedTotal = line.quantity * line.baseUnitPrice;
                // TODO: change the hardcoded rounding when doing SHOOP-1912
                const total = +ensureNumericValue(value, calculatedTotal).toFixed(2);
                updates = getDiscountsAndTotal(
                    line.quantity,
                    line.baseUnitPrice,
                    (total / line.quantity),
                    true
                );
                break;
        }
    }
    return setLineProperties(state, id, updates);
}

export default handleActions({
    addLine: ((state) => [].concat(state, newLine())),
    deleteLine: ((state, {payload}) => _.reject(state, (line) => line.id === payload)),
    updateLineFromProduct,
    setLineProperty
}, []);
