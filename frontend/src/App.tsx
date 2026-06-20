import { Navigate, Route, Routes } from "react-router";

import { ConsoleShell } from "@/components/console-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/context/session-provider";
import { VersionProvider } from "@/context/version-provider";
import { CredentialsPage } from "@/features/credentials/credentials-page";
import { HomePage } from "@/features/home/home-page";
import { LoginPage } from "@/features/login/login-page";
import { PlatformsPage } from "@/features/platforms/platforms-page";
import { ProtectedRoute } from "@/routes/protected-route";
import { PublicRoute } from "@/routes/public-route";

function App() {
    return (
        <SessionProvider>
            <VersionProvider>
                <TooltipProvider>
                    <Routes>
                        <Route element={<PublicRoute />}>
                            <Route path="/login" element={<LoginPage />} />
                        </Route>
                        <Route element={<ProtectedRoute />}>
                            <Route element={<ConsoleShell />}>
                                <Route
                                    path="/"
                                    element={<Navigate to="/home" replace />}
                                />
                                <Route path="/home" element={<HomePage />} />
                                <Route
                                    path="/credentials"
                                    element={<CredentialsPage />}
                                />
                                <Route
                                    path="/platforms"
                                    element={<PlatformsPage />}
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
    );
}

export default App;
