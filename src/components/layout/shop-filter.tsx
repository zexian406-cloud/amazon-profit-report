'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ALL_STORES } from '@/lib/types';
import { useShops } from '@/hooks/use-shops';

interface ShopFilterProps {
  value: string;
  onChange: (value: string) => void;
  mode?: 'select' | 'tabs';
}

export function ShopFilter({ value, onChange, mode = 'select' }: ShopFilterProps) {
  const { shops, getShopColor } = useShops();
  const storeNames = shops.map(s => s.name);
  const allStores = [ALL_STORES, ...storeNames];

  if (mode === 'tabs') {
    return (
      <div className="flex flex-wrap gap-1">
        {allStores.map((store) => {
          const isActive = value === store;
          const color = store === ALL_STORES ? '#1e3a5f' : getShopColor(store);
          return (
            <Button
              key={store}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(store)}
              className="gap-1.5 min-w-[60px]"
              style={isActive ? { backgroundColor: color } : {}}
            >
              {store}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32">
        <SelectValue placeholder="选择店铺" />
      </SelectTrigger>
      <SelectContent>
        {allStores.map((store) => (
          <SelectItem key={store} value={store}>{store}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}