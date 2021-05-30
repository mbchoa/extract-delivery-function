import cheerio, {CheerioAPI, Node} from "cheerio";
import {createHmac} from "crypto";
import {gmail_v1 as gmailV1} from "googleapis";

import type {Order, OrderItem, Restaurant, RestaurantItem} from "./types";

const password = "this is the password luls";

function extractOrder(
	$: CheerioAPI,
	restaurant: Restaurant,
	message: gmailV1.Schema$Message,
): Order {
	function getTotalsLineItem(lineItemName: string): number {
		const amtString: string = $("td").filter((_, el) =>
			$(el).text().trim() === lineItemName
		).next().text();
		return amtString.length ? parseFloat(amtString.replace("$", "")) : 0;
	}

	return {
		id: createHmac("sha256", password).update($.html()).digest("hex"),
		date_purchased: (message?.internalDate)?.length
			? new Date(parseInt(message.internalDate, 10)).toISOString()
			: null,
		restaurant_id: restaurant.id,
		subtotal: getTotalsLineItem("Subtotal"),
		taxes: getTotalsLineItem("Taxes"),
		delivery_fee: getTotalsLineItem("Delivery Fee"),
		service_fee: getTotalsLineItem("Service Fee"),
		tip: getTotalsLineItem("Tip"),
		discounts: getTotalsLineItem("Discounts"),
		total_charged: getTotalsLineItem("Total Charged"),
	};
}

function extractOrderItems(
	$: CheerioAPI,
	restaurantItems: Array<RestaurantItem>,
	order: Order,
): Array<OrderItem> {
	function getOrderItemData(rowEl: Node, index: number) {
		const columns = $(rowEl).children().toArray();
		const pricePerItem = parseFloat($(columns[2]).text().replace("$", ""));
		const quantity = parseInt($(columns[0]).text().replace("x", ""));

		return {
			id: createHmac("sha256", password).update(
				order.id + restaurantItems[index].id,
			).digest("hex"),
			order_id: order.id,
			restaurant_item_id: restaurantItems[index].id,
			price_per_item: pricePerItem,
			quantity,
			total_charged: quantity * pricePerItem,
			special_request: "",
		};
	}

	const receiptContainer = $("tbody").filter((_, tbodyEl) => {
		return $(tbodyEl).children().length === 9;
	});
	const orderItemRows = $(receiptContainer.last().children().toArray()[7]).find(
		"table table > tbody",
	);
	return $(orderItemRows).children().toArray().map(getOrderItemData);
}

function extractRestaurant($: CheerioAPI): Restaurant {
	function predicate(contentEl: Node) {
		return (
			contentEl.type === "text" && $(contentEl).text().includes("Paid with")
		);
	}

	const tdContainersWithText = $("td").filter((_, tdEl) =>
		$(tdEl).contents().toArray().some(predicate)
	);
	const name = $(tdContainersWithText.contents().toArray()[2]).text().trim();
	return {
		id: createHmac("sha256", password).update(name).digest("hex"),
		name,
	};
}

function extractRestaurantItems(
	$: CheerioAPI,
	restaurant: Restaurant,
): Array<RestaurantItem> {
	function getRestaurantItemData(rowEl: Node) {
		const columns = $(rowEl).children().toArray();
		const name = $(columns[1]).find("b").text();
		return {
			id: createHmac("sha256", password).update(name).digest("hex"),
			restaurant_id: restaurant.id,
			name,
			rating: 0,
			is_favorite: false,
		};
	}

	const receiptContainer = $("tbody").filter((_, tbodyEl) => {
		return $(tbodyEl).children().length === 9;
	});
	const orderItemRows = $(receiptContainer.last().children().toArray()[7]).find(
		"table table > tbody",
	);
	return $(orderItemRows).children().toArray().map(getRestaurantItemData);
}

function extractor(message: gmailV1.Schema$Message, htmlString: string) {
	const $ = cheerio.load(htmlString);

	const restaurant: Restaurant = extractRestaurant($);
	const restaurantItems: Array<RestaurantItem> = extractRestaurantItems(
		$,
		restaurant,
	);
	const order: Order = extractOrder($, restaurant, message);
	const orderItems: Array<OrderItem> = extractOrderItems(
		$,
		restaurantItems,
		order,
	);

	return {
		order,
		orderItems,
		restaurant,
		restaurantItems,
	};
}

export default extractor;
