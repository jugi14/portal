import React from "react";
import { Navigate, useParams } from "react-router-dom";

export function LegacyRouteRedirect() {
  const { teamId } = useParams<{ teamId: string }>();
  return <Navigate to={`/teams/${teamId}`} replace />;
}