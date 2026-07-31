'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ALL_STORES, SHOP_COLORS, SHOPS } from '@/lib/types';

interface ShopFilterProps {
  stores: string[];
  value: string;
  onChange: (value: string) => void;
  mode?: 'select' | 'tabs';
}

export function ShopFilter({ stores, value, onChange, mode = 'select' }: ShopFilterProps) {
  const allStores = [ALL_STORES, ...stores];

  if (mode === 'tabs') {
    return (
      <div className="flex flex-wrap gap-1">
        {allStores.map((store) => {
          const shopKey = store === ALL_STORES ? 'shop1' : (
            SHOPS.find(s => s.label === store)?.key || 'shop1'
          );
          const isActive = value === store;
          return (
            <Button
              key={store}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(store)}
              className="gap-1.5 min-w-[60px]"
              style={isActive ? { backgroundColor: SHOP_COLORS[shopKey as keyof typeof SHOP_COLORS] || '#1e3a5f' } : {}}
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