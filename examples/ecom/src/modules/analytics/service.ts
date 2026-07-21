import { avg, count, eq, gt, inArray, rawSql, sql, sum, withCte } from "@bungres/orm";
import { db } from "../../db/client";
import { dailySalesView, topSellingProductsView, orderLines, orders, reviews, users, stores, products } from "../../db/schema";

export abstract class AnalyticsService {
  // Testing Materialized View
  static async getDailySales() {
    return await db.execute(sql`SELECT * FROM ${rawSql(dailySalesView.name)} ORDER BY sale_date DESC LIMIT 30`);
  }

  // Testing Materialized View
  static async getTopSellingProducts() {
    return await db.execute(sql`SELECT * FROM ${rawSql(topSellingProductsView.name)} ORDER BY total_revenue DESC LIMIT 10`);
  }

  // Testing CTEs and Aggregations
  static async getSalesSummary() {
    const salesCte = withCte("sales_cte",
      db.select({
        orderId: orders.id,
        total: orders.total,
        status: orders.status,
      }).from(orders).where(eq(orders.status, "delivered"))
    );

    return await db.select({
      totalSales: sum("total"),
      orderCount: count("orderId"),
      averageOrderValue: avg("total")
    })
      .from(salesCte)
      .with(salesCte);
  }

  // Testing Subqueries and IN operator
  static async getEngagedUsers() {
    const usersWithOrders = db.select({ customerId: orders.customerId }).from(orders);
    const usersWithReviews = db.select({ userId: reviews.userId }).from(reviews);

    const engagedUserIdsQuery = usersWithOrders.union(usersWithReviews);

    return await db.select({
      id: users.id,
      name: users.name,
    })
      .from(users)
      .where(inArray(users.id, engagedUserIdsQuery))
      .limit(50);
  }

  // Testing GROUP BY and HAVING clauses
  static async getTopStores() {
    return await db.select({
      storeId: stores.id,
      storeName: stores.name,
      averageRating: avg(stores.rating),
      productCount: count(products.id)
    })
      .from(stores)
      .leftJoin(products, eq(stores.id, products.storeId))
      .groupBy(stores.id, stores.name)
      .having(gt(avg(stores.rating), 4.0))
      .orderBy(avg(stores.rating), "desc")
      .limit(10);
  }

  // Testing nested Joins and deep grouping
  static async getCustomerLifetimeValue() {
    return await db.select({
      customerId: users.id,
      customerName: users.name,
      totalSpent: sum(orders.total),
      orderCount: count(orders.id)
    })
      .from(users)
      .innerJoin(orders, eq(users.id, orders.customerId))
      .where(eq(orders.status, "delivered"))
      .groupBy(users.id, users.name)
      .having(gt(sum(orders.total), 1000))
      .orderBy(sum(orders.total), "desc")
      .limit(20);
  }
}
