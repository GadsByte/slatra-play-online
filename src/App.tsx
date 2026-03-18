import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MultiplayerProvider } from "@/features/multiplayer/MultiplayerContext";
import MainMenu from "./pages/MainMenu.tsx";
import Index from "./pages/Index.tsx";
import Rules from "./pages/Rules.tsx";
import MultiplayerEntry from "./pages/MultiplayerEntry.tsx";
import MultiplayerLobby from "./pages/MultiplayerLobby.tsx";
import MultiplayerRoom from "./pages/MultiplayerRoom.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MultiplayerProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainMenu />} />
            <Route path="/local" element={<Index />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/multiplayer" element={<MultiplayerEntry />} />
            <Route path="/multiplayer/lobby" element={<MultiplayerLobby />} />
            <Route path="/multiplayer/room/:roomId" element={<MultiplayerRoom />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </MultiplayerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
