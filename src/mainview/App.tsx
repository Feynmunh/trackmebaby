import { useState, useEffect } from "react";
import TabBar from "./components/TabBar";
import CardsTab from "./tabs/CardsTab";
import AITab from "./tabs/AITab";
import SettingsPanel from "./tabs/SettingsPanel";
import { getPlatform } from "./rpc";

type TabId = "cards" | "ai" | "settings";

function App() {
	const [activeTab, setActiveTab] = useState<TabId>("cards");
	const [isMac, setIsMac] = useState(true); // default true to avoid flash

	useEffect(() => {
		const savedTheme = localStorage.getItem("trackmebaby-theme") || "dark";
		if (savedTheme === "dark") {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}

		// Detect platform — custom titlebar only shown on macOS
		// On Linux/Windows, hiddenInset shows the native titlebar which handles
		// window controls (minimize, maximize, close, drag, resize)
		getPlatform()
			.then((platform) => setIsMac(platform === "darwin"))
			.catch(() => setIsMac(false));
	}, []);

	return (
		<div className="flex flex-col h-screen overflow-hidden bg-mac-bg font-sans selection:bg-mac-accent/20">
			{/* Custom Titlebar — macOS only (on Linux, the native titlebar handles this) */}
			{isMac && (
				<div
					className="h-10 w-full shrink-0 flex items-center justify-center bg-mac-bg border-b border-black/10 dark:border-white/10 z-50 relative electrobun-webkit-app-region-drag"
				>
					{/* Spacer for macOS traffic lights (left side) */}
					<div className="w-20 shrink-0" />

					{/* Centered title */}
					<div className="flex-1 flex items-center justify-center">
						<span className="text-[13px] font-semibold text-mac-text/80 cursor-default select-none electrobun-webkit-app-region-no-drag">
							trackmebaby
						</span>
					</div>

					{/* Right spacer to balance */}
					<div className="w-4 shrink-0" />
				</div>
			)}

			{/* Main Application Area */}
			<div className="flex flex-row flex-1 overflow-hidden text-mac-text">
				{/* macOS-style translucent sidebar */}
				<TabBar activeTab={activeTab} onTabChange={setActiveTab} />

				{/* Main content area */}
				<div className="flex-1 overflow-y-auto">
					{activeTab === "cards" && <CardsTab onNavigateToSettings={() => setActiveTab("settings")} />}
					{activeTab === "ai" && <AITab />}
					{activeTab === "settings" && <SettingsPanel />}
				</div>
			</div>
		</div>
	);
}

export default App;
