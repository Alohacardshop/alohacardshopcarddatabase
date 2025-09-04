import { Search, Moon, Sun, User, Command, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";

interface AppHeaderProps {
  onOpenCommandPalette?: () => void;
}

export function AppHeader({ onOpenCommandPalette }: AppHeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-16 bg-background border-b border-border px-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          <span className="font-semibold text-lg">Aloha Card Shop</span>
          <span className="text-xs bg-muted px-2 py-1 rounded-full">Admin</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Command Palette Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenCommandPalette}
          className="text-muted-foreground hover:text-foreground"
        >
          <Command className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Quick Actions</span>
        </Button>

        {/* Sync Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCommandPalette}
          className="text-primary border-primary/30 hover:bg-primary/10"
        >
          <Zap className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Sync</span>
        </Button>

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-9 w-48 bg-muted/50"
            onClick={onOpenCommandPalette}
            readOnly
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}