/** Public route map composes prebuilt pages inside a single consistent site shell. */
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { HomePage } from '../pages/HomePage';
import { AccountPage } from '../pages/AccountPage';
import { NotFoundPage } from '../pages/NotFoundPage';
/** Registers only the approved landing/account/recovery routes; no transfer route exists. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="accounts/:accountId" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
