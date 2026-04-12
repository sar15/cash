'use client';

import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Trash2, TrendingUp, User, Building, Landmark, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useMicroForecastStore, WizardType, MicroForecastItem } from '@/stores/micro-forecast-store';
import { formatLakhs } from '@/lib/utils/indian-format';
import { RevenueWizard } from './RevenueWizard';
import { NewHireWizard } from './NewHireWizard';
import { AssetWizard } from './AssetWizard';
import { LoanWizard } from './LoanWizard';

const typeConfig: Record<WizardType, { icon: typeof TrendingUp; label: string; color: string; bgColor: string }> = {
  revenue: { icon: TrendingUp, label: 'Revenue', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
  hire: { icon: User, label: 'New Hire', color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
  asset: { icon: Building, label: 'Asset', color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
  loan: { icon: Landmark, label: 'Loan', color: 'text-indigo-600', bgColor: 'bg-indigo-500/10' },
};

function MicroForecastRow({ item }: { item: MicroForecastItem }) {
  const [expanded, setExpanded] = useState(false);
  const toggleActive = useMicroForecastStore((s) => s.toggleActive);
  const removeItem = useMicroForecastStore((s) => s.removeItem);

  const config = typeConfig[item.type];
  const Icon = config.icon;

  // Calculate total P&L and CF impact from the micro forecast
  const totalPlImpact = item.microForecast.lines.reduce((sum, line) => 
    sum + line.plImpacts.reduce((a, b) => a + b, 0), 0
  );
  const totalCashImpact = item.microForecast.lines.reduce((sum, line) =>
    sum + line.cashImpacts.reduce((a, b) => a + b, 0), 0
  );

  return (
    <div className={`rounded-lg border transition-all ${item.isActive ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'}`}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setExpanded(!expanded)} className="shrink-0 text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${config.bgColor}`}>
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground">from {item.startMonth}</p>
        </div>
        <Switch
          checked={item.isActive}
          onCheckedChange={() => {
            void toggleActive(item.id);
          }}
          className="shrink-0"
        />
      </div>
      
      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">P&L Impact (FY)</span>
            <span className={`font-medium ${totalPlImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalPlImpact >= 0 ? '+' : ''}{formatLakhs(totalPlImpact, 1)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Cash Impact (FY)</span>
            <span className={`font-medium ${totalCashImpact >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalCashImpact >= 0 ? '+' : ''}{formatLakhs(totalCashImpact, 1)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Type</span>
            <Badge variant="outline" className="text-xs h-5">{config.label}</Badge>
          </div>
          <button
            onClick={() => {
              void removeItem(item.id);
            }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 mt-1"
          >
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MicroForecastSidebar({ isOpen, onClose }: SidebarProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [wizardOpen, setWizardOpen] = useState<WizardType | null>(null);
  const items = useMicroForecastStore((s) => s.items);
  const isLoading = useMicroForecastStore((s) => s.isLoading);
  const error = useMicroForecastStore((s) => s.error);

  if (!isOpen) return null;

  return (
    <>
      <div className="w-[300px] shrink-0 border-r bg-card flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Business Events</h2>
          <div className="flex items-center gap-1">
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() => setShowMenu(!showMenu)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Event
              </Button>
              
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border bg-popover p-1 shadow-lg">
                  {(Object.keys(typeConfig) as WizardType[]).map((type) => {
                    const cfg = typeConfig[type];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => { setWizardOpen(type); setShowMenu(false); }}
                        className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 thin-scrollbar">
          {isLoading && items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              Loading saved events...
            </div>
          ) : error && items.length === 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No events yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add a new hire, revenue stream, asset purchase, or loan to see how it impacts your forecast.</p>
            </div>
          ) : (
            items.map(item => <MicroForecastRow key={item.id} item={item} />)
          )}
        </div>

        {/* Summary */}
        {items.length > 0 && (
          <div className="border-t px-4 py-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{items.filter(i => i.isActive).length} active / {items.length} total</span>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Dialogs */}
      <RevenueWizard open={wizardOpen === 'revenue'} onClose={() => setWizardOpen(null)} />
      <NewHireWizard open={wizardOpen === 'hire'} onClose={() => setWizardOpen(null)} />
      <AssetWizard open={wizardOpen === 'asset'} onClose={() => setWizardOpen(null)} />
      <LoanWizard open={wizardOpen === 'loan'} onClose={() => setWizardOpen(null)} />
    </>
  );
}
