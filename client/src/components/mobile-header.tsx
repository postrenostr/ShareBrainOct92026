import { Menu, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  onMenuToggle: () => void;
}

export default function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
  return (
    <div className="lg:hidden flex items-center justify-between p-4 bg-black border-b border-white">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
          <Bot className="text-black h-4 w-4" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">ShareBrain</h1>
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onMenuToggle}
        className="h-10 w-10 p-0 text-white hover:bg-gray-800"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );
}