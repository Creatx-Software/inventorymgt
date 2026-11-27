import { api } from './client';
import { createCrudApi } from './crud';
import type {
  Endpoint, Monitor, MobileDevice, IpPhone, Server, Printer, NetworkDevice, OtherAsset,
  AssetStatus, AssignmentHistory,
} from '../types/assets';

export const endpointsApi      = createCrudApi<Endpoint>('endpoints');
export const monitorsAssetApi  = createCrudApi<Monitor>('monitors');
export const mobileDevicesApi  = createCrudApi<MobileDevice>('mobile-devices');
export const ipPhonesApi       = createCrudApi<IpPhone>('ip-phones');
export const serversApi        = {
  ...createCrudApi<Server>('servers'),
  decommission: async (id: number): Promise<void> => { await api.post(`/servers/${id}/decommission`); },
  restoreDecommission: async (id: number): Promise<void> => { await api.post(`/servers/${id}/restore-decommission`); },
};
export const printersApi       = createCrudApi<Printer>('printers');
export const networkDevicesApi = {
  ...createCrudApi<NetworkDevice>('network-devices'),
  decommission: async (id: number): Promise<void> => { await api.post(`/network-devices/${id}/decommission`); },
  restoreDecommission: async (id: number): Promise<void> => { await api.post(`/network-devices/${id}/restore-decommission`); },
};
export const otherAssetsApi    = createCrudApi<OtherAsset>('other-assets');

export const assetStatusesApi = {
  list: async (): Promise<AssetStatus[]> => {
    const r = await api.get('/asset-statuses', { params: { pageSize: 500 } });
    return r.data.data;
  },
};

export async function getAssignmentHistory(resource: string, id: number): Promise<AssignmentHistory[]> {
  const r = await api.get(`/${resource}/${id}/history`);
  return r.data;
}
