import { AssetPage } from '../components/asset/AssetPage';
import { commonAssetColumns } from '../components/asset/columns';
import { ipPhonesApi } from '../api/assets';
import type { IpPhone } from '../types/assets';

export default function IpPhonesPage() {
  return (
    <AssetPage<IpPhone, Record<string, never>>
      title="IP Phones"
      subtitle="VoIP desk phones"
      resource="ip-phones"
      assetType="ip_phone"
      api={ipPhonesApi}
      columns={commonAssetColumns<IpPhone>()}
      stickyColumnIds={['serial_number']}
      emptyExtra={{}}
      extraToPayload={() => ({})}
      rowToExtra={() => ({})}
      renderExtraFields={() => (
        <div className="text-sm text-slate-500">No additional fields for IP phones.</div>
      )}
    />
  );
}
