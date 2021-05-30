export interface Order {
	id: string;
	restaurant_id: string;
	date_purchased: string | null;
	subtotal: number;
	taxes: number;
	delivery_fee: number;
	service_fee: number;
	tip: number;
	discounts: number;
	total_charged: number;
	other_fees?: number;
}

export interface OrderItem {
	id?: string;
	order_id: string;
	restaurant_item_id: string;
	price_per_item: number;
	quantity: number;
	total_charged: number;
	special_request: string;
}

export interface Restaurant {
	id: string;
	name: string;
}

export interface RestaurantItem {
	id: string;
	restaurant_id: string;
	name: string;
	rating: number;
	is_favorite: boolean;
}

export interface ExtractorData {
	order: Order;
	orderItems: Array<OrderItem>;
	restaurant: Restaurant;
	restaurantItems: Array<RestaurantItem>;
}
