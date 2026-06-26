import { Navigate, Route, Routes } from "react-router";

import { ConsoleShell } from "@/components/console-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/context/session-provider";
import { VersionProvider } from "@/context/version-provider";
import { CredentialsPage } from "@/features/credentials/credentials-page";
import { GatewaysPage } from "@/features/gateways/gateways-page";
import { GatewayDetailPage } from "@/features/gateways/gateway-detail-page";
import { FilesPage } from "@/features/files/files-page";
import { HomePage } from "@/features/home/home-page";
import { LoginPage } from "@/features/login/login-page";
import { PlatformsPage } from "@/features/platforms/platforms-page";
import { I18nProvider } from "@/i18n/provider";
import { ProtectedRoute } from "@/routes/protected-route";
import { PublicRoute } from "@/routes/public-route";

function App() {
    return (
        <I18nProvider>
            <ErrorBoundary>
                <SessionProvider>
                    <VersionProvider>
                        <TooltipProvider>
                            <Routes>
                                <Route element={<PublicRoute />}>
                                    <Route
                                        path="/login"
                                        element={<LoginPage />}
                                    />
                                </Route>
                                <Route element={<ProtectedRoute />}>
                                    <Route element={<ConsoleShell />}>
                                        <Route
                                            path="/"
                                            element={
                                                <Navigate to="/home" replace />
                                            }
                                        />
                                        <Route
                                            path="/home"
                                            element={<HomePage />}
                                        />
                                        <Route
                                            path="/credentials"
                                            element={<CredentialsPage />}
                                        />
                                        <Route
                                            path="/platforms"
                                            element={<PlatformsPage />}
                                        />
                                        <Route
                                            path="/gateways"
                                            element={<GatewaysPage />}
                                        />
                                        <Route
                                            path="/gateways/:gatewayId"
                                            element={<GatewayDetailPage />}
                                        />
                                        <Route
                                            path="/files"
                                            element={<FilesPage />}
                                        />
                                    </Route>
                                </Route>
                                <Route
                                    path="*"
                                    element={<Navigate to="/home" replace />}
                                />
                            </Routes>
                            <Toaster richColors position="top-center" />
                        </TooltipProvider>
                    </VersionProvider>
                </SessionProvider>
            </ErrorBoundary>
        </I18nProvider>
    );
}

export default App;
