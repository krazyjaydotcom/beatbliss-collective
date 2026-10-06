import { createFileRoute } from "@tanstack/react-router";
import { AdminCustomersPage } from "@/components/admin/customer-workspace";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({ meta: [{ title: "Admin · Customers & Leads — MYBEATCATALOG" }] }),
  component: CustomersRoute,
});

function CustomersRoute() { return <AdminCustomersPage />; }
