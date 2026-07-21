import { Elysia } from "elysia";
import { AnalyticsService } from "./service";

export const analyticsModule = new Elysia({ prefix: "/analytics" })
  .get("/daily-sales", () => AnalyticsService.getDailySales())
  .get("/top-selling-products", () => AnalyticsService.getTopSellingProducts())
  .get("/sales-summary", () => AnalyticsService.getSalesSummary())
  .get("/engaged-users", () => AnalyticsService.getEngagedUsers())
  .get("/top-stores", () => AnalyticsService.getTopStores())
  .get("/customer-ltv", () => AnalyticsService.getCustomerLifetimeValue());
