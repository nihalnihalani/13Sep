'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Sparkles, 
  Image, 
  Video, 
  Layers, 
  FileImage, 
  Menu,
  Sun,
  Moon,
  Globe,
  Wand2,
  Share2
} from 'lucide-react';
import { StudioMode } from '@/lib/types';

interface ModernNavbarProps {
  currentMode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
}

const navigationItems = [
  {
    id: 'cultural' as StudioMode,
    label: 'Cultural',
    icon: Globe,
  },
  {
    id: 'all' as StudioMode,
    label: 'All',
    icon: Wand2,
  },
  {
    id: 'create-image' as StudioMode,
    label: 'Create',
    icon: Image,
  },
  {
    id: 'edit-image' as StudioMode,
    label: 'Edit',
    icon: Layers,
  },
  {
    id: 'create-video' as StudioMode,
    label: 'Video',
    icon: Video,
  },
  {
    id: 'product-gallery' as StudioMode,
    label: 'Gallery',
    icon: FileImage,
  }
];

export function ModernNavbar({ currentMode, onModeChange }: ModernNavbarProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        
        {/* Logo */}
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Alchemy Studio</h1>
          </div>
        </motion.div>

        {/* Desktop Navigation */}
        <div className="hidden md:block">
          <Tabs value={currentMode} onValueChange={onModeChange}>
            <TabsList className="grid w-full grid-cols-6 rounded-full border border-border bg-muted/50 p-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="nav-tab flex items-center gap-2 px-3 py-1.5 rounded-full text-muted-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:!text-black dark:data-[state=active]:!text-white"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Agentic View nav */}
          <Link href="/agents" className="hidden sm:block">
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" /> Agentic View
            </Button>
          </Link>
          
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="hidden sm:flex"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>


          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <div className="flex flex-col space-y-4 mt-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold">Alchemy Studio</h2>
                </div>
                
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentMode === item.id;
                  
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "default" : "ghost"}
                      className="justify-start w-full"
                      onClick={() => onModeChange(item.id)}
                    >
                      <Icon className="h-4 w-4 mr-3" />
                      {item.label}
                    </Button>
                  );
                })}

                {/* Agentic View (mobile) */}
                <Link href="/agents">
                  <Button variant="outline" className="justify-start w-full mt-2">
                    <Share2 className="h-4 w-4 mr-3" /> Agentic View
                  </Button>
                </Link>
                
                <div className="border-t pt-4 mt-6">
                  <Button
                    variant="ghost"
                    className="justify-start w-full"
                    onClick={toggleTheme}
                  >
                    {theme === 'light' ? (
                      <>
                        <Moon className="h-4 w-4 mr-3" />
                        Dark Mode
                      </>
                    ) : (
                      <>
                        <Sun className="h-4 w-4 mr-3" />
                        Light Mode
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}