import { useState } from "react";
import TabBar from "./components/TabBar";
import CardsTab from "./tabs/CardsTab";
import AITab from "./tabs/AITab";
import SettingsPanel from "./tabs/SettingsPanel";

type TabId = "cards" | "ai" | "settings";

function App() {
	const [activeTab, setActiveTab] = useState<TabId>("cards");

	return (
		<div className="flex flex-col h-screen bg-gray-950 text-gray-100">
			{/* Main content area — scrollable */}
			<div className="flex-1 overflow-y-auto">
				{activeTab === "cards" && <CardsTab />}
				{activeTab === "ai" && <AITab />}
				{activeTab === "settings" && <SettingsPanel />}
			</div>

			{/* Bottom tab bar — fixed */}
			<TabBar activeTab={activeTab} onTabChange={setActiveTab} />
		</div>
	);
}

export default App;
