import { StatusBar } from "expo-status-bar";
import { HomeScreen } from "@/screens/HomeScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <StatusBar hidden />
      <HomeScreen />
    </ErrorBoundary>
  );
}
