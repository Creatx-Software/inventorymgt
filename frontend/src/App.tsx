import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import Locations from './pages/Locations';
import Departments from './pages/Departments';
import Employees from './pages/Employees';
import Endpoints from './pages/Endpoints';
import Monitors from './pages/Monitors';
import MobileDevices from './pages/MobileDevices';
import IpPhones from './pages/IpPhones';
import Servers from './pages/Servers';
import Printers from './pages/Printers';
import NetworkDevices from './pages/NetworkDevices';
import OtherAssets from './pages/OtherAssets';
import Incidents from './pages/Incidents';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/endpoints"       element={<Endpoints />} />
            <Route path="/monitors"        element={<Monitors />} />
            <Route path="/mobile-devices"  element={<MobileDevices />} />
            <Route path="/ip-phones"       element={<IpPhones />} />
            <Route path="/servers"         element={<Servers />} />
            <Route path="/printers"        element={<Printers />} />
            <Route path="/network-devices" element={<NetworkDevices />} />
            <Route path="/other-assets"    element={<OtherAssets />} />
            <Route path="/incidents"       element={<Incidents />} />
            <Route path="/audit-logs"      element={<AuditLogs />} />
            <Route path="/employees"       element={<Employees />} />
            <Route path="/departments"     element={<Departments />} />
            <Route path="/locations"       element={<Locations />} />
            <Route path="/vendors"         element={<Vendors />} />
            <Route path="/settings"        element={<Settings />} />
            <Route path="/users"           element={<UsersPage />} />
            <Route path="/roles"           element={<RolesPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
