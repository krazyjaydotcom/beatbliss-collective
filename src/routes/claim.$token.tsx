import { createFileRoute, Navigate, useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/claim/$token")({
  component: ClaimRedirect,
});

function ClaimRedirect() {
  const { token } = useParams({ from: "/claim/$token" });
  return <Navigate to="/join/$token" params={{ token }} replace />;
}
