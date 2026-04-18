import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MultiplayerProvider } from "@/multiplayer/MultiplayerContext";
import MainMenu from "./pages/MainMenu.tsx";
import Index from "./pages/Index.tsx";
import Rules from "./pages/Rules.tsx";
import MultiplayerEntry from "./pages/MultiplayerEntry.tsx";
import MultiplayerLobby from "./pages/MultiplayerLobby.tsx";
import MultiplayerRoom from "./pages/MultiplayerRoom.tsx";
import MultiplayerGame from "./pages/MultiplayerGame.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/local" element={<Index />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/multiplayer/*" element={
            <MultiplayerProvider>
              <Routes>
                <Route path="/" element={<MultiplayerEntry />} />
                <Route path="/lobby" element={<MultiplayerLobby />} />
                <Route path="/room/:roomId" element={<MultiplayerRoom />} />
                <Route path="/game/:roomId" element={<MultiplayerGame />} />
              </Routes>
            </MultiplayerProvider>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
