import { useState, useEffect } from "react";
import TabBar from "./components/TabBar";
import CardsTab from "./tabs/CardsTab";
import AITab from "./tabs/AITab";
import SettingsPanel from "./tabs/SettingsPanel";

type TabId = "cards" | "ai" | "settings";

function App() {
	const [activeTab, setActiveTab] = useState<TabId>("cards");

	useEffect(() => {
		const savedTheme = localStorage.getItem("trackmebaby-theme") || "dark";
		if (savedTheme === "dark") {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}, []);

	return (
		<div className="flex flex-col h-screen overflow-hidden bg-mac-bg font-sans selection:bg-mac-accent/20">
			{/* Custom Titlebar */}
			<div
				className="h-10 w-full shrink-0 flex items-center justify-center bg-mac-bg border-b border-black/10 dark:border-white/10 z-50 relative electrobun-webkit-app-region-drag"
			>
				{/* The titlebar text (optional, but good for native feel) */}
				<span className="text-[13px] font-semibold text-mac-text/80 cursor-default select-none electrobun-webkit-app-region-no-drag">
					trackmebaby
				</span>
			</div>

			{/* Main Application Area */}
			<div className="flex flex-row flex-1 overflow-hidden text-mac-text">
				{/* macOS-style translucent sidebar */}
				<TabBar activeTab={activeTab} onTabChange={setActiveTab} />

				{/* Main content area */}
				<div className="flex-1 overflow-y-auto">
					{activeTab === "cards" && <CardsTab />}
					{activeTab === "ai" && <AITab />}
					{activeTab === "settings" && <SettingsPanel />}
				</div>
			</div>
		</div>
	);
}

export default App;
