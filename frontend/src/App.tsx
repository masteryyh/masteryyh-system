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
import { GatewayOverviewPanel } from "@/features/gateways/gateway-overview-panel";
import { GatewayRoutesPanel } from "@/features/gateways/gateway-routes-panel";
import { FilesPage } from "@/features/files/files-page";
import { HomePage } from "@/features/home/home-page";
import { LoginPage } from "@/features/login/login-page";
import { PlatformsPage } from "@/features/platforms/platforms-page";
import { PlatformDetailPage } from "@/features/platforms/platform-detail-page";
import {
    ContainersPanel,
    HostPlaceholderPanel,
    ImagesPanel,
    NetworksPanel,
    OverviewPanel,
    VolumesPanel,
} from "@/features/platforms/platform-panels";
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
                                            path="/files"
                                            element={<FilesPage />}
                                        />
                                    </Route>
                                    <Route
                                        path="/platforms/:platformId"
                                        element={<PlatformDetailPage />}
                                    >
                                        <Route index element={<OverviewPanel />} />
                                        <Route
                                            path="images"
                                            element={<ImagesPanel />}
                                        />
                                        <Route
                                            path="containers"
                                            element={<ContainersPanel />}
                                        />
                                        <Route
                                            path="networks"
                                            element={<NetworksPanel />}
                                        />
                                        <Route
                                            path="volumes"
                                            element={<VolumesPanel />}
                                        />
                                        <Route
                                            path="services"
                                            element={
                                                <HostPlaceholderPanel kind="services" />
                                            }
                                        />
                                        <Route
                                            path="cron"
                                            element={
                                                <HostPlaceholderPanel kind="cron" />
                                            }
                                        />
                                    </Route>
                                    <Route
                                        path="/gateways/:gatewayId"
                                        element={<GatewayDetailPage />}
                                    >
                                        <Route
                                            index
                                            element={<GatewayOverviewPanel />}
                                        />
                                        <Route
                                            path="routes"
                                            element={<GatewayRoutesPanel />}
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
