/** Public route map composes prebuilt pages inside a single consistent site shell. */
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/index.js';
import { HomePage, AccountPage, NotFoundPage } from '../pages/index.js';

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
