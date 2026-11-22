'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Brand } from './brand';
import { portals, type Portal } from './portals';
import { SidebarNav } from './sidebar-nav';

export function MobileNav({ portal }: { portal: Portal }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-4">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">{portals[portal].name}</SheetDescription>
        <Brand portal={portal} />
        <SidebarNav portal={portal} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
